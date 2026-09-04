package repository

import (
	"context"
	"database/sql"
	"errors"

	"github.com/volq-auth/volq-auth/internal/database"
	"github.com/volq-auth/volq-auth/internal/models"
)

type SQLAppRepository struct {
	db *database.DB
}

func NewSQLAppRepository(db *database.DB) *SQLAppRepository {
	return &SQLAppRepository{db: db}
}

func (r *SQLAppRepository) Create(ctx context.Context, app *models.Application) error {
	query := `
		INSERT INTO applications (
			developer_id, name, secret_hash, master_public_key, master_private_key_enc,
			version, download_url, integrity_hash, is_paused, hwid_lock_enabled,
			hwid_cooldown_days, webhook_url, webhook_enabled
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
		RETURNING id, created_at, updated_at
	`
	return r.db.QueryRowContext(ctx, query,
		app.DeveloperID, app.Name, app.SecretHash, app.MasterPublicKey, app.MasterPrivateKeyEnc,
		app.Version, app.DownloadURL, app.IntegrityHash, app.IsPaused, app.HWIDLockEnabled,
		app.HWIDCooldownDays, app.WebhookURL, app.WebhookEnabled,
	).Scan(&app.ID, &app.CreatedAt, &app.UpdatedAt)
}

func (r *SQLAppRepository) GetByID(ctx context.Context, id string) (*models.Application, error) {
	query := `
		SELECT id, developer_id, name, secret_hash, master_public_key, master_private_key_enc,
		       version, COALESCE(download_url, ''), COALESCE(integrity_hash, ''), is_paused,
		       hwid_lock_enabled, hwid_cooldown_days, COALESCE(webhook_url, ''), webhook_enabled,
		       created_at, updated_at
		FROM applications WHERE id = $1
	`
	app := &models.Application{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&app.ID, &app.DeveloperID, &app.Name, &app.SecretHash, &app.MasterPublicKey, &app.MasterPrivateKeyEnc,
		&app.Version, &app.DownloadURL, &app.IntegrityHash, &app.IsPaused,
		&app.HWIDLockEnabled, &app.HWIDCooldownDays, &app.WebhookURL, &app.WebhookEnabled,
		&app.CreatedAt, &app.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return app, err
}

func (r *SQLAppRepository) ListByDeveloper(ctx context.Context, developerID string) ([]models.Application, error) {
	query := `
		SELECT id, developer_id, name, secret_hash, master_public_key, master_private_key_enc,
		       version, COALESCE(download_url, ''), COALESCE(integrity_hash, ''), is_paused,
		       hwid_lock_enabled, hwid_cooldown_days, COALESCE(webhook_url, ''), webhook_enabled,
		       created_at, updated_at
		FROM applications WHERE developer_id = $1 ORDER BY created_at DESC
	`
	rows, err := r.db.QueryContext(ctx, query, developerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var apps []models.Application
	for rows.Next() {
		var app models.Application
		if err := rows.Scan(
			&app.ID, &app.DeveloperID, &app.Name, &app.SecretHash, &app.MasterPublicKey, &app.MasterPrivateKeyEnc,
			&app.Version, &app.DownloadURL, &app.IntegrityHash, &app.IsPaused,
			&app.HWIDLockEnabled, &app.HWIDCooldownDays, &app.WebhookURL, &app.WebhookEnabled,
			&app.CreatedAt, &app.UpdatedAt,
		); err != nil {
			return nil, err
		}
		apps = append(apps, app)
	}
	return apps, nil
}

func (r *SQLAppRepository) Update(ctx context.Context, app *models.Application) error {
	query := `
		UPDATE applications SET
			name = $1, version = $2, download_url = $3, integrity_hash = $4,
			is_paused = $5, hwid_lock_enabled = $6, hwid_cooldown_days = $7,
			webhook_url = $8, webhook_enabled = $9, updated_at = NOW()
		WHERE id = $10
	`
	_, err := r.db.ExecContext(ctx, query,
		app.Name, app.Version, app.DownloadURL, app.IntegrityHash,
		app.IsPaused, app.HWIDLockEnabled, app.HWIDCooldownDays,
		app.WebhookURL, app.WebhookEnabled, app.ID,
	)
	return err
}

func (r *SQLAppRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM applications WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

// Developer methods
func (r *SQLAppRepository) CreateDeveloper(ctx context.Context, dev *models.Developer) error {
	query := `
		INSERT INTO developers (username, email, password_hash, role)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at, updated_at
	`
	return r.db.QueryRowContext(ctx, query, dev.Username, dev.Email, dev.PasswordHash, dev.Role).
		Scan(&dev.ID, &dev.CreatedAt, &dev.UpdatedAt)
}

func (r *SQLAppRepository) GetDeveloperByUsername(ctx context.Context, username string) (*models.Developer, error) {
	query := `
		SELECT id, username, email, password_hash, COALESCE(two_factor_secret, ''), two_factor_enabled, role, created_at, updated_at
		FROM developers WHERE username = $1 OR email = $1
	`
	dev := &models.Developer{}
	err := r.db.QueryRowContext(ctx, query, username).Scan(
		&dev.ID, &dev.Username, &dev.Email, &dev.PasswordHash, &dev.TwoFactorSecret, &dev.TwoFactorEnabled, &dev.Role, &dev.CreatedAt, &dev.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return dev, err
}

func (r *SQLAppRepository) GetDeveloperByID(ctx context.Context, id string) (*models.Developer, error) {
	query := `
		SELECT id, username, email, password_hash, COALESCE(two_factor_secret, ''), two_factor_enabled, role, created_at, updated_at
		FROM developers WHERE id = $1
	`
	dev := &models.Developer{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&dev.ID, &dev.Username, &dev.Email, &dev.PasswordHash, &dev.TwoFactorSecret, &dev.TwoFactorEnabled, &dev.Role, &dev.CreatedAt, &dev.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return dev, err
}
