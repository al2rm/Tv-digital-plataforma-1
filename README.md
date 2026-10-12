# TV Digital Pro

Plataforma propia para administrar clientes, suscripciones, pagos y una aplicación Android de TV digital.

## Funciones listas

- panel React adaptable a celular y escritorio;
- clientes, accesos, precios, suscripciones, pagos y renovaciones;
- CRM, avisos por WhatsApp y automatizaciones de vencimiento;
- catálogo administrable de categorías, canales y películas;
- conexión con proveedores Xtream Codes mediante `player_api.php`, exploración por categorías e importación por `stream_id`;
- preferencias por proveedor para Automático, HLS o TS y cabeceras autorizadas `User-Agent`/`Referer`;
- app Android para teléfono y Android TV con inicio de sesión, catálogo, búsqueda, favoritos y Media3;
- reproducción HLS/DASH y Widevine mediante fuentes HTTPS autorizadas;
- diagnóstico de formato/códec, selección manual HLS/TS e historial reciente en Android;
- bloqueo de reproducción cuando la cuenta está desactivada o la suscripción está vencida;
- módulo propio de revendedores, créditos y accesos demo con vencimiento por hora;
- límite de televisores por cliente y liberación remota de dispositivos desde el panel;
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

## Operación propia

El módulo **Revendedores y demos** reproduce el flujo operativo necesario con código y base de datos propios. No se conecta a APIs privadas, no copia credenciales de terceros y mantiene los accesos bajo control de TV Digital Pro.

## Verificación

```bash
npm ci --prefix backend
npm test --prefix backend
npm ci --prefix admin
npm run build --prefix admin
```

Los secretos se configuran únicamente mediante variables de entorno y nunca se suben al repositorio.
Las credenciales Xtream se cifran con `XTREAM_CREDENTIALS_KEY`; la app Android recibe solamente un enlace temporal de TV Digital y nunca recibe el usuario o la contraseña del proveedor.
