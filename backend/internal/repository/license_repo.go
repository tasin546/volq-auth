package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/volq-auth/volq-auth/internal/database"
	"github.com/volq-auth/volq-auth/internal/models"
)

type SQLLicenseRepository struct {
	db *database.DB
}

func NewSQLLicenseRepository(db *database.DB) *SQLLicenseRepository {
	return &SQLLicenseRepository{db: db}
}

func (r *SQLLicenseRepository) Create(ctx context.Context, lic *models.License) error {
	query := `
		INSERT INTO licenses (
			app_id, subscription_id, license_key, duration_seconds, is_lifetime,
			max_hwids, status, created_by, note
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id, created_at
	`
	return r.db.QueryRowContext(ctx, query,
		lic.AppID, lic.SubscriptionID, lic.LicenseKey, lic.DurationSeconds, lic.IsLifetime,
		lic.MaxHWIDs, lic.Status, lic.CreatedBy, lic.Note,
	).Scan(&lic.ID, &lic.CreatedAt)
}

func (r *SQLLicenseRepository) BulkCreate(ctx context.Context, licenses []*models.License) error {
	if len(licenses) == 0 {
		return nil
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO licenses (
			app_id, subscription_id, license_key, duration_seconds, is_lifetime,
			max_hwids, status, created_by, note
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, lic := range licenses {
		_, err := stmt.ExecContext(ctx,
			lic.AppID, lic.SubscriptionID, lic.LicenseKey, lic.DurationSeconds, lic.IsLifetime,
			lic.MaxHWIDs, lic.Status, lic.CreatedBy, lic.Note,
		)
		if err != nil {
			return fmt.Errorf("bulk insert failure on key %s: %w", lic.LicenseKey, err)
		}
	}

	return tx.Commit()
}

func (r *SQLLicenseRepository) GetByKey(ctx context.Context, appID, key string) (*models.License, error) {
	query := `
		SELECT l.id, l.app_id, l.subscription_id, COALESCE(s.name, 'Default'), COALESCE(s.tier_level, 1),
		       l.license_key, l.duration_seconds, l.is_lifetime, l.hwid_hash, l.max_hwids,
		       l.status, l.activated_at, l.expires_at, l.last_hwid_reset, l.banned_reason,
		       l.created_by, COALESCE(l.note, ''), l.created_at
		FROM licenses l
		LEFT JOIN subscriptions s ON l.subscription_id = s.id
		WHERE l.app_id = $1 AND l.license_key = $2
	`
	lic := &models.License{}
	err := r.db.QueryRowContext(ctx, query, appID, key).Scan(
		&lic.ID, &lic.AppID, &lic.SubscriptionID, &lic.SubscriptionName, &lic.TierLevel,
		&lic.LicenseKey, &lic.DurationSeconds, &lic.IsLifetime, &lic.HWIDHash, &lic.MaxHWIDs,
		&lic.Status, &lic.ActivatedAt, &lic.ExpiresAt, &lic.LastHWIDReset, &lic.BannedReason,
		&lic.CreatedBy, &lic.Note, &lic.CreatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return lic, err
}

func (r *SQLLicenseRepository) GetByID(ctx context.Context, id string) (*models.License, error) {
	query := `
		SELECT l.id, l.app_id, l.subscription_id, COALESCE(s.name, 'Default'), COALESCE(s.tier_level, 1),
		       l.license_key, l.duration_seconds, l.is_lifetime, l.hwid_hash, l.max_hwids,
		       l.status, l.activated_at, l.expires_at, l.last_hwid_reset, l.banned_reason,
		       l.created_by, COALESCE(l.note, ''), l.created_at
		FROM licenses l
		LEFT JOIN subscriptions s ON l.subscription_id = s.id
		WHERE l.id = $1
	`
	lic := &models.License{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&lic.ID, &lic.AppID, &lic.SubscriptionID, &lic.SubscriptionName, &lic.TierLevel,
		&lic.LicenseKey, &lic.DurationSeconds, &lic.IsLifetime, &lic.HWIDHash, &lic.MaxHWIDs,
		&lic.Status, &lic.ActivatedAt, &lic.ExpiresAt, &lic.LastHWIDReset, &lic.BannedReason,
		&lic.CreatedBy, &lic.Note, &lic.CreatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return lic, err
}

func (r *SQLLicenseRepository) ListByApp(ctx context.Context, appID string, status string, search string, limit, offset int) ([]models.License, int, error) {
	var whereConditions []string
	var args []interface{}
	argIdx := 1

	whereConditions = append(whereConditions, fmt.Sprintf("l.app_id = $%d", argIdx))
	args = append(args, appID)
	argIdx++

	if status != "" && status != "all" {
		whereConditions = append(whereConditions, fmt.Sprintf("l.status = $%d", argIdx))
		args = append(args, status)
		argIdx++
	}

	if search != "" {
		whereConditions = append(whereConditions, fmt.Sprintf("(l.license_key ILIKE $%d OR l.note ILIKE $%d)", argIdx, argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}

	whereClause := strings.Join(whereConditions, " AND ")

	// Count total
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM licenses l WHERE %s", whereClause)
	var total int
	if err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	// Fetch page
	dataQuery := fmt.Sprintf(`
		SELECT l.id, l.app_id, l.subscription_id, COALESCE(s.name, 'Default'), COALESCE(s.tier_level, 1),
		       l.license_key, l.duration_seconds, l.is_lifetime, l.hwid_hash, l.max_hwids,
		       l.status, l.activated_at, l.expires_at, l.last_hwid_reset, l.banned_reason,
		       l.created_by, COALESCE(l.note, ''), l.created_at
		FROM licenses l
		LEFT JOIN subscriptions s ON l.subscription_id = s.id
		WHERE %s
		ORDER BY l.created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)

	args = append(args, limit, offset)
	rows, err := r.db.QueryContext(ctx, dataQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var licenses []models.License
	for rows.Next() {
		var lic models.License
		if err := rows.Scan(
			&lic.ID, &lic.AppID, &lic.SubscriptionID, &lic.SubscriptionName, &lic.TierLevel,
			&lic.LicenseKey, &lic.DurationSeconds, &lic.IsLifetime, &lic.HWIDHash, &lic.MaxHWIDs,
			&lic.Status, &lic.ActivatedAt, &lic.ExpiresAt, &lic.LastHWIDReset, &lic.BannedReason,
			&lic.CreatedBy, &lic.Note, &lic.CreatedAt,
		); err != nil {
			return nil, 0, err
		}
		licenses = append(licenses, lic)
	}

	return licenses, total, nil
}

func (r *SQLLicenseRepository) Activate(ctx context.Context, id string, hwid string, expiresAt *time.Time) error {
	query := `
		UPDATE licenses SET
			status = 'active',
			hwid_hash = $1,
			activated_at = NOW(),
			expires_at = $2
		WHERE id = $3
	`
	_, err := r.db.ExecContext(ctx, query, hwid, expiresAt, id)
	return err
}

func (r *SQLLicenseRepository) ResetHWID(ctx context.Context, id string) error {
	query := `
		UPDATE licenses SET
			hwid_hash = NULL,
			hwid_list = '{}',
			last_hwid_reset = NOW()
		WHERE id = $1
	`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

func (r *SQLLicenseRepository) SetStatus(ctx context.Context, id string, status string, reason *string) error {
	query := `UPDATE licenses SET status = $1, banned_reason = $2 WHERE id = $3`
	_, err := r.db.ExecContext(ctx, query, status, reason, id)
	return err
}

func (r *SQLLicenseRepository) Extend(ctx context.Context, id string, additionalSeconds int64) error {
	query := `
		UPDATE licenses SET
			duration_seconds = duration_seconds + $1,
			expires_at = CASE
				WHEN expires_at IS NOT NULL THEN expires_at + ($1 || ' seconds')::INTERVAL
				ELSE expires_at
			END
		WHERE id = $2
	`
	_, err := r.db.ExecContext(ctx, query, additionalSeconds, id)
	return err
}

func (r *SQLLicenseRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM licenses WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

// Subscriptions
func (r *SQLLicenseRepository) CreateSubscription(ctx context.Context, sub *models.Subscription) error {
	query := `
		INSERT INTO subscriptions (app_id, name, tier_level)
		VALUES ($1, $2, $3)
		RETURNING id, created_at
	`
	return r.db.QueryRowContext(ctx, query, sub.AppID, sub.Name, sub.TierLevel).
		Scan(&sub.ID, &sub.CreatedAt)
}

func (r *SQLLicenseRepository) ListSubscriptionsByApp(ctx context.Context, appID string) ([]models.Subscription, error) {
	query := `SELECT id, app_id, name, tier_level, created_at FROM subscriptions WHERE app_id = $1 ORDER BY tier_level ASC`
	rows, err := r.db.QueryContext(ctx, query, appID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var subs []models.Subscription
	for rows.Next() {
		var s models.Subscription
		if err := rows.Scan(&s.ID, &s.AppID, &s.Name, &s.TierLevel, &s.CreatedAt); err != nil {
			return nil, err
		}
		subs = append(subs, s)
	}
	return subs, nil
}
