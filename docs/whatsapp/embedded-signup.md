# WhatsApp: Embedded Signup (Fase B — NO construido)

Fase A (asistente guiado BYOK) ya está en producción de código. Esta fase se construye **solo cuando Meta apruebe a Kadesh como Tech Provider**.

## Decisiones
- Costo: el cliente paga a Meta con su tarjeta dentro del flujo de Meta. Kadesh no revende mensajes.
- API oficial únicamente (nada de librerías no oficiales: riesgo de baneo).

## Prerrequisitos (los hace Marco, fuera del código)
1. Verificación de negocio de Kadesh en Meta.
2. App de Meta de Kadesh (tipo Business + producto WhatsApp) **publicada en modo Live**.
3. App Review con demostración: `whatsapp_business_management` y `whatsapp_business_messaging` (acceso avanzado).
4. URL de aviso de privacidad, términos y **callback de eliminación de datos**.
5. Actualizar el aviso de privacidad para cubrir mensajes de WhatsApp (revisión legal; no lo resuelve el código).

## Diseño previsto
- Env: `META_APP_ID`, `META_APP_SECRET`, `META_EMBEDDED_SIGNUP_CONFIG_ID`. Un solo webhook a nivel App.
- `webhooks/whatsapp.ts`: verificar firma con el secreto global cuando la empresa no trae uno propio.
- Front: SDK de Facebook + `FB.login({ config_id, response_type: "code" })`, escuchar `WA_EMBEDDED_SIGNUP` (`waba_id`, `phone_number_id`).
- Back: `completeWhatsappEmbeddedSignup(companyId, code, wabaId, phoneNumberId)`: canjear `code`, suscribir la App al WABA, registrar número, guardar cifrado, `ensureOutreachTemplate`.
- `SaasCompany.whatsappConnectionMode` (`byo | embedded`) para convivir con los BYOK.
