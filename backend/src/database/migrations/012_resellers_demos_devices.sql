ALTER TABLE users ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS access_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS max_devices INTEGER NOT NULL DEFAULT 1 CHECK (max_devices BETWEEN 1 AND 10);
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS reseller_accounts (
  user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  parent_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  credit_balance INTEGER NOT NULL DEFAULT 0 CHECK (credit_balance >= 0),
  is_super_reseller BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (parent_user_id IS NULL OR parent_user_id <> user_id)
);

CREATE TABLE IF NOT EXISTS credit_movements (
  id BIGSERIAL PRIMARY KEY,
  reseller_user_id BIGINT NOT NULL REFERENCES reseller_accounts(user_id) ON DELETE CASCADE,
  actor_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL CHECK (amount <> 0),
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
  reason VARCHAR(40) NOT NULL DEFAULT 'ajuste',
  note VARCHAR(240),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_devices (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_key_hash CHAR(64) NOT NULL,
  device_name VARCHAR(100) NOT NULL DEFAULT 'TV Box',
  platform VARCHAR(40) NOT NULL DEFAULT 'Android TV',
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, device_key_hash)
);

CREATE INDEX IF NOT EXISTS idx_users_access_expires ON users(access_expires_at);
CREATE INDEX IF NOT EXISTS idx_users_created_by ON users(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_credit_movements_reseller ON credit_movements(reseller_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_devices_user ON user_devices(user_id, last_seen_at DESC);
