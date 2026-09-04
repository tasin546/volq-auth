package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"github.com/volq-auth/volq-auth/internal/database"
	"github.com/volq-auth/volq-auth/internal/models"
)

type SQLUserRepository struct {
	db *database.DB
}

func NewSQLUserRepository(db *database.DB) *SQLUserRepository {
	return &SQLUserRepository{db: db}
}

func (r *SQLUserRepository) Create(ctx context.Context, user *models.AppUser) error {
	query := `
		INSERT INTO app_users (app_id, username, password_hash, license_id, hwid_hash, ip_address)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at
	`
	return r.db.QueryRowContext(ctx, query,
		user.AppID, user.Username, user.PasswordHash, user.LicenseID, user.HWIDHash, user.IPAddress,
	).Scan(&user.ID, &user.CreatedAt)
}

func (r *SQLUserRepository) GetByUsername(ctx context.Context, appID, username string) (*models.AppUser, error) {
	query := `
		SELECT id, app_id, username, password_hash, license_id, hwid_hash, ip_address,
		       is_banned, ban_reason, created_at, last_login_at
		FROM app_users
		WHERE app_id = $1 AND username = $2
	`
	user := &models.AppUser{}
	err := r.db.QueryRowContext(ctx, query, appID, username).Scan(
		&user.ID, &user.AppID, &user.Username, &user.PasswordHash, &user.LicenseID,
		&user.HWIDHash, &user.IPAddress, &user.IsBanned, &user.BanReason,
		&user.CreatedAt, &user.LastLoginAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return user, err
}

func (r *SQLUserRepository) ListByApp(ctx context.Context, appID string, search string, limit, offset int) ([]models.AppUser, int, error) {
	var whereConditions = []string{"app_id = $1"}
	var args = []interface{}{appID}
	argIdx := 2

	if search != "" {
		whereConditions = append(whereConditions, fmt.Sprintf("username ILIKE $%d", argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}

	whereClause := strings.Join(whereConditions, " AND ")

	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM app_users WHERE %s", whereClause)
	var total int
	if err := r.db.QueryRowContext(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	dataQuery := fmt.Sprintf(`
		SELECT id, app_id, username, password_hash, license_id, hwid_hash, ip_address,
		       is_banned, ban_reason, created_at, last_login_at
		FROM app_users
		WHERE %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)

	args = append(args, limit, offset)
	rows, err := r.db.QueryContext(ctx, dataQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var users []models.AppUser
	for rows.Next() {
		var u models.AppUser
		if err := rows.Scan(
			&u.ID, &u.AppID, &u.Username, &u.PasswordHash, &u.LicenseID,
			&u.HWIDHash, &u.IPAddress, &u.IsBanned, &u.BanReason,
			&u.CreatedAt, &u.LastLoginAt,
		); err != nil {
			return nil, 0, err
		}
		users = append(users, u)
	}
	return users, total, nil
}

func (r *SQLUserRepository) UpdateLogin(ctx context.Context, id string, ip string, hwid string) error {
	query := `
		UPDATE app_users SET
			ip_address = $1,
			hwid_hash = COALESCE(hwid_hash, $2),
			last_login_at = NOW()
		WHERE id = $3
	`
	_, err := r.db.ExecContext(ctx, query, ip, hwid, id)
	return err
}

func (r *SQLUserRepository) SetBan(ctx context.Context, id string, isBanned bool, reason *string) error {
	query := `UPDATE app_users SET is_banned = $1, ban_reason = $2 WHERE id = $3`
	_, err := r.db.ExecContext(ctx, query, isBanned, reason, id)
	return err
}

func (r *SQLUserRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM app_users WHERE id = $1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}
