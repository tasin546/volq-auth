package repository

import (
	"context"
	"database/sql"
	"errors"

	"github.com/volq-auth/volq-auth/internal/database"
	"github.com/volq-auth/volq-auth/internal/models"
)

type SQLVariableRepository struct {
	db *database.DB
}

func NewSQLVariableRepository(db *database.DB) *SQLVariableRepository {
	return &SQLVariableRepository{db: db}
}

func (r *SQLVariableRepository) Create(ctx context.Context, v *models.Variable) error {
	query := `
		INSERT INTO app_variables (app_id, var_key, var_value, min_tier_level, is_secret)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (app_id, var_key) DO UPDATE
		SET var_value = EXCLUDED.var_value,
		    min_tier_level = EXCLUDED.min_tier_level,
		    is_secret = EXCLUDED.is_secret
		RETURNING id, created_at
	`
	return r.db.QueryRowContext(ctx, query, v.AppID, v.VarKey, v.VarValue, v.MinTierLevel, v.IsSecret).
		Scan(&v.ID, &v.CreatedAt)
}

func (r *SQLVariableRepository) GetByKey(ctx context.Context, appID, varKey string) (*models.Variable, error) {
	query := `SELECT id, app_id, var_key, var_value, min_tier_level, is_secret, created_at FROM app_variables WHERE app_id = $1 AND var_key = $2`
	v := &models.Variable{}
	err := r.db.QueryRowContext(ctx, query, appID, varKey).Scan(&v.ID, &v.AppID, &v.VarKey, &v.VarValue, &v.MinTierLevel, &v.IsSecret, &v.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return v, err
}

func (r *SQLVariableRepository) ListByApp(ctx context.Context, appID string) ([]models.Variable, error) {
	query := `SELECT id, app_id, var_key, var_value, min_tier_level, is_secret, created_at FROM app_variables WHERE app_id = $1 ORDER BY var_key ASC`
	rows, err := r.db.QueryContext(ctx, query, appID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.Variable
	for rows.Next() {
		var v models.Variable
		if err := rows.Scan(&v.ID, &v.AppID, &v.VarKey, &v.VarValue, &v.MinTierLevel, &v.IsSecret, &v.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, v)
	}
	return list, nil
}

func (r *SQLVariableRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM app_variables WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}
