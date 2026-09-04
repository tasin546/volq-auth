package repository

import (
	"context"
	"database/sql"
	"errors"

	"github.com/volq-auth/volq-auth/internal/database"
	"github.com/volq-auth/volq-auth/internal/models"
)

type SQLResellerRepository struct {
	db *database.DB
}

func NewSQLResellerRepository(db *database.DB) *SQLResellerRepository {
	return &SQLResellerRepository{db: db}
}

func (r *SQLResellerRepository) Create(ctx context.Context, res *models.Reseller) error {
	query := `
		INSERT INTO resellers (developer_id, app_id, username, password_hash, credits, can_reset_hwid, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at
	`
	return r.db.QueryRowContext(ctx, query,
		res.DeveloperID, res.AppID, res.Username, res.PasswordHash, res.Credits, res.CanResetHWID, res.IsActive,
	).Scan(&res.ID, &res.CreatedAt)
}

func (r *SQLResellerRepository) GetByUsername(ctx context.Context, username string) (*models.Reseller, error) {
	query := `
		SELECT id, developer_id, app_id, username, password_hash, credits, can_reset_hwid, is_active, created_at
		FROM resellers
		WHERE username = $1
	`
	res := &models.Reseller{}
	err := r.db.QueryRowContext(ctx, query, username).Scan(
		&res.ID, &res.DeveloperID, &res.AppID, &res.Username, &res.PasswordHash,
		&res.Credits, &res.CanResetHWID, &res.IsActive, &res.CreatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return res, err
}

func (r *SQLResellerRepository) GetByID(ctx context.Context, id string) (*models.Reseller, error) {
	query := `
		SELECT id, developer_id, app_id, username, password_hash, credits, can_reset_hwid, is_active, created_at
		FROM resellers
		WHERE id = $1
	`
	res := &models.Reseller{}
	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&res.ID, &res.DeveloperID, &res.AppID, &res.Username, &res.PasswordHash,
		&res.Credits, &res.CanResetHWID, &res.IsActive, &res.CreatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return res, err
}

func (r *SQLResellerRepository) ListByApp(ctx context.Context, appID string) ([]models.Reseller, error) {
	query := `
		SELECT id, developer_id, app_id, username, credits, can_reset_hwid, is_active, created_at
		FROM resellers
		WHERE app_id = $1
		ORDER BY created_at DESC
	`
	rows, err := r.db.QueryContext(ctx, query, appID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.Reseller
	for rows.Next() {
		var res models.Reseller
		if err := rows.Scan(
			&res.ID, &res.DeveloperID, &res.AppID, &res.Username, &res.Credits,
			&res.CanResetHWID, &res.IsActive, &res.CreatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, res)
	}
	return list, nil
}

func (r *SQLResellerRepository) DeductCredits(ctx context.Context, resellerID string, creditsToDeduct int) (bool, error) {
	query := `
		UPDATE resellers
		SET credits = credits - $1
		WHERE id = $2 AND credits >= $1
	`
	res, err := r.db.ExecContext(ctx, query, creditsToDeduct, resellerID)
	if err != nil {
		return false, err
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return false, err
	}
	return rowsAffected > 0, nil
}

func (r *SQLResellerRepository) AddCredits(ctx context.Context, resellerID string, creditsToAdd int) error {
	query := `UPDATE resellers SET credits = credits + $1 WHERE id = $2`
	_, err := r.db.ExecContext(ctx, query, creditsToAdd, resellerID)
	return err
}

func (r *SQLResellerRepository) LogAction(ctx context.Context, resellerID, appID, action, licenseKey string, creditsUsed int) error {
	query := `
		INSERT INTO reseller_logs (reseller_id, app_id, action, license_key, credits_used)
		VALUES ($1, $2, $3, $4, $5)
	`
	_, err := r.db.ExecContext(ctx, query, resellerID, appID, action, licenseKey, creditsUsed)
	return err
}
