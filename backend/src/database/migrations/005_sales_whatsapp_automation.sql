ALTER TABLE users
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS whatsapp_opt_out_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS marketing_campaigns (
  id BIGSERIAL PRIMARY KEY,
  nombre VARCHAR(160) NOT NULL,
  plataforma VARCHAR(40) NOT NULL DEFAULT 'meta',
  estado VARCHAR(30) NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador', 'activa', 'pausada', 'finalizada')),
  presupuesto_diario NUMERIC(14,2),
  moneda VARCHAR(10) NOT NULL DEFAULT 'PYG',
  fecha_inicio DATE,
  fecha_fin DATE,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leads (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT UNIQUE REFERENCES users(id) ON DELETE SET NULL,
  nombre VARCHAR(140) NOT NULL,
  telefono VARCHAR(40) NOT NULL,
  telefono_normalizado VARCHAR(30) NOT NULL UNIQUE,
  etapa VARCHAR(30) NOT NULL DEFAULT 'nuevo'
    CHECK (etapa IN (
      'nuevo',
      'contactado',
      'interesado',
      'esperando_pago',
      'activo',
      'perdido'
    )),
  origen VARCHAR(50) NOT NULL DEFAULT 'manual',
  plan_interes VARCHAR(100),
  campaign_id VARCHAR(160),
  adset_id VARCHAR(160),
  ad_id VARCHAR(160),
  utm_source VARCHAR(160),
  utm_campaign VARCHAR(160),
  consentimiento_whatsapp BOOLEAN NOT NULL DEFAULT FALSE,
  notas TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  ultima_interaccion TIMESTAMPTZ,
  asignado_a BIGINT REFERENCES users(id) ON DELETE SET NULL,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lead_events (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  tipo VARCHAR(60) NOT NULL,
  descripcion TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  creado_por BIGINT REFERENCES users(id) ON DELETE SET NULL,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whatsapp_contacts (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT UNIQUE REFERENCES leads(id) ON DELETE CASCADE,
  telefono_normalizado VARCHAR(30) NOT NULL UNIQUE,
  opt_in_at TIMESTAMPTZ,
  opt_out_at TIMESTAMPTZ,
  ultimo_mensaje_entrante TIMESTAMPTZ,
  ultimo_mensaje_saliente TIMESTAMPTZ,
  ventana_servicio_hasta TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id BIGSERIAL PRIMARY KEY,
  clave VARCHAR(80) NOT NULL UNIQUE,
  nombre VARCHAR(140) NOT NULL,
  nombre_meta VARCHAR(180),
  categoria VARCHAR(30) NOT NULL DEFAULT 'utility'
    CHECK (categoria IN ('marketing', 'utility', 'authentication', 'service')),
  idioma VARCHAR(20) NOT NULL DEFAULT 'es',
  contenido TEXT NOT NULL,
  variables JSONB NOT NULL DEFAULT '[]'::JSONB,
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  aprobada_meta BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id BIGSERIAL PRIMARY KEY,
  lead_id BIGINT REFERENCES leads(id) ON DELETE SET NULL,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  direccion VARCHAR(20) NOT NULL
    CHECK (direccion IN ('entrante', 'saliente')),
  modo VARCHAR(20) NOT NULL DEFAULT 'assisted'
    CHECK (modo IN ('assisted', 'cloud')),
  telefono VARCHAR(30) NOT NULL,
  template_key VARCHAR(80) REFERENCES whatsapp_templates(clave) ON DELETE SET NULL,
  contenido TEXT NOT NULL,
  parametros JSONB NOT NULL DEFAULT '{}'::JSONB,
  estado VARCHAR(30) NOT NULL DEFAULT 'preparado'
    CHECK (estado IN (
      'recibido',
      'preparado',
      'programado',
      'enviando',
      'enviado',
      'entregado',
      'leido',
      'fallido',
      'cancelado'
    )),
  programado_para TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  enviado_at TIMESTAMPTZ,
  provider_message_id VARCHAR(220),
  error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_provider_message
  ON whatsapp_messages(provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS automation_jobs (
  id BIGSERIAL PRIMARY KEY,
  tipo VARCHAR(80) NOT NULL,
  unique_key VARCHAR(220) UNIQUE,
  estado VARCHAR(30) NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'procesando', 'completado', 'fallido', 'cancelado')),
  ejecutar_at TIMESTAMPTZ NOT NULL,
  intentos INTEGER NOT NULL DEFAULT 0,
  max_intentos INTEGER NOT NULL DEFAULT 3,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  ultimo_error TEXT,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_actualizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completado_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_leads_etapa ON leads(etapa);
CREATE INDEX IF NOT EXISTS idx_leads_origen ON leads(origen);
CREATE INDEX IF NOT EXISTS idx_leads_ultima_interaccion ON leads(ultima_interaccion DESC);
CREATE INDEX IF NOT EXISTS idx_lead_events_lead ON lead_events(lead_id, fecha_creacion DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_estado
  ON whatsapp_messages(estado, programado_para);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_lead
  ON whatsapp_messages(lead_id, fecha_creacion DESC);
CREATE INDEX IF NOT EXISTS idx_automation_jobs_due
  ON automation_jobs(estado, ejecutar_at);

INSERT INTO whatsapp_templates
  (clave, nombre, categoria, idioma, contenido, variables)
VALUES
  (
    'bienvenida',
    'Bienvenida y calificación',
    'service',
    'es',
    E'Hola {{nombre}} 👋 Gracias por comunicarte con TV Digital Pro.\n\n¿En qué podemos ayudarte?\n1. Ver planes\n2. Solicitar una prueba\n3. Renovar mi servicio\n4. Hablar con una persona',
    '["nombre"]'::JSONB
  ),
  (
    'planes',
    'Información de planes',
    'marketing',
    'es',
    E'Hola {{nombre}}. Estos son nuestros planes disponibles:\n\n{{planes}}\n\nResponde con el plan que prefieres y te ayudamos a activarlo.',
    '["nombre", "planes"]'::JSONB
  ),
  (
    'instrucciones_pago',
    'Instrucciones de pago',
    'utility',
    'es',
    E'Hola {{nombre}}. Para completar la activación de tu plan {{plan}}, realiza el pago de {{monto}} y envíanos el comprobante por este chat.',
    '["nombre", "plan", "monto"]'::JSONB
  ),
  (
    'vence_3_dias',
    'Aviso tres días antes',
    'utility',
    'es',
    E'Hola {{nombre}} 👋 Tu plan {{plan}} de TV Digital Pro vence el {{vencimiento}}. Puedes renovarlo respondiendo RENOVAR.',
    '["nombre", "plan", "vencimiento"]'::JSONB
  ),
  (
    'vence_hoy',
    'Aviso de vencimiento',
    'utility',
    'es',
    E'Hola {{nombre}}. Tu plan {{plan}} vence hoy. Responde RENOVAR y te ayudamos a mantener el servicio activo.',
    '["nombre", "plan"]'::JSONB
  ),
  (
    'vencido_3_dias',
    'Recuperación de cliente',
    'marketing',
    'es',
    E'Hola {{nombre}}. Tu servicio de TV Digital Pro está vencido. Si deseas reactivarlo, responde REACTIVAR y te ayudamos de inmediato.',
    '["nombre"]'::JSONB
  ),
  (
    'renovacion_confirmada',
    'Renovación confirmada',
    'utility',
    'es',
    E'¡Gracias, {{nombre}}! Tu plan {{plan}} quedó renovado hasta el {{vencimiento}}.',
    '["nombre", "plan", "vencimiento"]'::JSONB
  )
ON CONFLICT (clave) DO NOTHING;
