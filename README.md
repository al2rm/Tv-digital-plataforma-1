# TV Digital Pro

Plataforma de administración, ventas y automatización para un servicio autorizado
de TV digital.

## Módulos

- `backend/`: API REST Node.js, Express, PostgreSQL y JWT.
- `admin/`: panel web React + Vite adaptable a celular y escritorio.
- `android/`: espacio reservado para la aplicación Android Kotlin + Media3.
- `docs/`: documentación funcional y técnica.

## Automatización híbrida

La primera versión incluye:

- CRM con embudo de leads;
- registro de origen de marketing y anuncios de Meta;
- consentimiento y baja de WhatsApp;
- mensajes preparados mediante enlaces `wa.me`;
- adaptador para WhatsApp Cloud API;
- webhook firmado para mensajes y estados;
- plantillas de bienvenida, planes, pago y renovación;
- recordatorios 3 días antes, el día del vencimiento y 3 días después;
- clientes, planes, suscripciones, pagos e indicadores;
- panel móvil para operar el negocio.

Consulta [INSTRUCCIONES.md](INSTRUCCIONES.md) para ejecutarlo y
[docs/AUTOMATIZACION-HIBRIDA.md](docs/AUTOMATIZACION-HIBRIDA.md) para conocer
los flujos.

## Estado verificado

- pruebas del backend;
- comprobación de sintaxis;
- migraciones ejecutadas sobre PostgreSQL compatible;
- compilación de producción del panel;
- revisión visual de escritorio y móvil.

Los secretos se configuran únicamente mediante archivos `.env`, que no deben
subirse al repositorio.

## Prueba gratuita en Render

El archivo `render.yaml` despliega el panel y la API como un único servicio web
y crea una base PostgreSQL gratuita. Render solicitará el correo y la clave del
primer administrador durante la creación.

> La base gratuita de Render caduca 30 días después de su creación. Este modo
> sirve para validar el sistema, no para conservar datos reales de clientes.

Consulta [docs/DEPLOY-RENDER.md](docs/DEPLOY-RENDER.md) antes de desplegar.
