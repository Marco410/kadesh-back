# Donaciones «Dame una patita»

Donaciones únicas a Kadesh Pet. La unidad es la **patita** (1 = $25 MXN, `DONATION_UNIT_PRICE_CENTS`).
**No confundir con las huellitas** (`models/Pet/Paws`, puntos por ayudar): donar no da huellitas, no
sube de nivel y no desbloquea nada. Los identificadores de este módulo nunca llevan `paw`.

## Flujo

1. El landing llama `startDonation(input)` (se llama así porque Keystone ya genera `createDonation`).
   - Con sesión: el correo y la cuenta salen de la sesión; el nombre, si no viene, de la cuenta.
   - Sin sesión: correo obligatorio y Turnstile (`verifyTurnstile`).
   - Crea la `Donation` en `pending` y su PaymentIntent (`metadata.kind = "donation"`,
     `idempotencyKey: donation-<id>`). `checkoutKey` hace que un reintento devuelva la misma donación.
   - Límite: `donation_ip`, 10 por hora por IP (`utils/security/constants.ts`).
2. El landing confirma el pago con Stripe Elements.
3. El webhook (`webhooks/stripeDonation.ts`) la marca `paid`, manda el correo de gracias y avisa a
   los admins en la campana (`donation.admin_received`). Pago rechazado → `failed`; reembolso total
   desde Stripe → `refunded` (sale del muro y del ranking).

Solo cuenta lo que el webhook marcó `paid`.

## Público

| Consulta | Qué da | Caché |
|---|---|---|
| `donationWall(take ≤ 20, skip)` | Nombre con inicial o «Alguien anónimo», patitas, mensaje, fecha | 10 min (solo la primera página) |
| `donorRanking(period: "month" \| "all_time", take ≤ 10)` | Top por patitas; los anónimos no se juntan; sin staff ni cuentas de prueba | 10 min por periodo |
| `donationSummary` | Personas, patitas y `wallMessages` (pagadas con mensaje visible en el muro; la landing muestra el muro desde 5) | 10 min |

Las tres se invalidan al pagar, reembolsar o editar una donación (`bumpDonationsDataVersion`).
Nunca se publica el correo, el apellido completo ni el monto en pesos.

## Cuándo cuenta

Cuando Stripe confirma el pago: por el webhook (`payment_intent.succeeded`) o por `settleDonation(donationId)`, que la landing llama justo después de pagar y que solo consulta el PaymentIntent de esa donación. Los dos usan `markDonationPaid` (`webhooks/stripeDonation.ts`), así que los correos salen una sola vez. Localmente, sin `stripe listen`, solo cuenta por `settleDonation`.

## Quien no quiere aparecer

El formulario ofrece tres opciones: con su nombre, «Alguien anónimo» o **no aparecer** (`hideFromWall`).
Sin aparecer, la donación no sale en `donationWall` ni en `donorRanking`, pero sí cuenta en
`donationSummary`, y el mensaje solo llega al equipo (aviso en la campana y correo de gracias).

## Moderación

En el Admin UI («Donaciones (patitas)») marca `messageHidden` para ocultar un mensaje; la patita
sigue contando.

## Bandera

`DONATIONS_ENABLED=true` abre `startDonation` al público. Apagada, un admin de plataforma puede
probarla igual. El front tiene su propia bandera (`NEXT_PUBLIC_DONATIONS_ENABLED`).
