# TV Digital Administración 1.0.0

APK independiente (`com.tvdigital.admin`) para administrar el panel React existente desde teléfonos y tablets Android 7 o superior. Se instala junto a TV Digital Pro; los datos viven en el mismo backend. Requiere Internet y Android System WebView actualizado.

## Uso

1. Abre **TV Digital Administración** e inicia sesión con una cuenta real del panel. No incluye usuarios ni contraseñas predeterminados.
2. Usa Inicio, Clientes, Catálogo y Pagos en la barra inferior. El menú del panel contiene el resto de secciones; el servidor aplica los permisos de administrador, vendedor y soporte.
3. En **Menú → Configurar servidor** puedes indicar la dirección HTTPS principal del despliegue, sin `/api`. El cambio borra la sesión local y requiere iniciar sesión nuevamente. El servidor inicial es `https://tv-digital-pro-demo-al2rm.onrender.com/`.
4. En **Menú → Copia de seguridad**, el backend verifica que seas administrador y Android pregunta dónde guardar el JSON (máximo 4 MB). Funciona incluso con la versión previa del panel web; el botón web de descarga de esa versión orienta hacia este menú. Nunca se descarga una copia automáticamente.
5. Usa **Borrar sesión** para retirar los accesos guardados del dispositivo. No elimina registros del servidor.

Las copias en preparación se conservan temporalmente en el almacenamiento privado excluido de respaldos de Android para poder terminar el guardado si se reinicia la actividad. Se borran al guardar, cancelar, descartarlas desde Menú o detectar que llevan más de una hora pendientes. El puente de exportación solo acepta una respuesta durante 45 segundos tras pulsar la opción nativa. WhatsApp admite respuestas lentas de la API con una confirmación nativa para los enlaces HTTPS `wa.me` válidos.

No permite HTTP para cuentas administrativas, certificados inválidos, navegación embebida a otro servidor, acceso a archivos locales ni puentes JavaScript abiertos a cualquier origen. Los enlaces externos iniciados por el usuario se abren en su aplicación correspondiente. Las capturas de pantalla del panel están deshabilitadas para proteger los datos de clientes.

## Compilación

Desde `android`:

```sh
./gradlew :adminapp:testDebugUnitTest :adminapp:lintDebug :adminapp:lintRelease :adminapp:assembleDebug :adminapp:assembleRelease
```

CI: `.github/workflows/android-admin.yml`. El release de CI no contiene llaves y necesita firma antes de instalar. Con la configuración privada de firma existente, usa `java scripts/SignRelease.java adminapp/build/outputs/apk/release/adminapp-release-unsigned.apk /ruta/apksigner.jar /ruta/TV-Digital-Administracion-1.0.0.apk`.

## Validación antes de uso real

- Inicio de sesión con cada rol y cierre de sesión.
- Alta, edición, renovación y eliminación con registros de prueba.
- Guardar/cancelar copia de seguridad con cuenta administradora.
- Abrir enlaces de WhatsApp y volver a la app.
- Rotación, teclado, navegación Atrás, pérdida de red y cambio de servidor.

Las pruebas unitarias verifican el aislamiento del servidor y la validación de exportaciones. Una compilación y lint correctos no prueban que el despliegue remoto esté activo ni sustituyen una prueba en dispositivo. No se cambiaron cuentas ni datos reales para generar la APK.
