package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"io"
)

// EncryptAESGCM encrypts plaintext using AES-256-GCM with a 12-byte IV and optional AAD
// Returns: base64(IV + Ciphertext + Tag)
func EncryptAESGCM(plaintext []byte, key []byte, aad []byte) (string, error) {
	if len(key) != 32 {
		return "", errors.New("encryption key must be exactly 32 bytes for AES-256")
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	// 12-byte standard nonce for GCM
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	// Seal appends tag to ciphertext
	ciphertext := gcm.Seal(nonce, nonce, plaintext, aad)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// DecryptAESGCM decrypts a base64 encoded string containing (IV + Ciphertext + Tag) using AES-256-GCM and optional AAD
func DecryptAESGCM(encryptedBase64 string, key []byte, aad []byte) ([]byte, error) {
	if len(key) != 32 {
		return nil, errors.New("decryption key must be exactly 32 bytes for AES-256")
	}

	raw, err := base64.StdEncoding.DecodeString(encryptedBase64)
	if err != nil {
		return nil, errors.New("invalid base64 ciphertext")
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonceSize := gcm.NonceSize()
	if len(raw) < nonceSize {
		return nil, errors.New("ciphertext too short")
	}

	nonce, ciphertext := raw[:nonceSize], raw[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, aad)
	if err != nil {
		return nil, errors.New("decryption failed: authentication tag mismatch or corrupted data")
	}

	return plaintext, nil
}
