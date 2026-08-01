# Puesta en marcha de TV Digital Pro

## Requisitos

- Node.js 22 LTS recomendado.
- PostgreSQL 14 o superior.
- Una base de datos vacía, por ejemplo `tv_digital`.

## 1. Backend

Desde la carpeta `backend`:

```bash
npm install
cp .env.example .env
```

Edita `.env` y configura como mínimo:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=tv_digital
DB_USER=postgres
DB_PASSWORD=tu_clave
JWT_SECRET=un_secreto_largo_y_aleatorio
```

Prepara la base de datos:

```bash
npm run db:migrate
```

Configura temporalmente en `.env` el primer administrador:

```env
ADMIN_NAME=Administrador
ADMIN_EMAIL=tu_correo
ADMIN_PASSWORD=una_clave_segura
```

Créalo y después elimina `ADMIN_PASSWORD` del archivo:

```bash
npm run admin:create
npm run dev
```

La API se ejecutará en `http://localhost:3000`.

## 2. Panel administrativo

Desde la carpeta `admin`:

```bash
npm install
cp .env.example .env
npm run dev
```

Abre `http://localhost:5173` e inicia sesión con el administrador creado.

## 3. Modo híbrido recomendado

Empieza con:

```env
WHATSAPP_MODE=assisted
AUTOMATION_WORKER_ENABLED=true
```

Los recordatorios aparecerán en la bandeja de WhatsApp. El botón **Abrir**
prepara el mensaje en WhatsApp y el botón **Marcar** confirma que fue enviado.

## 4. Activar WhatsApp Cloud API

Cuando la cuenta oficial de Meta esté preparada, configura:

```env
WHATSAPP_MODE=cloud
WHATSAPP_GRAPH_VERSION=version_vigente
WHATSAPP_PHONE_NUMBER_ID=id_del_numero
WHATSAPP_ACCESS_TOKEN=token_seguro
WHATSAPP_VERIFY_TOKEN=token_de_verificacion
WHATSAPP_APP_SECRET=secreto_de_la_app
```

Configura en Meta el webhook HTTPS público:

```text
https://tu-dominio.com/api/whatsapp/webhook
```

Antes de habilitar envíos iniciados por la empresa, registra en el panel el
nombre oficial y la aprobación de cada plantilla de Meta.

## 5. Verificación

```bash
cd backend
npm run check
npm test

cd ../admin
npm run build
```

Nunca publiques `.env`, tokens, contraseñas ni credenciales de base de datos.
