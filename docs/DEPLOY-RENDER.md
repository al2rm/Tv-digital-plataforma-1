# Despliegue de prueba en Render

Esta configuración crea dos recursos gratuitos:

- `tv-digital-pro-demo-al2rm`: panel React y API Express en el mismo dominio;
- `tv-digital-pro-db-demo-al2rm`: PostgreSQL para datos de prueba.

## Antes de comenzar

- Usa información ficticia durante la evaluación.
- La base PostgreSQL gratuita caduca 30 días después de su creación.
- El servicio web gratuito se suspende cuando no recibe tráfico y puede tardar
  alrededor de un minuto en responder a la primera visita.
- WhatsApp queda en modo `assisted`; no se requieren credenciales de Meta.
- El trabajador automático queda desactivado porque un servicio suspendido no
  puede ejecutar recordatorios con puntualidad.

## Creación

1. Inicia sesión en Render con GitHub.
2. Crea un Blueprint desde el repositorio
   `al2rm/Tv-digital-plataforma-1`.
3. Confirma que Render detecta `render.yaml` en la rama `main`.
4. En los campos secretos, escribe un correo administrativo y una contraseña
   nueva de al menos ocho caracteres. No los guardes en GitHub.
5. Confirma la creación y espera a que las migraciones, el administrador y el
   servidor finalicen.
6. Abre `/api/health` y luego la raíz del dominio para validar API y panel.

## Paso posterior a la prueba

Antes del vencimiento, exporta cualquier dato que necesites y decide entre:

- actualizar PostgreSQL a un plan persistente;
- migrar los datos a otro PostgreSQL;
- eliminar los recursos si la prueba terminó.
