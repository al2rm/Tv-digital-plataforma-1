# Cierre de TV Digital Pro 1.4.1

## Lo que debe pasar antes de afirmar «100 % terminado»

- CI de backend, panel y Android sin fallos.
- `/api/health` responde 200 y `/api/health/ready` confirma conexión a PostgreSQL.
- Respaldo PostgreSQL completo y restauración probada en una base de ensayo.
- Plan persistente de base y servidor definido por el titular.
- APK release firmado con la identidad definitiva y certificado verificado.
- Prueba física en TV Box (las pruebas unitarias no verifican mando, codecs ni DRM real).
- Fuentes de contenido autorizadas y cuentas vigentes para el uso previsto.
- Pasarela de pagos seleccionada, cuenta comercial activa y webhooks verificados antes de cobros.
- WhatsApp Cloud conectado y plantillas aprobadas antes de mensajes automáticos.

No habilitar automáticamente pagos, compras de planes ni envíos comerciales usando
credenciales inferidas. La exportación JSON del panel NO es un respaldo recuperable
de PostgreSQL: seguir RESPALDO-PRODUCCION.md.

## Prueba física: 10 minutos

1. Instalar el APK debug desde el artefacto correspondiente a esta versión.
2. Iniciar sesión con un cliente activo. Al reabrir, comprobar sesión persistente.
3. Navegar a Inicio, favoritos, películas, series, configuración y sobre la app.
4. Abrir un canal con OK, volver con Atrás y verificar el foco sobre la misma tarjeta.
5. Buscar un nombre con tildes y sin tildes; borrar la búsqueda.
6. Agregar un favorito manteniendo OK y quitarlo.
7. Pausar una película, salir y reabrir: verificar la posición y Continuar viendo.
8. Terminar una película: verificar Reproducir de nuevo y borrado del progreso.
9. Reproducir contenido con PIN y probar un PIN incorrecto.
10. Probar fuente principal/alternativa, audio, subtítulos y regreso desde episodios.

La variante release segura rechaza HTTP por defecto. Si el proveedor necesita HTTP,
generar una variante explícita con `-PALLOW_HTTP_STREAMS=true`; no desactivar TLS de
licencias ni validación de certificados. El debug admite HTTP para pruebas.
El flujo CI ofrece ambos artefactos release: HTTPS seguro y variante HTTP heredada.
HTTP no cifra las transmisiones; usarlo solo con fuentes autorizadas que lo requieran.

Si un canal no tiene logo, su nombre se muestra como respaldo; cuando carga el logo,
la tarjeta conserva el aspecto solo imagen acordado.

## Diagnóstico

«Manifiesto válido» comprueba la estructura HLS, no garantiza decodificación ni
reproducción de cada segmento. «Xtream sin verificar» solo registra que el proveedor
está configurado y activo en nuestra base: la señal debe probarse en la APK.
El diagnóstico revisa hasta 100 activos por lote (primero los más antiguos), conserva
fallas consecutivas y nunca elimina ni oculta automáticamente canales.

## Firma

El flujo genera release sin credenciales. La firma se realiza localmente con el
keystore configurado o con un entorno seguro autorizado; nunca subir el keystore ni
keystore.properties a Git. El certificado debe coincidir con la versión instalada
para permitir una actualización. Mantener una copia privada de la clave antes de distribuir.
Desde la carpeta `android`, con Java 17 y la configuración privada existente:

```sh
java scripts/SignRelease.java /ruta/app-release-unsigned.apk /ruta/apksigner.jar /ruta/nuevo-release.apk
```

El programa rechaza sobrescribir una salida y comprueba la firma inmediatamente.
