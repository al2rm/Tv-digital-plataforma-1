# TV Digital Pro para Android

Aplicación nativa Kotlin para teléfono, tablet y Android TV.

## Incluye

- acceso con correo y contraseña creados en el panel;
- dirección del servidor configurable;
- catálogo, categorías, búsqueda y favoritos por usuario;
- estado de suscripción visible;
- bloqueo de reproducción sin suscripción activa;
- Media3 para HLS, DASH y Widevine;
- video demo para comprobar el reproductor.

## Compilar en GitHub

El flujo `.github/workflows/android.yml` ejecuta pruebas, lint y genera `app-debug.apk`. En GitHub abre **Actions → Compilar app Android → Run workflow** y descarga el artefacto **TV-Digital-Pro-Android-debug** cuando finalice.

## Servidor

En la pantalla inicial introduce la URL HTTPS donde está desplegado TV Digital Pro, por ejemplo:

```text
https://mi-panel.onrender.com/
```

La app consume `/api/auth/login`, `/api/app/account`, `/api/catalog/*` y `/api/playback/session/*`. Las fuentes maestras y credenciales del proveedor deben permanecer en el servidor autorizado.

## Desarrollo local

La variante debug acepta servidores y señales HTTP para pruebas. La versión release exige HTTPS por defecto; para un proveedor heredado compílala con `-PALLOW_HTTP_STREAMS=true`. HTTP no cifra la señal ni las credenciales.
