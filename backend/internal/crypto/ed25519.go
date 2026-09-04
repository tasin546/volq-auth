package crypto

import (
	"crypto/ed25519"
	"crypto/rand"
	"encoding/base64"
	"errors"
)

// GenerateEd25519KeyPair generates a new master Ed25519 keypair for an application
func GenerateEd25519KeyPair() (pubKeyBase64 string, privKeyBase64 string, err error) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		return "", "", err
	}

	pubB64 := base64.StdEncoding.EncodeToString(pub)
	privB64 := base64.StdEncoding.EncodeToString(priv)
	return pubB64, privB64, nil
}

// SignPayload signs arbitrary bytes using an Ed25519 private key (Base64)
func SignPayload(payload []byte, privKeyBase64 string) (string, error) {
	privBytes, err := base64.StdEncoding.DecodeString(privKeyBase64)
	if err != nil {
		return "", errors.New("failed to decode private key")
	}

	if len(privBytes) != ed25519.PrivateKeySize {
		return "", errors.New("invalid private key size for Ed25519")
	}

	privKey := ed25519.PrivateKey(privBytes)
	signature := ed25519.Sign(privKey, payload)
	return base64.StdEncoding.EncodeToString(signature), nil
}

// VerifySignature verifies an Ed25519 signature against a public key (Base64)
func VerifySignature(payload []byte, signatureBase64 string, pubKeyBase64 string) bool {
	pubBytes, err := base64.StdEncoding.DecodeString(pubKeyBase64)
	if err != nil || len(pubBytes) != ed25519.PublicKeySize {
		return false
	}

	sigBytes, err := base64.StdEncoding.DecodeString(signatureBase64)
	if err != nil || len(sigBytes) != ed25519.SignatureSize {
		return false
	}

	return ed25519.Verify(ed25519.PublicKey(pubBytes), payload, sigBytes)
}
