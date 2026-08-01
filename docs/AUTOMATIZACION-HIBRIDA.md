# Automatización híbrida de TV Digital Pro

## Flujo comercial

1. Un anuncio o recomendación dirige al contacto a WhatsApp.
2. El webhook registra el lead y su origen.
3. El mensaje de bienvenida califica la necesidad.
4. El administrador mueve el lead por el embudo:
   `nuevo`, `contactado`, `interesado`, `esperando_pago`, `activo` o `perdido`.
5. Al crear la cuenta y suscripción se registra el consentimiento.
6. La renovación puede registrar el pago y preparar la confirmación.

## Avisos de suscripción

Cada suscripción con teléfono y consentimiento genera tres trabajos:

- tres días antes del vencimiento;
- el día del vencimiento;
- tres días después, si todavía no fue renovada.

Al renovar se cancelan los trabajos anteriores y se crean los correspondientes
al nuevo vencimiento.

## Modos de WhatsApp

### Asistido

No requiere credenciales de Meta. El sistema prepara el texto y abre un enlace
oficial `wa.me`; el administrador confirma manualmente el envío.

### Cloud API

Envía mediante la API oficial, recibe mensajes y actualiza los estados enviado,
entregado, leído o fallido. Requiere credenciales configuradas en variables de
entorno, webhook HTTPS y plantillas aprobadas cuando corresponda.

## Consentimiento

- Un mensaje entrante nuevo abre el flujo de atención.
- `STOP`, `BAJA`, `SALIR` o `CANCELAR` registra la baja.
- `ALTA`, `ACEPTO` o `ACTIVAR MENSAJES` vuelve a registrar la autorización.
- Los mensajes iniciados desde el panel exigen consentimiento.
- No deben usarse listas compradas ni envíos masivos no solicitados.

## Marketing inicial

La campaña preparada para pruebas puede conservar los parámetros definidos:

- ubicación: Paraguay;
- edad: 18 a 55 años;
- presupuesto: 30.000 Gs por día;
- duración: 7 días;
- horario: 08:00 a 23:00;
- destino: conversación de WhatsApp.

Los campos `campaign_id`, `adset_id`, `ad_id`, `utm_source` y `utm_campaign`
permiten atribuir cada lead y medir posteriormente su conversión.
