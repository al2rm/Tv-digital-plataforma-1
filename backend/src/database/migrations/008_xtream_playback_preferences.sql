ALTER TABLE xtream_providers
  ADD COLUMN IF NOT EXISTS user_agent VARCHAR(300),
  ADD COLUMN IF NOT EXISTS referer TEXT,
  ADD COLUMN IF NOT EXISTS preferred_output VARCHAR(12) NOT NULL DEFAULT 'auto';

ALTER TABLE xtream_providers
  DROP CONSTRAINT IF EXISTS xtream_providers_preferred_output_check;

ALTER TABLE xtream_providers
  ADD CONSTRAINT xtream_providers_preferred_output_check
  CHECK (preferred_output IN ('auto', 'm3u8', 'ts'));
