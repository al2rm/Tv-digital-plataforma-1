# Panel administrativo de TV Digital Pro

Panel React + Vite adaptable a celular y escritorio.

## Funciones

- resumen de ventas e ingresos;
- embudo de leads;
- creación y edición de contactos;
- bandeja híbrida de WhatsApp;
- mensajes y plantillas;
- ejecución manual de automatizaciones;
- clientes y consentimiento;
- suscripciones, renovaciones y pagos.

## Uso

```bash
npm install
cp .env.example .env
npm run dev
```

La variable `VITE_API_URL` debe apuntar a la API, por ejemplo:

```env
VITE_API_URL=http://localhost:3000/api
```

Para verificar la compilación:

```bash
npm run build
```
