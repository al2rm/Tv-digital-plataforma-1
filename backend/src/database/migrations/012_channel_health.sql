ALTER TABLE live_channels
  ADD COLUMN IF NOT EXISTS health_status VARCHAR(20) NOT NULL DEFAULT 'unchecked',
  ADD COLUMN IF NOT EXISTS health_source VARCHAR(20),
  ADD COLUMN IF NOT EXISTS health_error TEXT,
  ADD COLUMN IF NOT EXISTS health_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_live_channels_health
  ON live_channels(health_status, health_checked_at DESC);
