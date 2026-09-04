package repository

import (
	"context"

	"github.com/volq-auth/volq-auth/internal/database"
	"github.com/volq-auth/volq-auth/internal/models"
)

type SQLLogRepository struct {
	db *database.DB
}

func NewSQLLogRepository(db *database.DB) *SQLLogRepository {
	return &SQLLogRepository{db: db}
}

func (r *SQLLogRepository) Create(ctx context.Context, log *models.SecurityLog) error {
	query := `
		INSERT INTO security_logs (app_id, event_type, actor_identifier, ip_address, details)
		VALUES ($1, $2, $3, $4, $5::jsonb)
		RETURNING id, created_at
	`
	detailsJSON := log.Details
	if detailsJSON == "" {
		detailsJSON = "{}"
	}
	return r.db.QueryRowContext(ctx, query,
		log.AppID, log.EventType, log.ActorIdentifier, log.IPAddress, detailsJSON,
	).Scan(&log.ID, &log.CreatedAt)
}

func (r *SQLLogRepository) ListByApp(ctx context.Context, appID string, limit int) ([]models.SecurityLog, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}

	query := `
		SELECT id, app_id, event_type, actor_identifier, ip_address, details::text, created_at
		FROM security_logs
		WHERE app_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`
	rows, err := r.db.QueryContext(ctx, query, appID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []models.SecurityLog
	for rows.Next() {
		var l models.SecurityLog
		if err := rows.Scan(&l.ID, &l.AppID, &l.EventType, &l.ActorIdentifier, &l.IPAddress, &l.Details, &l.CreatedAt); err != nil {
			return nil, err
		}
		logs = append(logs, l)
	}
	return logs, nil
}
