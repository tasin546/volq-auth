package volqauth

import (
	"bytes"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"
)

type Subscription struct {
	Name      string `json:"name"`
	TierLevel int    `json:"tier_level"`
	ExpiresAt int64  `json:"expires_at"`
}

type AuthResult struct {
	Status       string       `json:"status"`
	Message      string       `json:"message"`
	Subscription Subscription `json:"subscription"`
	SessionToken string       `json:"session_token"`
}

type Client struct {
	appID           string
	version         string
	masterPublicKey string
	baseURL         string
	hwid            string
	sessionID       string
	httpClient      *http.Client
}

func NewClient(appID, version, masterPublicKey, baseURL string) *Client {
	return &Client{
		appID:           appID,
		version:         version,
		masterPublicKey: masterPublicKey,
		baseURL:         strings.TrimRight(baseURL, "/"),
		hwid:            generateHWID(),
		httpClient:      &http.Client{Timeout: 10 * time.Second},
	}
}

func (c *Client) GetHWID() string {
	return c.hwid
}

func (c *Client) Init() error {
	nonce := generateNonce()
	timestamp := time.Now().UnixMilli()

	clientPub := make([]byte, 32)
	rand.Read(clientPub)
	clientPubB64 := base64.StdEncoding.EncodeToString(clientPub)

	payload := map[string]interface{}{
		"app_id":         c.appID,
		"client_pub_key": clientPubB64,
		"nonce":          nonce,
		"timestamp":      timestamp,
	}

	data, _ := json.Marshal(payload)
	resp, err := c.httpClient.Post(c.baseURL+"/api/v1/client/init", "application/json", bytes.NewReader(data))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("init handshake failed with status: %d", resp.StatusCode)
	}

	var respBody struct {
		SessionID string `json:"session_id"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&respBody); err != nil {
		return err
	}

	c.sessionID = respBody.SessionID
	return nil
}

func (c *Client) AuthenticateLicense(licenseKey string) (*AuthResult, error) {
	if c.sessionID == "" {
		return nil, errors.New("client not initialized")
	}

	nonce := generateNonce()
	timestamp := time.Now().UnixMilli()

	payloadMap := map[string]interface{}{
		"license_key": licenseKey,
		"hwid":        c.hwid,
		"nonce":       nonce,
		"timestamp":   timestamp,
	}

	payloadJSON, _ := json.Marshal(payloadMap)
	// Base64 encoded payload envelope
	encryptedPayload := base64.StdEncoding.EncodeToString(payloadJSON)

	envelope := map[string]string{
		"session_id": c.sessionID,
		"payload":    encryptedPayload,
	}

	data, _ := json.Marshal(envelope)
	resp, err := c.httpClient.Post(c.baseURL+"/api/v1/client/license", "application/json", bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("authentication rejected with status: %d", resp.StatusCode)
	}

	var result AuthResult
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return &result, nil
}

func generateNonce() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func generateHWID() string {
	hostname, _ := os.Hostname()
	hasher := sha256.New()
	hasher.Write([]byte(hostname))
	return hex.EncodeToString(hasher.Sum(nil))
}
