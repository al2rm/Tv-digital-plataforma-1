# Respaldo y recuperación antes de publicar

La descarga JSON de **Actividad y papelera** es una exportación de negocio, no una
copia recuperable de toda la base. Omite contraseñas, proveedores cifrados y otras
tablas. No debe utilizarse como única protección frente al vencimiento de PostgreSQL.

## Copia completa

En un entorno privado con `pg_dump` y `pg_restore` de versión compatible, configura
`DATABASE_URL` y SSL sin pegar credenciales en chat ni guardarlas en Git. Ejecuta desde
`backend` (la carpeta destino debe existir):

```sh
npm run db:backup -- /ruta/privada/tv-digital.dump
npm run db:backup:verify -- /ruta/privada/tv-digital.dump
```

El comando no sobreescribe archivos. Usa permisos 0600 y evita contraseñas en la línea
de comandos. Guarda la copia fuera del servidor, en almacenamiento privado cifrado.
Si falla, el archivo parcial no es una copia válida. La copia contiene datos personales,
hashes y credenciales cifradas: no adjuntarla a un repositorio público.

Conserva por separado y de forma privada `XTREAM_CREDENTIALS_KEY`, configuración y
keystore de Android. Sin la clave Xtream original no se pueden recuperar proveedores.
No exportes secretos desde servicios a los que no tengas acceso autorizado.

## Prueba de restauración

1. Crea una base PostgreSQL vacía de ensayo, nunca uses la base activa como destino.
2. Configura variables PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD y PGSSLMODE
   para ese destino privado. Confirma el nombre de la base antes de continuar.
3. Restaura usando `pg_restore --no-owner --no-acl --exit-on-error --single-transaction
   --dbname="$PGDATABASE" /ruta/privada/tv-digital.dump`.
4. Ejecuta migraciones y valida login, clientes, suscripciones, canales y proveedores.
5. Compara cantidades y datos esenciales con el origen. Conserva evidencia sin secretos.

`pg_restore --list` solo comprueba la legibilidad del archivo. El respaldo no se
considera validado hasta completar la restauración de ensayo.

## Continuidad

Antes del vencimiento de una base de prueba, el titular debe elegir un plan persistente
o un nuevo PostgreSQL. Cambiar el proveedor o contratar un plan requiere su aprobación.
No habilites pagos o renovaciones comerciales hasta asegurar esta continuidad.
