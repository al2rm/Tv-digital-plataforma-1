ALTER TABLE users DROP CONSTRAINT IF EXISTS users_rol_check;
ALTER TABLE users ADD CONSTRAINT users_rol_check CHECK (rol IN ('admin','vendedor','soporte','cliente'));

CREATE TABLE IF NOT EXISTS recycle_bin (
  id BIGSERIAL PRIMARY KEY,
  entity_type VARCHAR(40) NOT NULL,
  entity_id BIGINT NOT NULL,
  snapshot JSONB NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  restored_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_recycle_bin_active ON recycle_bin(deleted_at DESC) WHERE restored_at IS NULL;

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  user_name VARCHAR(120),
  action VARCHAR(12) NOT NULL,
  resource TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC);

CREATE OR REPLACE FUNCTION archive_deleted_row() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO recycle_bin(entity_type,entity_id,snapshot)
  VALUES(TG_TABLE_NAME,OLD.id,to_jsonb(OLD));
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['users','subscriptions','payments','plans','categories','movies','series','live_channels'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS recycle_deleted_row ON %I',table_name);
    EXECUTE format('CREATE TRIGGER recycle_deleted_row BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION archive_deleted_row()',table_name);
  END LOOP;
END $$;
