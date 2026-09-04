package crypto

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io"

	"golang.org/x/crypto/curve25519"
	"golang.org/x/crypto/hkdf"
)

// SessionKeys contains derived symmetric keys for an authenticated session
type SessionKeys struct {
	EncryptionKey []byte // 32 bytes for AES-256-GCM
	MACKey        []byte // 32 bytes for HMAC-SHA256
}

// GenerateEphemeralCurve25519 generates an ephemeral private/public Curve25519 keypair
func GenerateEphemeralCurve25519() (privateKey [32]byte, publicKey [32]byte, err error) {
	if _, err = io.ReadFull(rand.Reader, privateKey[:]); err != nil {
		return privateKey, publicKey, err
	}

	// Clamp the scalar per Curve25519 RFC 7748
	curve25519.ScalarBaseMult(&publicKey, &privateKey)
	return privateKey, publicKey, nil
}

// ComputeSharedSecret computes X25519 shared secret between our private key and peer's public key
func ComputeSharedSecret(ourPrivate [32]byte, peerPublic [32]byte) ([]byte, error) {
	sharedSecret, err := curve25519.X25519(ourPrivate[:], peerPublic[:])
	if err != nil {
		return nil, err
	}

	// Guard against all-zero shared secret (weak points on curve)
	var allZero bool = true
	for _, b := range sharedSecret {
		if b != 0 {
			allZero = false
			break
		}
	}
	if allZero {
		return nil, errors.New("computed shared secret is invalid (weak curve point)")
	}

	return sharedSecret, nil
}

// DeriveSessionKeys uses HKDF-SHA256 to derive AES-256 session key and HMAC key from the shared secret
func DeriveSessionKeys(sharedSecret []byte, salt []byte, info []byte) (*SessionKeys, error) {
	if len(salt) == 0 {
		salt = []byte("VOLQ-AUTH-ECDH-SALT-v1")
	}
	if len(info) == 0 {
		info = []byte("VOLQ-SESSION-DERIVATION")
	}

	hkdfReader := hkdf.New(sha256.New, sharedSecret, salt, info)

	keys := &SessionKeys{
		EncryptionKey: make([]byte, 32),
		MACKey:        make([]byte, 32),
	}

	if _, err := io.ReadFull(hkdfReader, keys.EncryptionKey); err != nil {
		return nil, err
	}
	if _, err := io.ReadFull(hkdfReader, keys.MACKey); err != nil {
		return nil, err
	}

	return keys, nil
}

// Base64ToKey32 parses a base64 string into a [32]byte key
func Base64ToKey32(b64 string) ([32]byte, error) {
	var key [32]byte
	bytes, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		return key, err
	}
	if len(bytes) != 32 {
		return key, errors.New("key must be exactly 32 bytes")
	}
	copy(key[:], bytes)
	return key, nil
}

// Key32ToBase64 encodes a [32]byte key into base64 string
func Key32ToBase64(key [32]byte) string {
	return base64.StdEncoding.EncodeToString(key[:])
}
