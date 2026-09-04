package service

import (
	"errors"
	"fmt"
	"time"

	"github.com/volq-auth/volq-auth/internal/models"
)

var (
	ErrHWIDMismatch  = errors.New("HWID does not match bound device")
	ErrHWIDCooldown  = errors.New("HWID reset is on cooldown")
	ErrMaxHWIDsLimit = errors.New("maximum number of authorized devices reached")
)

type HWIDService struct{}

func NewHWIDService() *HWIDService {
	return &HWIDService{}
}

// ValidateHWID checks whether clientHWID matches the license or can be bound
func (s *HWIDService) ValidateHWID(lic *models.License, clientHWID string, hwidLockEnabled bool) (needsBinding bool, err error) {
	if !hwidLockEnabled {
		return false, nil // Application disabled HWID locking
	}

	if clientHWID == "" {
		return false, errors.New("hardware ID (HWID) is required")
	}

	// 1. First-use binding
	if lic.HWIDHash == nil || *lic.HWIDHash == "" {
		return true, nil
	}

	// 2. Primary HWID match
	if *lic.HWIDHash == clientHWID {
		return false, nil
	}

	// 3. Multi-device check
	for _, h := range lic.HWIDList {
		if h == clientHWID {
			return false, nil
		}
	}

	// 4. Can we add a new device under MaxHWIDs allowance?
	currentDevices := 1 + len(lic.HWIDList)
	if lic.MaxHWIDs > currentDevices {
		return true, nil // Can bind additional device
	}

	return false, ErrHWIDMismatch
}

// CheckCooldown checks whether an HWID reset is permitted based on application cooldown days
func (s *HWIDService) CheckCooldown(lic *models.License, cooldownDays int) error {
	if cooldownDays <= 0 || lic.LastHWIDReset == nil {
		return nil
	}

	allowedAt := lic.LastHWIDReset.AddDate(0, 0, cooldownDays)
	now := time.Now()
	if now.Before(allowedAt) {
		remaining := allowedAt.Sub(now)
		daysRemaining := int(remaining.Hours()/24) + 1
		return fmt.Errorf("%w: please wait %d more day(s)", ErrHWIDCooldown, daysRemaining)
	}

	return nil
}
