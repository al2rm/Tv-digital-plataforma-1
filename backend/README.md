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
- `GET|POST /api/admin/v2/operations/resellers`
- `POST /api/admin/v2/operations/resellers/:userId/credits`
- `POST /api/admin/v2/operations/demos`
- `GET /api/admin/v2/operations/devices` y `DELETE /api/admin/v2/operations/devices/:id`

Las rutas aplican permisos diferenciados para `admin`, `vendedor` y `soporte`.
Los accesos demo vencen por hora exacta y cada instalación Android registrada
cuenta contra el límite configurado del cliente.

## Trabajador de automatización

Al activar `AUTOMATION_WORKER_ENABLED=true`, el servidor procesa periódicamente
la cola persistente `automation_jobs`. Los trabajos usan bloqueo seguro de
PostgreSQL y reintentos limitados.

La configuración completa está documentada en `.env.example`.
