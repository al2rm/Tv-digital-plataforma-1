CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  email VARCHAR(180) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  telefono VARCHAR(40),
  rol VARCHAR(20) NOT NULL DEFAULT 'cliente'
    CHECK (rol IN ('admin', 'cliente')),
  estado VARCHAR(20) NOT NULL DEFAULT 'activo'
    CHECK (estado IN ('activo', 'inactivo', 'bloqueado')),
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ultimo_acceso TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS plans (
  id BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  slug VARCHAR(80) NOT NULL UNIQUE,
  meses INTEGER NOT NULL CHECK (meses > 0),
  precio NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (precio >= 0),
  moneda VARCHAR(10) NOT NULL DEFAULT 'PYG',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id BIGINT NOT NULL REFERENCES plans(id),
  estado VARCHAR(30) NOT NULL DEFAULT 'activa'
    CHECK (estado IN ('pendiente', 'activa', 'vencida', 'cancelada')),
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  auto_renew BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (fecha_fin >= fecha_inicio)
);

CREATE TABLE IF NOT EXISTS payments (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  subscription_id BIGINT REFERENCES subscriptions(id) ON DELETE SET NULL,
  monto NUMERIC(14,2) NOT NULL CHECK (monto > 0),
  moneda VARCHAR(10) NOT NULL DEFAULT 'PYG',
  metodo VARCHAR(40) NOT NULL DEFAULT 'manual',
  estado VARCHAR(30) NOT NULL DEFAULT 'confirmado'
    CHECK (estado IN ('pendiente', 'confirmado', 'rechazado', 'reembolsado')),
  referencia VARCHAR(160),
  nota TEXT,
  fecha_pago TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  slug VARCHAR(120) NOT NULL UNIQUE,
  tipo VARCHAR(30) NOT NULL DEFAULT 'general',
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS movies (
  id BIGSERIAL PRIMARY KEY,
  category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
  titulo VARCHAR(220) NOT NULL,
  descripcion TEXT,
  poster_url TEXT,
  banner_url TEXT,
  manifest_url TEXT,
  license_url TEXT,
  drm_type VARCHAR(40),
  anio INTEGER,
  duracion_min INTEGER,
  clasificacion VARCHAR(30),
  destacado BOOLEAN NOT NULL DEFAULT FALSE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS series (
  id BIGSERIAL PRIMARY KEY,
  category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
  titulo VARCHAR(220) NOT NULL,
  descripcion TEXT,
  poster_url TEXT,
  banner_url TEXT,
  anio INTEGER,
  clasificacion VARCHAR(30),
  destacado BOOLEAN NOT NULL DEFAULT FALSE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS live_channels (
  id BIGSERIAL PRIMARY KEY,
  category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
  nombre VARCHAR(180) NOT NULL,
  logo_url TEXT,
  manifest_url TEXT,
  license_url TEXT,
  drm_type VARCHAR(40),
  numero_canal INTEGER,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_fecha_fin ON subscriptions(fecha_fin);
CREATE INDEX IF NOT EXISTS idx_subscriptions_estado ON subscriptions(estado);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);

INSERT INTO plans (nombre, slug, meses, precio, moneda)
VALUES
  ('Mensual', 'mensual', 1, 0, 'PYG'),
  ('Trimestral', 'trimestral', 3, 0, 'PYG'),
  ('Semestral', 'semestral', 6, 0, 'PYG'),
  ('Anual', 'anual', 12, 0, 'PYG')
ON CONFLICT (slug) DO NOTHING;
