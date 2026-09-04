package database

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"
)

// RunMigrations automatically initializes the schema if tables do not exist
func (db *DB) RunMigrations(migrationFilePath string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	var sqlContent string
	if data, err := os.ReadFile(migrationFilePath); err == nil {
		sqlContent = string(data)
	} else {
		// Fallback embedded minimal schema if file not found at relative path
		sqlContent = embeddedSchema
	}

	_, err := db.ExecContext(ctx, sqlContent)
	if err != nil {
		return fmt.Errorf("migration execution error: %w", err)
	}

	log.Println("[MIGRATIONS] Database schema initialized and up to date.")
	return nil
}

const embeddedSchema = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS developers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(64) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    two_factor_secret VARCHAR(64),
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    role VARCHAR(32) DEFAULT 'developer',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    developer_id UUID NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    secret_hash VARCHAR(255) NOT NULL,
    master_public_key TEXT NOT NULL,
    master_private_key_enc TEXT NOT NULL,
    version VARCHAR(32) DEFAULT '1.0.0',
    download_url TEXT,
    integrity_hash VARCHAR(64),
    is_paused BOOLEAN DEFAULT FALSE,
    hwid_lock_enabled BOOLEAN DEFAULT TRUE,
    hwid_cooldown_days INT DEFAULT 7,
    webhook_url TEXT,
    webhook_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    name VARCHAR(64) NOT NULL,
    tier_level INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    license_key VARCHAR(128) UNIQUE NOT NULL,
    duration_seconds BIGINT NOT NULL,
    is_lifetime BOOLEAN DEFAULT FALSE,
    hwid_hash VARCHAR(64),
    hwid_list TEXT[] DEFAULT '{}',
    max_hwids INT DEFAULT 1,
    status VARCHAR(32) DEFAULT 'unactivated',
    activated_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    last_hwid_reset TIMESTAMPTZ,
    banned_reason TEXT,
    created_by UUID REFERENCES developers(id),
    note VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    username VARCHAR(64) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    license_id UUID REFERENCES licenses(id) ON DELETE SET NULL,
    hwid_hash VARCHAR(64),
    ip_address VARCHAR(45),
    is_banned BOOLEAN DEFAULT FALSE,
    ban_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    UNIQUE(app_id, username)
);

CREATE TABLE IF NOT EXISTS app_variables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    var_key VARCHAR(128) NOT NULL,
    var_value TEXT NOT NULL,
    min_tier_level INT DEFAULT 0,
    is_secret BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(app_id, var_key)
);

CREATE TABLE IF NOT EXISTS app_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    r2_storage_key VARCHAR(512) NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    file_size_bytes BIGINT DEFAULT 0,
    min_tier_level INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resellers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    developer_id UUID NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
    app_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    username VARCHAR(64) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    credits INT DEFAULT 0,
    can_reset_hwid BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(developer_id, username)
);

CREATE TABLE IF NOT EXISTS reseller_logs (
    id BIGSERIAL PRIMARY KEY,
    reseller_id UUID REFERENCES resellers(id) ON DELETE CASCADE,
    app_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    action VARCHAR(64) NOT NULL,
    license_key VARCHAR(128),
    credits_used INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS security_logs (
    id BIGSERIAL PRIMARY KEY,
    app_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    actor_identifier VARCHAR(128),
    ip_address VARCHAR(45),
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_licenses_app_key ON licenses(app_id, license_key);
CREATE INDEX IF NOT EXISTS idx_licenses_hwid ON licenses(hwid_hash);
CREATE INDEX IF NOT EXISTS idx_app_users_lookup ON app_users(app_id, username);
CREATE INDEX IF NOT EXISTS idx_security_logs_app_time ON security_logs(app_id, created_at DESC);
`
