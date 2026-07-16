ALTER TABLE users ADD COLUMN IF NOT EXISTS telefono VARCHAR(40);
ALTER TABLE users ADD COLUMN IF NOT EXISTS ultimo_acceso TIMESTAMP;
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_estado ON users(estado);
CREATE INDEX IF NOT EXISTS idx_payments_fecha ON payments(fecha_pago);
