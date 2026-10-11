ALTER TABLE users ADD COLUMN IF NOT EXISTS parental_pin_hash TEXT;
ALTER TABLE live_channels ADD COLUMN IF NOT EXISTS parental_rating INTEGER NOT NULL DEFAULT 0 CHECK (parental_rating BETWEEN 0 AND 21);
ALTER TABLE movies ADD COLUMN IF NOT EXISTS parental_rating INTEGER NOT NULL DEFAULT 0 CHECK (parental_rating BETWEEN 0 AND 21);
ALTER TABLE series ADD COLUMN IF NOT EXISTS parental_rating INTEGER NOT NULL DEFAULT 0 CHECK (parental_rating BETWEEN 0 AND 21);

CREATE TABLE IF NOT EXISTS series_episodes (
  id BIGSERIAL PRIMARY KEY,
  series_id BIGINT NOT NULL REFERENCES series(id) ON DELETE CASCADE,
  titulo VARCHAR(220) NOT NULL,
  descripcion TEXT,
  season_number INTEGER NOT NULL DEFAULT 1 CHECK (season_number > 0),
  episode_number INTEGER NOT NULL DEFAULT 1 CHECK (episode_number > 0),
  poster_url TEXT,
  manifest_url TEXT,
  fallback_manifest_url TEXT,
  license_url TEXT,
  drm_type VARCHAR(40),
  parental_rating INTEGER NOT NULL DEFAULT 0 CHECK (parental_rating BETWEEN 0 AND 21),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(series_id,season_number,episode_number)
);

CREATE TABLE IF NOT EXISTS epg_programs (
  id BIGSERIAL PRIMARY KEY,
  channel_id BIGINT NOT NULL REFERENCES live_channels(id) ON DELETE CASCADE,
  titulo VARCHAR(220) NOT NULL,
  descripcion TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK(ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_epg_channel_time ON epg_programs(channel_id,starts_at,ends_at);

DROP TRIGGER IF EXISTS recycle_deleted_row ON series_episodes;
CREATE TRIGGER recycle_deleted_row BEFORE DELETE ON series_episodes FOR EACH ROW EXECUTE FUNCTION archive_deleted_row();
DROP TRIGGER IF EXISTS recycle_deleted_row ON epg_programs;
CREATE TRIGGER recycle_deleted_row BEFORE DELETE ON epg_programs FOR EACH ROW EXECUTE FUNCTION archive_deleted_row();
