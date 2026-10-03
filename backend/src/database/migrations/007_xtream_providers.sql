CREATE TABLE IF NOT EXISTS xtream_providers (
  id BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  base_url TEXT NOT NULL,
  username_encrypted TEXT NOT NULL,
  password_encrypted TEXT NOT NULL,
  account_status VARCHAR(40),
  expires_at TIMESTAMPTZ,
  max_connections INTEGER,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE live_channels
  ADD COLUMN IF NOT EXISTS xtream_provider_id BIGINT REFERENCES xtream_providers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS xtream_stream_id BIGINT,
  ADD COLUMN IF NOT EXISTS xtream_container VARCHAR(12);

CREATE UNIQUE INDEX IF NOT EXISTS idx_live_channels_xtream_stream
  ON live_channels(xtream_provider_id, xtream_stream_id)
  WHERE xtream_provider_id IS NOT NULL AND xtream_stream_id IS NOT NULL;

