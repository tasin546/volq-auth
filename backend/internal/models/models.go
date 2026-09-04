package models

import (
	"time"
)

// Developer represents a platform owner or vendor
type Developer struct {
	ID                string    `json:"id"`
	Username          string    `json:"username"`
	Email             string    `json:"email"`
	PasswordHash      string    `json:"password_hash,omitempty"`
	TwoFactorSecret   string    `json:"two_factor_secret,omitempty"`
	TwoFactorEnabled  bool      `json:"two_factor_enabled"`
	Role              string    `json:"role"` // admin, developer, reseller
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

// Application represents a scoped workspace with master Ed25519 signing keys
type Application struct {
	ID                  string    `json:"id"`
	DeveloperID         string    `json:"developer_id"`
	Name                string    `json:"name"`
	SecretHash          string    `json:"secret_hash,omitempty"`
	MasterPublicKey     string    `json:"master_public_key"` // Base64
	MasterPrivateKeyEnc string    `json:"master_private_key_enc,omitempty"` // Base64 encrypted
	Version             string    `json:"version"`
	DownloadURL         string    `json:"download_url"`
	IntegrityHash       string    `json:"integrity_hash"` // SHA-256 binary hash
	IsPaused            bool      `json:"is_paused"`
	HWIDLockEnabled     bool      `json:"hwid_lock_enabled"`
	HWIDCooldownDays    int       `json:"hwid_cooldown_days"`
	WebhookURL          string    `json:"webhook_url"`
	WebhookEnabled      bool      `json:"webhook_enabled"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

// Subscription tier
type Subscription struct {
	ID        string    `json:"id"`
	AppID     string    `json:"app_id"`
	Name      string    `json:"name"`
	TierLevel int       `json:"tier_level"`
	CreatedAt time.Time `json:"created_at"`
}

// License status constants
const (
	LicenseStatusUnactivated = "unactivated"
	LicenseStatusActive      = "active"
	LicenseStatusPaused      = "paused"
	LicenseStatusBanned      = "banned"
	LicenseStatusExpired     = "expired"
)

// License represents a generated software license
type License struct {
	ID              string     `json:"id"`
	AppID           string     `json:"app_id"`
	SubscriptionID  *string    `json:"subscription_id,omitempty"`
	SubscriptionName string    `json:"subscription_name,omitempty"`
	TierLevel       int        `json:"tier_level"`
	LicenseKey      string     `json:"license_key"`
	DurationSeconds int64      `json:"duration_seconds"` // 0 = Lifetime
	IsLifetime      bool       `json:"is_lifetime"`
	HWIDHash        *string    `json:"hwid_hash,omitempty"`
	HWIDList        []string   `json:"hwid_list"`
	MaxHWIDs        int        `json:"max_hwids"`
	Status          string     `json:"status"`
	ActivatedAt     *time.Time `json:"activated_at,omitempty"`
	ExpiresAt       *time.Time `json:"expires_at,omitempty"`
	LastHWIDReset   *time.Time `json:"last_hwid_reset,omitempty"`
	BannedReason    *string    `json:"banned_reason,omitempty"`
	CreatedBy       *string    `json:"created_by,omitempty"`
	Note            string     `json:"note"`
	CreatedAt       time.Time  `json:"created_at"`
}

// AppUser represents an end-user in Mode B (User/Pass Auth)
type AppUser struct {
	ID           string     `json:"id"`
	AppID        string     `json:"app_id"`
	Username     string     `json:"username"`
	PasswordHash string     `json:"password_hash,omitempty"`
	LicenseID    *string    `json:"license_id,omitempty"`
	HWIDHash     *string    `json:"hwid_hash,omitempty"`
	IPAddress    *string    `json:"ip_address,omitempty"`
	IsBanned     bool       `json:"is_banned"`
	BanReason    *string    `json:"ban_reason,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	LastLoginAt  *time.Time `json:"last_login_at,omitempty"`
}

// Variable represents an encrypted remote variable
type Variable struct {
	ID           string    `json:"id"`
	AppID        string    `json:"app_id"`
	VarKey       string    `json:"var_key"`
	VarValue     string    `json:"var_value"`
	MinTierLevel int       `json:"min_tier_level"`
	IsSecret     bool      `json:"is_secret"`
	CreatedAt    time.Time `json:"created_at"`
}

// File represents a hosted payload or DLL
type File struct {
	ID            string    `json:"id"`
	AppID         string    `json:"app_id"`
	FileName      string    `json:"file_name"`
	R2StorageKey  string    `json:"r2_storage_key"`
	SHA256Hash    string    `json:"sha256_hash"`
	FileSizeBytes int64     `json:"file_size_bytes"`
	MinTierLevel  int       `json:"min_tier_level"`
	CreatedAt     time.Time `json:"created_at"`
}

// Reseller represents a sub-admin vendor account
type Reseller struct {
	ID           string    `json:"id"`
	DeveloperID  string    `json:"developer_id"`
	AppID        string    `json:"app_id"`
	Username     string    `json:"username"`
	PasswordHash string    `json:"password_hash,omitempty"`
	Credits      int       `json:"credits"`
	CanResetHWID bool      `json:"can_reset_hwid"`
	IsActive     bool      `json:"is_active"`
	CreatedAt    time.Time `json:"created_at"`
}

// SecurityLog represents an audit log event
type SecurityLog struct {
	ID              int64     `json:"id"`
	AppID           string    `json:"app_id"`
	EventType       string    `json:"event_type"`
	ActorIdentifier string    `json:"actor_identifier"`
	IPAddress       string    `json:"ip_address"`
	Details         string    `json:"details"` // JSON string
	CreatedAt       time.Time `json:"created_at"`
}

// ============================================================================
// CLIENT SDK PAYLOAD CONTRACTS
// ============================================================================

// ClientInitRequest is sent in plaintext on /api/v1/client/init
type ClientInitRequest struct {
	AppID        string `json:"app_id" binding:"required"`
	ClientPubKey string `json:"client_pub_key" binding:"required"` // Base64 X25519
	Nonce        string `json:"nonce" binding:"required"`          // 16-32 char hex/b64
	Timestamp    int64  `json:"timestamp" binding:"required"`      // Unix millis
}

// ClientInitResponse is returned by /api/v1/client/init
type ClientInitResponse struct {
	SessionID   string `json:"session_id"`
	ServerPubKey string `json:"server_pub_key"` // Base64 X25519
	AppVersion  string `json:"app_version"`
	Signature   string `json:"signature"`      // Ed25519 signature of (SessionID + ServerPubKey + AppVersion)
}

// ClientEncryptedRequest envelope for subsequent endpoints
type ClientEncryptedRequest struct {
	SessionID string `json:"session_id" binding:"required"`
	Payload   string `json:"payload" binding:"required"` // AES-256-GCM ciphertext (Base64)
}

// ClientEncryptedResponse envelope
type ClientEncryptedResponse struct {
	Payload   string `json:"payload"`   // AES-256-GCM ciphertext (Base64)
	Signature string `json:"signature"` // Ed25519 signature of the raw decrypted payload
}

// ClientLicensePayload is the decrypted body for /api/v1/client/license
type ClientLicensePayload struct {
	LicenseKey string `json:"license_key"`
	HWID       string `json:"hwid"`
	BinaryHash string `json:"binary_hash,omitempty"`
	Nonce      string `json:"nonce"`
	Timestamp  int64  `json:"timestamp"`
}

// ClientLoginPayload is the decrypted body for /api/v1/client/login (Mode B)
type ClientLoginPayload struct {
	Username   string `json:"username"`
	Password   string `json:"password"`
	HWID       string `json:"hwid"`
	BinaryHash string `json:"binary_hash,omitempty"`
	Nonce      string `json:"nonce"`
	Timestamp  int64  `json:"timestamp"`
}

// ClientVarPayload is the decrypted body for /api/v1/client/var
type ClientVarPayload struct {
	VarKey string `json:"var_key"`
}

// ClientAuthResult is returned inside the encrypted response on successful auth
type ClientAuthResult struct {
	Status       string             `json:"status"` // "success" or "error"
	Message      string             `json:"message"`
	Subscription ClientSubscription `json:"subscription"`
	SessionToken string             `json:"session_token"`
	Timestamp    int64              `json:"timestamp"`
}

type ClientSubscription struct {
	Name      string `json:"name"`
	TierLevel int    `json:"tier_level"`
	ExpiresAt int64  `json:"expires_at"` // Unix timestamp or 0 for lifetime
}
