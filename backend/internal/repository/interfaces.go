package repository

import (
	"context"
	"time"

	"github.com/volq-auth/volq-auth/internal/models"
)

type AppRepository interface {
	Create(ctx context.Context, app *models.Application) error
	GetByID(ctx context.Context, id string) (*models.Application, error)
	ListByDeveloper(ctx context.Context, developerID string) ([]models.Application, error)
	Update(ctx context.Context, app *models.Application) error
	Delete(ctx context.Context, id string) error
	CreateDeveloper(ctx context.Context, dev *models.Developer) error
	GetDeveloperByUsername(ctx context.Context, username string) (*models.Developer, error)
	GetDeveloperByID(ctx context.Context, id string) (*models.Developer, error)
}

type LicenseRepository interface {
	Create(ctx context.Context, lic *models.License) error
	BulkCreate(ctx context.Context, licenses []*models.License) error
	GetByKey(ctx context.Context, appID, key string) (*models.License, error)
	GetByID(ctx context.Context, id string) (*models.License, error)
	ListByApp(ctx context.Context, appID string, status string, search string, limit, offset int) ([]models.License, int, error)
	Activate(ctx context.Context, id string, hwid string, expiresAt *time.Time) error
	ResetHWID(ctx context.Context, id string) error
	SetStatus(ctx context.Context, id string, status string, reason *string) error
	Extend(ctx context.Context, id string, additionalSeconds int64) error
	Delete(ctx context.Context, id string) error
	CreateSubscription(ctx context.Context, sub *models.Subscription) error
	ListSubscriptionsByApp(ctx context.Context, appID string) ([]models.Subscription, error)
}

type UserRepository interface {
	Create(ctx context.Context, user *models.AppUser) error
	GetByUsername(ctx context.Context, appID, username string) (*models.AppUser, error)
	ListByApp(ctx context.Context, appID string, search string, limit, offset int) ([]models.AppUser, int, error)
	UpdateLogin(ctx context.Context, id string, ip string, hwid string) error
	SetBan(ctx context.Context, id string, isBanned bool, reason *string) error
	Delete(ctx context.Context, id string) error
}

type VariableRepository interface {
	Create(ctx context.Context, v *models.Variable) error
	GetByKey(ctx context.Context, appID, varKey string) (*models.Variable, error)
	ListByApp(ctx context.Context, appID string) ([]models.Variable, error)
	Delete(ctx context.Context, id string) error
}

type FileRepository interface {
	Create(ctx context.Context, f *models.File) error
	GetByName(ctx context.Context, appID, fileName string) (*models.File, error)
	ListByApp(ctx context.Context, appID string) ([]models.File, error)
	Delete(ctx context.Context, id string) error
}

type LogRepository interface {
	Create(ctx context.Context, log *models.SecurityLog) error
	ListByApp(ctx context.Context, appID string, limit int) ([]models.SecurityLog, error)
}

type ResellerRepository interface {
	Create(ctx context.Context, res *models.Reseller) error
	GetByUsername(ctx context.Context, username string) (*models.Reseller, error)
	GetByID(ctx context.Context, id string) (*models.Reseller, error)
	ListByApp(ctx context.Context, appID string) ([]models.Reseller, error)
	DeductCredits(ctx context.Context, resellerID string, creditsToDeduct int) (bool, error)
	AddCredits(ctx context.Context, resellerID string, creditsToAdd int) error
	LogAction(ctx context.Context, resellerID, appID, action, licenseKey string, creditsUsed int) error
}
