-- VOLQ-AUTH (OpenKeyAuth) - PostgreSQL Database Schema
-- Version: 1.0.0
-- Optimized for 100% Zero-Cost Infrastructure (Supabase, Neon, or Local PostgreSQL)

-- Enable UUID extension if not already available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Developers & Platform Users (Dashboard Admins & Vendors)
CREATE TABLE IF NOT EXISTS developers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(64) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    two_factor_secret VARCHAR(64),
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    role VARCHAR(32) DEFAULT 'developer', -- 'admin', 'developer', 'reseller'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Applications Table (Workspaces)
CREATE TABLE IF NOT EXISTS applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    developer_id UUID NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
    name VARCHAR(128) NOT NULL,
    secret_hash VARCHAR(255) NOT NULL,
    master_public_key TEXT NOT NULL,         -- Ed25519 public key in Base64
    master_private_key_enc TEXT NOT NULL,    -- Ed25519 private key (encrypted with server master key or app secret)
    version VARCHAR(32) DEFAULT '1.0.0',
    download_url TEXT,
    integrity_hash VARCHAR(64),              -- SHA-256 binary hash of valid client
    is_paused BOOLEAN DEFAULT FALSE,
    hwid_lock_enabled BOOLEAN DEFAULT TRUE,
    hwid_cooldown_days INT DEFAULT 7,        -- Cooldown days for HWID reset
    webhook_url TEXT,                        -- Discord or standard webhook URL
    webhook_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Subscription Tiers
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    name VARCHAR(64) NOT NULL,
    tier_level INT DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Licenses Table
CREATE TABLE IF NOT EXISTS licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
    license_key VARCHAR(128) UNIQUE NOT NULL,
    duration_seconds BIGINT NOT NULL,        -- Duration in seconds (e.g. 2592000 for 30 days, 0 for lifetime)
    is_lifetime BOOLEAN DEFAULT FALSE,
    hwid_hash VARCHAR(64),                   -- Bound HWID digest
    hwid_list TEXT[] DEFAULT '{}',           -- Multi-device HWID array
    max_hwids INT DEFAULT 1,
    status VARCHAR(32) DEFAULT 'unactivated', -- 'unactivated', 'active', 'paused', 'banned'
    activated_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    last_hwid_reset TIMESTAMPTZ,
    banned_reason TEXT,
    created_by UUID REFERENCES developers(id),
    note VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. End-Users Vault (Mode B - User / Pass Registration)
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

-- 6. Remote Variables (Encrypted Storage)
CREATE TABLE IF NOT EXISTS app_variables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    var_key VARCHAR(128) NOT NULL,
    var_value TEXT NOT NULL,
    min_tier_level INT DEFAULT 0,
    is_secret BOOLEAN DEFAULT TRUE,          -- Secret vars require active session token
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(app_id, var_key)
);

-- 7. Cloud Files (Zero-Disk Streaming Payloads)
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

-- 8. Resellers & Sub-Admin Accounts
CREATE TABLE IF NOT EXISTS resellers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    developer_id UUID NOT NULL REFERENCES developers(id) ON DELETE CASCADE,
    app_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    username VARCHAR(64) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    credits INT DEFAULT 0,                  -- 1 credit = 1 day duration
    can_reset_hwid BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(developer_id, username)
);

-- 9. Reseller Transactions / Audit
CREATE TABLE IF NOT EXISTS reseller_logs (
    id BIGSERIAL PRIMARY KEY,
    reseller_id UUID REFERENCES resellers(id) ON DELETE CASCADE,
    app_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    action VARCHAR(64) NOT NULL,
    license_key VARCHAR(128),
    credits_used INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Security & Audit Event Logs (30-day retention)
CREATE TABLE IF NOT EXISTS security_logs (
    id BIGSERIAL PRIMARY KEY,
    app_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,       -- 'user.login', 'license.redeem', 'hwid.mismatch', 'tamper.detected'
    actor_identifier VARCHAR(128),         -- Key, username, or session ID
    ip_address VARCHAR(45),
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR MICROSECOND QUERY SPEED & PGBOUNCER COMPATIBILITY
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_developers_username ON developers(username);
CREATE INDEX IF NOT EXISTS idx_developers_email ON developers(email);

CREATE INDEX IF NOT EXISTS idx_applications_developer ON applications(developer_id);

CREATE INDEX IF NOT EXISTS idx_licenses_app_key ON licenses(app_id, license_key);
CREATE INDEX IF NOT EXISTS idx_licenses_hwid ON licenses(hwid_hash);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(app_id, status);

CREATE INDEX IF NOT EXISTS idx_app_users_lookup ON app_users(app_id, username);
CREATE INDEX IF NOT EXISTS idx_app_users_license ON app_users(license_id);

CREATE INDEX IF NOT EXISTS idx_app_variables_lookup ON app_variables(app_id, var_key);
CREATE INDEX IF NOT EXISTS idx_app_files_lookup ON app_files(app_id, file_name);

CREATE INDEX IF NOT EXISTS idx_security_logs_app_time ON security_logs(app_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resellers_app ON resellers(app_id);
