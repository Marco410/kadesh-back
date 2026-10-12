# SystemRelease — novedades de la plataforma

Cada fila es una novedad (versión, producto, título, notas, fecha). Las publicadas salen en **Novedades** del panel del cliente (Negocios ve las de `saas` y `all`) y de Pet. Las crea y edita el admin de Kadesh desde Operaciones → Novedades; los borradores solo los ve el admin.

## Correo

`SystemRelease.hooks.ts` manda un correo a las personas del producto (SaaS = con empresa, Pet = sin empresa, Ambas = todos; sin cuentas de prueba) **cuando la novedad pasa a publicada**: al crearla publicada o al publicar un borrador.

- `notifyByEmail` (por defecto sí): quitarlo para publicar sin correo.
- `emailedAt`: cuándo se mandó. Se marca antes de enviar con una actualización condicional (`emailedAt` vacío), así dos guardados seguidos no mandan dos correos.
- Editar una novedad que ya estaba publicada nunca manda correo. Así las novedades de antes de este cambio (publicadas y sin `emailedAt`) no se vuelven a mandar al corregirles algo.

## Decisiones

### 2026-10-12 — Correo al publicar, no solo al crear

Antes el correo solo salía si la novedad se creaba ya publicada: un borrador que se publicaba después nunca avisaba, y no había forma de publicar sin correo. Ahora sale al publicar, una sola vez, y se puede apagar por novedad. Requiere `yarn migrate` (columnas `notifyByEmail` y `emailedAt`).
