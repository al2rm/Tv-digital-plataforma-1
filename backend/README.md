# Backend de TV Digital Pro

API REST con Express, PostgreSQL y autenticación JWT.

## Comandos

```bash
npm run dev
npm run start
npm run check
npm test
npm run db:migrate
npm run admin:create
```

## Rutas principales

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/crm/dashboard`
- `GET|POST /api/crm/leads`
- `GET|POST /api/whatsapp/messages`
- `GET|POST /api/whatsapp/webhook`
- `GET|POST /api/admin/v2/subscriptions`
- `POST /api/admin/v2/subscriptions/:id/renew`
- `GET /api/admin/v2/automations/jobs`
- `POST /api/admin/v2/automations/run`

Las rutas de CRM, administración y bandeja requieren una cuenta con rol
`admin`.

## Trabajador de automatización

Al activar `AUTOMATION_WORKER_ENABLED=true`, el servidor procesa periódicamente
la cola persistente `automation_jobs`. Los trabajos usan bloqueo seguro de
PostgreSQL y reintentos limitados.

La configuración completa está documentada en `.env.example`.
