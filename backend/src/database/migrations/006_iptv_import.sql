ALTER TABLE live_channels
  ADD COLUMN IF NOT EXISTS stream_headers JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source VARCHAR(80),
  ADD COLUMN IF NOT EXISTS source_channel_id VARCHAR(120);

ALTER TABLE movies
  ADD COLUMN IF NOT EXISTS stream_headers JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS idx_live_channels_source_channel
  ON live_channels(source, source_channel_id)
  WHERE source IS NOT NULL AND source_channel_id IS NOT NULL;
