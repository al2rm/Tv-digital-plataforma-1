ALTER TABLE live_channels ADD COLUMN IF NOT EXISTS fallback_manifest_url TEXT;
ALTER TABLE movies ADD COLUMN IF NOT EXISTS fallback_manifest_url TEXT;
