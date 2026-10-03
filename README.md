# TV Digital Pro

Plataforma propia para administrar clientes, suscripciones, pagos y una aplicación Android de TV digital.

## Funciones listas

- panel React adaptable a celular y escritorio;
- clientes, accesos, precios, suscripciones, pagos y renovaciones;
- CRM, avisos por WhatsApp y automatizaciones de vencimiento;
- catálogo administrable de categorías, canales y películas;
- conexión con proveedores Xtream Codes mediante `player_api.php`, exploración por categorías e importación por `stream_id`;
- app Android para teléfono y Android TV con inicio de sesión, catálogo, búsqueda, favoritos y Media3;
- reproducción HLS/DASH y Widevine mediante fuentes HTTPS autorizadas;
- bloqueo de reproducción cuando la cuenta está desactivada o la suscripción está vencida;
- compilación automática de la APK de prueba con GitHub Actions.

## Estructura

- `backend/`: API Node.js, Express, PostgreSQL y JWT.
- `admin/`: panel React + Vite.
- `android/`: aplicación Kotlin + Media3.
- `docs/`: instalación, despliegue y automatización.

## Flujo de uso

1. Despliega el panel y la API siguiendo [docs/DEPLOY-RENDER.md](docs/DEPLOY-RENDER.md).
2. En el panel, configura precios, clientes y suscripciones.
3. Agrega fuentes autorizadas desde **Catálogo** o usa **Importar Xtream** para conectar el servidor, revisar sus canales e importar los seleccionados.
4. Descarga la APK del resultado del flujo **Compilar app Android** en GitHub Actions.
5. En la app, escribe la dirección HTTPS de tu servidor e inicia sesión con un cliente del panel.

## LumixTV

La cuenta de revendedor se gestiona actualmente desde el panel de LumixTV. La sincronización automática requiere documentación oficial de su API y un contrato autorizado de reproducción. No guardes credenciales del panel del proveedor dentro de la app ni del repositorio.

## Verificación

```bash
npm ci --prefix backend
npm test --prefix backend
npm ci --prefix admin
npm run build --prefix admin
```

Los secretos se configuran únicamente mediante variables de entorno y nunca se suben al repositorio.
Las credenciales Xtream se cifran con `XTREAM_CREDENTIALS_KEY`; la app Android recibe solamente un enlace temporal de TV Digital y nunca recibe el usuario o la contraseña del proveedor.
