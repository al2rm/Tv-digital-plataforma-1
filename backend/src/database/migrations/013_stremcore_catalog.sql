ALTER TABLE movies ADD COLUMN IF NOT EXISTS source VARCHAR(80), ADD COLUMN IF NOT EXISTS source_content_id VARCHAR(120);
ALTER TABLE series ADD COLUMN IF NOT EXISTS source VARCHAR(80), ADD COLUMN IF NOT EXISTS source_content_id VARCHAR(120);
CREATE UNIQUE INDEX IF NOT EXISTS idx_movies_source_content ON movies(source,source_content_id) WHERE source IS NOT NULL AND source_content_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_series_source_content ON series(source,source_content_id) WHERE source IS NOT NULL AND source_content_id IS NOT NULL;
