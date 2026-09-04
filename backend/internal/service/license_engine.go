package service

import (
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/volq-auth/volq-auth/internal/models"
)

const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // Excluded confusing chars like 0, O, 1, I

type LicenseEngine struct{}

func NewLicenseEngine() *LicenseEngine {
	return &LicenseEngine{}
}

// GenerateKeyFromMask creates a single license key following a mask pattern.
// 'X' is replaced with random uppercase letters/numbers.
// Example mask: "VOLQ-XXXX-XXXX-XXXX" -> "VOLQ-9F2B-K7M3-PA94"
func (e *LicenseEngine) GenerateKeyFromMask(mask string) (string, error) {
	if mask == "" {
		mask = "VOLQ-XXXX-XXXX-XXXX"
	}

	var sb strings.Builder
	charsetLen := big.NewInt(int64(len(charset)))

	for _, ch := range mask {
		if ch == 'X' || ch == 'x' || ch == '*' {
			idx, err := rand.Int(rand.Reader, charsetLen)
			if err != nil {
				return "", err
			}
			sb.WriteByte(charset[idx.Int64()])
		} else {
			sb.WriteRune(ch)
		}
	}

	return sb.String(), nil
}

// GenerateBatch creates count license keys using the specified mask
func (e *LicenseEngine) GenerateBatch(mask string, count int) ([]string, error) {
	if count <= 0 || count > 10000 {
		return nil, errors.New("batch count must be between 1 and 10,000")
	}

	keys := make([]string, 0, count)
	seen := make(map[string]bool, count)

	for len(keys) < count {
		key, err := e.GenerateKeyFromMask(mask)
		if err != nil {
			return nil, err
		}
		if !seen[key] {
			seen[key] = true
			keys = append(keys, key)
		}
	}

	return keys, nil
}

// CalculateExpiration computes the expiration timestamp for rolling licenses upon activation
func (e *LicenseEngine) CalculateExpiration(lic *models.License, activationTime time.Time) *time.Time {
	if lic.IsLifetime || lic.DurationSeconds <= 0 {
		return nil // Lifetime license never expires
	}

	exp := activationTime.Add(time.Duration(lic.DurationSeconds) * time.Second)
	return &exp
}

// FormatKeysCSV exports a list of licenses to CSV format
func (e *LicenseEngine) FormatKeysCSV(licenses []models.License) string {
	var sb strings.Builder
	sb.WriteString("LicenseKey,Status,Tier,DurationSeconds,ExpiresAt,Note\n")
	for _, l := range licenses {
		expiresStr := "Lifetime"
		if l.ExpiresAt != nil {
			expiresStr = l.ExpiresAt.Format(time.RFC3339)
		}
		sb.WriteString(fmt.Sprintf("%s,%s,%s,%d,%s,\"%s\"\n",
			l.LicenseKey, l.Status, l.SubscriptionName, l.DurationSeconds, expiresStr, l.Note))
	}
	return sb.String()
}
