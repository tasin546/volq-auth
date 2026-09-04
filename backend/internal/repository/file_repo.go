package repository

import (
	"context"
	"database/sql"
	"errors"

	"github.com/volq-auth/volq-auth/internal/database"
	"github.com/volq-auth/volq-auth/internal/models"
)

type SQLFileRepository struct {
	db *database.DB
}

func NewSQLFileRepository(db *database.DB) *SQLFileRepository {
	return &SQLFileRepository{db: db}
}

func (r *SQLFileRepository) Create(ctx context.Context, f *models.File) error {
	query := `
		INSERT INTO app_files (app_id, file_name, r2_storage_key, sha256_hash, file_size_bytes, min_tier_level)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at
	`
	return r.db.QueryRowContext(ctx, query,
		f.AppID, f.FileName, f.R2StorageKey, f.SHA256Hash, f.FileSizeBytes, f.MinTierLevel,
	).Scan(&f.ID, &f.CreatedAt)
}

func (r *SQLFileRepository) GetByName(ctx context.Context, appID, fileName string) (*models.File, error) {
	query := `
		SELECT id, app_id, file_name, r2_storage_key, sha256_hash, file_size_bytes, min_tier_level, created_at
		FROM app_files
		WHERE app_id = $1 AND file_name = $2
	`
	f := &models.File{}
	err := r.db.QueryRowContext(ctx, query, appID, fileName).Scan(
		&f.ID, &f.AppID, &f.FileName, &f.R2StorageKey, &f.SHA256Hash, &f.FileSizeBytes, &f.MinTierLevel, &f.CreatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return f, err
}

func (r *SQLFileRepository) ListByApp(ctx context.Context, appID string) ([]models.File, error) {
	query := `
		SELECT id, app_id, file_name, r2_storage_key, sha256_hash, file_size_bytes, min_tier_level, created_at
		FROM app_files
		WHERE app_id = $1
		ORDER BY created_at DESC
	`
	rows, err := r.db.QueryContext(ctx, query, appID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []models.File
	for rows.Next() {
		var f models.File
		if err := rows.Scan(
			&f.ID, &f.AppID, &f.FileName, &f.R2StorageKey, &f.SHA256Hash, &f.FileSizeBytes, &f.MinTierLevel, &f.CreatedAt,
		); err != nil {
			return nil, err
		}
		list = append(list, f)
	}
	return list, nil
}

func (r *SQLFileRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM app_files WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}
