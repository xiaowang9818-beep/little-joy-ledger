-- 小确幸记账：收费、权益、管理后台和平台 AI 的 PostgreSQL 迁移基础。
-- 当前本地预览仍使用 data.json；正式收费部署时由迁移程序把现有用户 ID 写入 app_users。
BEGIN;

CREATE TABLE IF NOT EXISTS app_users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  profile jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT false,
  price_cents bigint NOT NULL CHECK (price_cents >= 0),
  duration_days integer NOT NULL CHECK (duration_days BETWEEN 1 AND 3650),
  entitlements jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  plan_id text NOT NULL REFERENCES plans(id),
  status text NOT NULL CHECK (status IN ('active','cancelled','disabled','expired')),
  source text NOT NULL CHECK (source IN ('trial','manual','gift','payment','compensation')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  created_by_admin_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- CREATE TABLE IF NOT EXISTS does not revise an older inline CHECK constraint.
-- Recreate it so an existing installation can persist the new trial source too.
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_source_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_source_check CHECK (source IN ('trial','manual','gift','payment','compensation'));
CREATE INDEX IF NOT EXISTS subscriptions_user_active_idx ON subscriptions(user_id, status, ends_at);

-- 仅保存规范化邮箱的不可逆哈希。账号注销时必须保留，避免同邮箱重复领取体验。
-- 用户和订阅标识故意不设外键，避免账号级联删除领取凭据。
CREATE TABLE IF NOT EXISTS trial_claims (
  email_hash char(64) PRIMARY KEY,
  first_user_id text,
  subscription_id text,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS entitlement_grants (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  feature text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  monthly_quota integer CHECK (monthly_quota IS NULL OR monthly_quota >= 0),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  source text NOT NULL,
  created_by_admin_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS entitlement_grants_user_idx ON entitlement_grants(user_id, feature, ends_at);

CREATE TABLE IF NOT EXISTS manual_payments (
  id text PRIMARY KEY,
  user_id text REFERENCES app_users(id) ON DELETE SET NULL,
  subscription_id text REFERENCES subscriptions(id) ON DELETE SET NULL,
  plan_id text REFERENCES plans(id),
  amount_cents bigint NOT NULL CHECK (amount_cents >= 0),
  currency char(3) NOT NULL DEFAULT 'CNY',
  channel text NOT NULL,
  reference text UNIQUE,
  status text NOT NULL CHECK (status IN ('confirmed','void','refunded')),
  received_at timestamptz NOT NULL,
  created_by_admin_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS theme_catalog (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  premium boolean NOT NULL DEFAULT true,
  required_entitlement text,
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  available_from timestamptz,
  available_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (available_until IS NULL OR available_from IS NULL OR available_until > available_from)
);

CREATE TABLE IF NOT EXISTS admin_users (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  display_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('super_admin','billing_admin','ai_operator','support','auditor')),
  password_salt text NOT NULL,
  password_hash text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash char(64) PRIMARY KEY,
  admin_id text NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  csrf_hash char(64) NOT NULL,
  created_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_providers (
  id text PRIMARY KEY,
  name text NOT NULL,
  base_url text NOT NULL,
  api_key_ciphertext text NOT NULL,
  key_last4 varchar(4) NOT NULL,
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  timeout_ms integer NOT NULL DEFAULT 90000,
  input_per_million_cents bigint NOT NULL DEFAULT 0 CHECK (input_per_million_cents >= 0),
  output_per_million_cents bigint NOT NULL DEFAULT 0 CHECK (output_per_million_cents >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_routes (
  capability text PRIMARY KEY CHECK (capability IN ('vision','stt','text')),
  provider_id text NOT NULL REFERENCES ai_providers(id),
  model text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  max_output_tokens integer NOT NULL DEFAULT 1200,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_usage_events (
  request_id_hash char(64) PRIMARY KEY,
  id text NOT NULL UNIQUE,
  user_id text NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  feature text NOT NULL,
  capability text NOT NULL,
  provider_id text NOT NULL,
  model text NOT NULL,
  usage_month char(7) NOT NULL,
  status text NOT NULL CHECK (status IN ('reserved','succeeded','failed')),
  input_bytes bigint NOT NULL DEFAULT 0,
  input_tokens bigint NOT NULL DEFAULT 0,
  output_tokens bigint NOT NULL DEFAULT 0,
  cost_cents bigint NOT NULL DEFAULT 0,
  latency_ms integer,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_usage_user_month_idx ON ai_usage_events(user_id, usage_month, feature, status);

CREATE TABLE IF NOT EXISTS feature_flags (
  key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  public boolean NOT NULL DEFAULT true,
  value jsonb,
  updated_by_admin_id text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id text PRIMARY KEY,
  admin_id text NOT NULL,
  admin_role text NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(created_at DESC);

COMMIT;
