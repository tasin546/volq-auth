export interface Application {
  id: string;
  developer_id: string;
  name: string;
  master_public_key: string;
  version: string;
  download_url: string;
  integrity_hash: string;
  is_paused: boolean;
  hwid_lock_enabled: boolean;
  hwid_cooldown_days: number;
  webhook_url: string;
  webhook_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface License {
  id: string;
  app_id: string;
  subscription_id?: string;
  subscription_name: string;
  tier_level: number;
  license_key: string;
  duration_seconds: number;
  is_lifetime: boolean;
  hwid_hash?: string;
  max_hwids: number;
  status: 'unactivated' | 'active' | 'paused' | 'banned' | 'expired';
  activated_at?: string;
  expires_at?: string;
  last_hwid_reset?: string;
  banned_reason?: string;
  note: string;
  created_at: string;
}

export interface AppUser {
  id: string;
  app_id: string;
  username: string;
  license_id?: string;
  hwid_hash?: string;
  ip_address?: string;
  is_banned: boolean;
  ban_reason?: string;
  created_at: string;
  last_login_at?: string;
}

export interface Variable {
  id: string;
  app_id: string;
  var_key: string;
  var_value: string;
  min_tier_level: number;
  is_secret: boolean;
  created_at: string;
}

export interface FilePayload {
  id: string;
  app_id: string;
  file_name: string;
  r2_storage_key: string;
  sha256_hash: string;
  file_size_bytes: number;
  min_tier_level: number;
  created_at: string;
}

export interface Reseller {
  id: string;
  developer_id: string;
  app_id: string;
  username: string;
  credits: number;
  can_reset_hwid: boolean;
  is_active: boolean;
  created_at: string;
}

export interface SecurityLog {
  id: number;
  app_id: string;
  event_type: string;
  actor_identifier: string;
  ip_address: string;
  details: string;
  created_at: string;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'developer' | 'reseller';
  app_id?: string;
  credits?: number;
}
