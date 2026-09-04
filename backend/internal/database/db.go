package database

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

// DB wraps the SQL connection pool
type DB struct {
	*sql.DB
}

// Connect initializes the PostgreSQL connection pool optimized for free-tier quotas
func Connect(databaseURL string) (*DB, error) {
	db, err := sql.Open("pgx", databaseURL)
	if err != nil {
		return nil, fmt.Errorf("failed to open database connection: %w", err)
	}

	// Optimize connection pooling for Supabase / Neon / PgBouncer free tiers:
	// Free tiers typically cap at 20-50 connections. Keeping MaxOpenConns to 15 prevents thread exhaustion.
	db.SetMaxOpenConns(15)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	db.SetConnMaxIdleTime(2 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	log.Println("[DATABASE] Successfully connected to PostgreSQL with pooled connections (MaxOpen: 15)")
	return &DB{db}, nil
}
