# Stremcore en TV Digital Pro

El panel incluye **Stremcore** en el menú de administrador y soporte. El conector consulta el formato JSON documentado en https://github.com/jexiptv07/stremcore/blob/main/doc/STREMCORE_API_DOC.md mediante HTTPS. No requiere contraseñas de Stremcore ni incorpora su código de scraping o un reproductor web externo.

## Usar la integración

1. Entra al panel web o a TV Digital Administración con tu cuenta y abre **Stremcore**.
2. Elige **Películas** o **Series**. Puedes filtrar por género, buscar por título en todo el índice y navegar por páginas de 40 fichas. La búsqueda conserva como máximo 500 coincidencias; afina el título si hace falta.
3. Abre una ficha. Para una serie, indica la temporada y selecciona hasta 50 episodios nuevos. Las temporadas se consultan por su número porque el catálogo no ofrece un inventario de temporadas en la ficha de la serie.
4. **Guardar borrador** importa la información con el contenido inactivo. Es la opción inicial y permite guardar fichas que solo traen páginas de reproductores externos.
5. Para **Publicar en la app con fuentes directas**, indica una URL de vídeo compatible por película o episodio. Si el catálogo trae una fuente directa, el panel permite seleccionarla. Se admiten HLS, DASH, MP4, M4V, WebM y TS; HTTP depende de `ALLOW_HTTP_STREAMS`. El servidor rechaza páginas embed como fuentes directas y direcciones de redes privadas.
6. Después puedes editar, activar o eliminar películas en **Catálogo**, y series/episodios en **Series y EPG**. Al actualizar el catálogo en Android se mostrarán los elementos activos.

Las páginas HTML de reproductores externos no son archivos de vídeo para Media3. El conector no las ejecuta ni extrae enlaces internos. Una extensión de vídeo compatible no garantiza disponibilidad, códecs o permisos del servidor: la reproducción final depende de la fuente que configures.

## Duplicados y recuperación

Las películas y series se identifican por origen e ID externo; los episodios por serie, temporada y número. Reimportar conserva las modificaciones locales y no duplica los episodios existentes. Puedes añadir nuevas temporadas a la misma serie. Eliminar una ficha permite volver a importarla; la papelera mantiene su funcionamiento habitual.

## Desplegar

La migración `013_stremcore_catalog.sql` agrega identificación de origen e índices únicos. No cambia usuarios, suscripciones ni pagos.

```sh
npm run db:migrate --prefix backend
npm run build --prefix admin
```

Reinicia el backend después de actualizar el código. En el despliegue Render del repositorio, el comando de inicio ya ejecuta las migraciones. La APK de administración carga el panel desplegado y la APK del reproductor utiliza las rutas de catálogo actuales: esta integración no necesita cambiar los paquetes Android.

Los JSON se descargan únicamente de `raw.githubusercontent.com/jexiptv07/stremcore/main`, sin redirecciones, con límites de tiempo, tamaño y caché. Los permisos y la auditoría administrativa se aplican también a las importaciones. Las búsquedas y fichas dependen de la disponibilidad del repositorio externo; la caché dura cinco minutos.
