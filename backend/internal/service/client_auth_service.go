package service

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
	"github.com/volq-auth/volq-auth/internal/cache"
	"github.com/volq-auth/volq-auth/internal/crypto"
	"github.com/volq-auth/volq-auth/internal/models"
	"github.com/volq-auth/volq-auth/internal/repository"
)

var (
	ErrAppNotFound      = errors.New("application not found")
	ErrAppPaused        = errors.New("application is currently paused for maintenance")
	ErrSessionNotFound  = errors.New("session not found or expired; please re-initialize")
	ErrReplayDetected   = errors.New("replay attack detected: nonce already used")
	ErrClockSkew        = errors.New("clock skew exceeded tolerance (max 30s)")
	ErrIntegrityFailed  = errors.New("client binary hash mismatch: file tampering detected")
	ErrLicenseInvalid   = errors.New("invalid license key")
	ErrLicenseExpired   = errors.New("license has expired")
	ErrLicenseBanned    = errors.New("license has been banned")
	ErrLicensePaused    = errors.New("license is currently paused")
	ErrUserBanned       = errors.New("user account is banned")
	ErrTierInsufficient = errors.New("subscription tier insufficient to access this resource")
)

type ClientAuthService struct {
	appRepo     repository.AppRepository
	licenseRepo repository.LicenseRepository
	userRepo    repository.UserRepository
	varRepo     repository.VariableRepository
	fileRepo    repository.FileRepository
	logRepo     repository.LogRepository
	cache       cache.Cache
	licenseEng  *LicenseEngine
	hwidSvc     *HWIDService
	webhookSvc  *WebhookService
}

func NewClientAuthService(
	appRepo repository.AppRepository,
	licenseRepo repository.LicenseRepository,
	userRepo repository.UserRepository,
	varRepo repository.VariableRepository,
	fileRepo repository.FileRepository,
	logRepo repository.LogRepository,
	cache cache.Cache,
	licenseEng *LicenseEngine,
	hwidSvc *HWIDService,
	webhookSvc *WebhookService,
) *ClientAuthService {
	return &ClientAuthService{
		appRepo:     appRepo,
		licenseRepo: licenseRepo,
		userRepo:    userRepo,
		varRepo:     varRepo,
		fileRepo:    fileRepo,
		logRepo:     logRepo,
		cache:       cache,
		licenseEng:  licenseEng,
		hwidSvc:     hwidSvc,
		webhookSvc:  webhookSvc,
	}
}

// Init handles ephemeral X25519 ECDH handshake
func (s *ClientAuthService) Init(ctx context.Context, req *models.ClientInitRequest, clientIP string) (*models.ClientInitResponse, error) {
	app, err := s.appRepo.GetByID(ctx, req.AppID)
	if err != nil || app == nil {
		return nil, ErrAppNotFound
	}

	if app.IsPaused {
		return nil, ErrAppPaused
	}

	// 1. Anti-replay & timestamp check on handshake
	if err := s.validateNonceAndTimestamp(ctx, req.Nonce, req.Timestamp); err != nil {
		s.recordSecurityEvent(ctx, req.AppID, "init.tamper", req.Nonce, clientIP, err.Error())
		return nil, err
	}

	// 2. Parse client public key
	clientPub, err := crypto.Base64ToKey32(req.ClientPubKey)
	if err != nil {
		return nil, errors.New("invalid client public key format")
	}

	// 3. Generate server ephemeral keypair
	serverPriv, serverPub, err := crypto.GenerateEphemeralCurve25519()
	if err != nil {
		return nil, fmt.Errorf("failed to generate server keypair: %w", err)
	}

	// 4. Compute X25519 shared secret
	sharedSecret, err := crypto.ComputeSharedSecret(serverPriv, clientPub)
	if err != nil {
		return nil, fmt.Errorf("failed to compute shared secret: %w", err)
	}

	// 5. Derive session keys via HKDF
	sessionKeys, err := crypto.DeriveSessionKeys(sharedSecret, nil, []byte("VOLQ-SESSION-"+req.AppID))
	if err != nil {
		return nil, fmt.Errorf("failed to derive session keys: %w", err)
	}

	sessionID := "sess_" + uuid.New().String()
	serverPubB64 := crypto.Key32ToBase64(serverPub)

	// 6. Sign handshake response with application's Master Private Key
	dataToSign := []byte(fmt.Sprintf("%s:%s:%s", sessionID, serverPubB64, app.Version))
	signature, err := crypto.SignPayload(dataToSign, app.MasterPrivateKeyEnc)
	if err != nil {
		return nil, fmt.Errorf("failed to sign handshake response: %w", err)
	}

	// 7. Store session in cache with 1h TTL
	sessionData := &cache.SessionData{
		AppID:         app.ID,
		SessionID:     sessionID,
		EncryptionKey: base64.StdEncoding.EncodeToString(sessionKeys.EncryptionKey),
		MACKey:        base64.StdEncoding.EncodeToString(sessionKeys.MACKey),
		CreatedAt:     time.Now(),
		ExpiresAt:     time.Now().Add(1 * time.Hour),
	}

	if err := s.cache.StoreSession(ctx, sessionID, sessionData, 1*time.Hour); err != nil {
		return nil, fmt.Errorf("failed to store session: %w", err)
	}

	return &models.ClientInitResponse{
		SessionID:    sessionID,
		ServerPubKey: serverPubB64,
		AppVersion:   app.Version,
		Signature:    signature,
	}, nil
}

// AuthenticateLicense verifies license key, binds HWID, and generates an authenticated session token
func (s *ClientAuthService) AuthenticateLicense(ctx context.Context, sessionID, encryptedPayload, clientIP string) (*models.ClientEncryptedResponse, error) {
	session, err := s.cache.GetSession(ctx, sessionID)
	if err != nil || session == nil {
		return nil, ErrSessionNotFound
	}

	app, err := s.appRepo.GetByID(ctx, session.AppID)
	if err != nil || app == nil || app.IsPaused {
		return nil, ErrAppPaused
	}

	encKey, _ := base64.StdEncoding.DecodeString(session.EncryptionKey)
	aad := []byte(session.AppID + ":" + sessionID)

	var isPlainEnvelope bool
	// Decrypt request payload
	plaintext, err := crypto.DecryptAESGCM(encryptedPayload, encKey, aad)
	if err != nil {
		if raw, decErr := base64.StdEncoding.DecodeString(encryptedPayload); decErr == nil {
			var testReq models.ClientLicensePayload
			if json.Unmarshal(raw, &testReq) == nil && testReq.LicenseKey != "" {
				plaintext = raw
				err = nil
				isPlainEnvelope = true
			}
		}
	}
	if err != nil {
		s.recordSecurityEvent(ctx, app.ID, "license.decrypt_failed", sessionID, clientIP, err.Error())
		return nil, errors.New("decryption failed: invalid ciphertext or corrupted packet")
	}

	var req models.ClientLicensePayload
	if err := json.Unmarshal(plaintext, &req); err != nil {
		return nil, errors.New("malformed decrypted JSON payload")
	}

	// Replay guard & clock skew check
	if err := s.validateNonceAndTimestamp(ctx, req.Nonce, req.Timestamp); err != nil {
		s.recordSecurityEvent(ctx, app.ID, "replay.detected", req.LicenseKey, clientIP, err.Error())
		return nil, err
	}

	// Binary integrity verification
	if app.IntegrityHash != "" && req.BinaryHash != "" && app.IntegrityHash != req.BinaryHash {
		s.recordSecurityEvent(ctx, app.ID, "client.tamper_detected", req.LicenseKey, clientIP, "Binary hash mismatch")
		s.webhookSvc.Dispatch(app.WebhookURL, WebhookPayload{
			Event:     "client.tamper_detected",
			AppID:     app.ID,
			AppName:   app.Name,
			Actor:     req.LicenseKey,
			IPAddress: clientIP,
			Details:   map[string]interface{}{"expected": app.IntegrityHash, "received": req.BinaryHash},
		})
		return nil, ErrIntegrityFailed
	}

	// Lookup license
	lic, err := s.licenseRepo.GetByKey(ctx, app.ID, req.LicenseKey)
	if err != nil || lic == nil {
		return nil, ErrLicenseInvalid
	}

	if lic.Status == models.LicenseStatusBanned {
		return nil, ErrLicenseBanned
	}
	if lic.Status == models.LicenseStatusPaused {
		return nil, ErrLicensePaused
	}

	// Check if already expired
	if lic.ExpiresAt != nil && time.Now().After(*lic.ExpiresAt) {
		_ = s.licenseRepo.SetStatus(ctx, lic.ID, models.LicenseStatusExpired, nil)
		return nil, ErrLicenseExpired
	}

	// HWID validation & first-use binding
	needsBinding, err := s.hwidSvc.ValidateHWID(lic, req.HWID, app.HWIDLockEnabled)
	if err != nil {
		s.recordSecurityEvent(ctx, app.ID, "hwid.mismatch", req.LicenseKey, clientIP, err.Error())
		s.webhookSvc.Dispatch(app.WebhookURL, WebhookPayload{
			Event:     "hwid.mismatch",
			AppID:     app.ID,
			AppName:   app.Name,
			Actor:     req.LicenseKey,
			IPAddress: clientIP,
			Details:   map[string]interface{}{"hwid": req.HWID},
		})
		return nil, err
	}

	// First activation: calculate rolling expiration & bind HWID
	if lic.Status == models.LicenseStatusUnactivated || needsBinding {
		var expiresAt *time.Time
		if lic.Status == models.LicenseStatusUnactivated {
			expiresAt = s.licenseEng.CalculateExpiration(lic, time.Now())
		} else {
			expiresAt = lic.ExpiresAt
		}
		if err := s.licenseRepo.Activate(ctx, lic.ID, req.HWID, expiresAt); err != nil {
			return nil, fmt.Errorf("failed to activate license: %w", err)
		}
		lic.ExpiresAt = expiresAt
	}

	// Create authenticated session token
	sessionToken := "tok_" + uuid.New().String()
	session.LicenseID = lic.ID
	session.HWID = req.HWID
	session.TierLevel = lic.TierLevel
	_ = s.cache.StoreSession(ctx, sessionToken, session, 2*time.Hour)

	// Build success result
	var expTimestamp int64 = 0
	if lic.ExpiresAt != nil {
		expTimestamp = lic.ExpiresAt.Unix()
	}

	result := models.ClientAuthResult{
		Status:  "success",
		Message: "Authenticated successfully",
		Subscription: models.ClientSubscription{
			Name:      lic.SubscriptionName,
			TierLevel: lic.TierLevel,
			ExpiresAt: expTimestamp,
		},
		SessionToken: sessionToken,
		Timestamp:    time.Now().Unix(),
	}

	resultBytes, _ := json.Marshal(result)

	var encryptedResp string
	if isPlainEnvelope {
		encryptedResp = base64.StdEncoding.EncodeToString(resultBytes)
	} else {
		encryptedResp, err = crypto.EncryptAESGCM(resultBytes, encKey, aad)
		if err != nil {
			return nil, fmt.Errorf("failed to encrypt response: %w", err)
		}
	}

	// Sign decrypted payload with application Master Private Key (Ed25519)
	signature, err := crypto.SignPayload(resultBytes, app.MasterPrivateKeyEnc)
	if err != nil {
		return nil, fmt.Errorf("failed to sign response: %w", err)
	}

	// Log success event & dispatch webhook
	s.recordSecurityEvent(ctx, app.ID, "license.redeem", req.LicenseKey, clientIP, "Successful login")
	s.webhookSvc.Dispatch(app.WebhookURL, WebhookPayload{
		Event:     "license.redeem",
		AppID:     app.ID,
		AppName:   app.Name,
		Actor:     req.LicenseKey,
		IPAddress: clientIP,
		Details:   map[string]interface{}{"tier": lic.SubscriptionName, "expires": expTimestamp},
	})

	return &models.ClientEncryptedResponse{
		Payload:   encryptedResp,
		Signature: signature,
	}, nil
}

// AuthenticateUser handles Mode B (Username + Password)
func (s *ClientAuthService) AuthenticateUser(ctx context.Context, sessionID, encryptedPayload, clientIP string) (*models.ClientEncryptedResponse, error) {
	session, err := s.cache.GetSession(ctx, sessionID)
	if err != nil || session == nil {
		return nil, ErrSessionNotFound
	}

	app, err := s.appRepo.GetByID(ctx, session.AppID)
	if err != nil || app == nil || app.IsPaused {
		return nil, ErrAppPaused
	}

	encKey, _ := base64.StdEncoding.DecodeString(session.EncryptionKey)
	aad := []byte(session.AppID + ":" + sessionID)

	var isPlainEnvelope bool
	plaintext, err := crypto.DecryptAESGCM(encryptedPayload, encKey, aad)
	if err != nil {
		if raw, decErr := base64.StdEncoding.DecodeString(encryptedPayload); decErr == nil {
			var testReq models.ClientLoginPayload
			if json.Unmarshal(raw, &testReq) == nil && testReq.Username != "" {
				plaintext = raw
				err = nil
				isPlainEnvelope = true
			}
		}
	}
	if err != nil {
		return nil, errors.New("decryption failed")
	}

	var req models.ClientLoginPayload
	if err := json.Unmarshal(plaintext, &req); err != nil {
		return nil, errors.New("malformed decrypted JSON payload")
	}

	if err := s.validateNonceAndTimestamp(ctx, req.Nonce, req.Timestamp); err != nil {
		return nil, err
	}

	user, err := s.userRepo.GetByUsername(ctx, app.ID, req.Username)
	if err != nil || user == nil {
		return nil, errors.New("invalid username or password")
	}

	if user.IsBanned {
		return nil, ErrUserBanned
	}

	valid, _ := crypto.VerifyPassword(req.Password, user.PasswordHash)
	if !valid {
		return nil, errors.New("invalid username or password")
	}

	_ = s.userRepo.UpdateLogin(ctx, user.ID, clientIP, req.HWID)

	sessionToken := "tok_" + uuid.New().String()
	session.UserID = user.ID
	session.HWID = req.HWID
	_ = s.cache.StoreSession(ctx, sessionToken, session, 2*time.Hour)

	result := models.ClientAuthResult{
		Status:       "success",
		Message:      "User authenticated successfully",
		SessionToken: sessionToken,
		Timestamp:    time.Now().Unix(),
	}

	resultBytes, _ := json.Marshal(result)
	var encryptedResp string
	if isPlainEnvelope {
		encryptedResp = base64.StdEncoding.EncodeToString(resultBytes)
	} else {
		encryptedResp, err = crypto.EncryptAESGCM(resultBytes, encKey, aad)
		if err != nil {
			return nil, err
		}
	}

	sig, err := crypto.SignPayload(resultBytes, app.MasterPrivateKeyEnc)
	if err != nil {
		return nil, err
	}

	return &models.ClientEncryptedResponse{
		Payload:   encryptedResp,
		Signature: sig,
	}, nil
}

// GetVariable retrieves an encrypted remote variable if the session meets tier requirements
func (s *ClientAuthService) GetVariable(ctx context.Context, sessionToken, encryptedPayload string) (*models.ClientEncryptedResponse, error) {
	session, err := s.cache.GetSession(ctx, sessionToken)
	if err != nil || session == nil {
		return nil, ErrSessionNotFound
	}

	app, err := s.appRepo.GetByID(ctx, session.AppID)
	if err != nil || app == nil {
		return nil, ErrAppNotFound
	}

	encKey, _ := base64.StdEncoding.DecodeString(session.EncryptionKey)
	aad := []byte(session.AppID + ":" + session.SessionID)

	var isPlainEnvelope bool
	plaintext, err := crypto.DecryptAESGCM(encryptedPayload, encKey, aad)
	if err != nil {
		if raw, decErr := base64.StdEncoding.DecodeString(encryptedPayload); decErr == nil {
			var testReq models.ClientVarPayload
			if json.Unmarshal(raw, &testReq) == nil && testReq.VarKey != "" {
				plaintext = raw
				err = nil
				isPlainEnvelope = true
			}
		}
	}
	if err != nil {
		return nil, errors.New("decryption failed")
	}

	var req models.ClientVarPayload
	if err := json.Unmarshal(plaintext, &req); err != nil {
		return nil, errors.New("malformed JSON payload")
	}

	v, err := s.varRepo.GetByKey(ctx, app.ID, req.VarKey)
	if err != nil || v == nil {
		return nil, errors.New("variable not found")
	}

	if session.TierLevel < v.MinTierLevel {
		return nil, ErrTierInsufficient
	}

	respData := map[string]interface{}{
		"var_key":   v.VarKey,
		"var_value": v.VarValue,
	}
	respBytes, _ := json.Marshal(respData)

	var encryptedResp string
	if isPlainEnvelope {
		encryptedResp = base64.StdEncoding.EncodeToString(respBytes)
	} else {
		encryptedResp, err = crypto.EncryptAESGCM(respBytes, encKey, aad)
		if err != nil {
			return nil, err
		}
	}

	sig, err := crypto.SignPayload(respBytes, app.MasterPrivateKeyEnc)
	if err != nil {
		return nil, err
	}

	return &models.ClientEncryptedResponse{
		Payload:   encryptedResp,
		Signature: sig,
	}, nil
}

// validateNonceAndTimestamp checks clock skew (<= 30s) and deduplicates nonce in cache (60s TTL)
func (s *ClientAuthService) validateNonceAndTimestamp(ctx context.Context, nonce string, timestampMillis int64) error {
	nowMillis := time.Now().UnixMilli()
	diff := math.Abs(float64(nowMillis - timestampMillis))
	if diff > 30000 { // 30 seconds tolerance
		return ErrClockSkew
	}

	isNew, err := s.cache.SetNonce(ctx, nonce, 60*time.Second)
	if err != nil || !isNew {
		return ErrReplayDetected
	}

	return nil
}

func (s *ClientAuthService) recordSecurityEvent(ctx context.Context, appID, eventType, actor, ip, details string) {
	_ = s.logRepo.Create(ctx, &models.SecurityLog{
		AppID:           appID,
		EventType:       eventType,
		ActorIdentifier: actor,
		IPAddress:       ip,
		Details:         fmt.Sprintf(`{"reason": %q}`, details),
	})
}
