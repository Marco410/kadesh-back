# Store (tienda de Kadesh Pet)

Tienda de `pet.kadesh.com.mx`. Un solo catálogo con tres orígenes de producto:

| `source` | Qué es | Cómo se compra | Qué ve la persona |
|---|---|---|---|
| `own` | Producto de Kadesh, con stock contado o sobre pedido | En Kadesh | Vendido por Kadesh |
| `dropi` | Dropshipping: Kadesh cobra, Dropi surte y envía | En Kadesh | Vendido por Kadesh |
| `mercado_libre` | Enlace de afiliado | En Mercado Libre | Disponible en Mercado Libre |

Se administra en kadesh-business → Operaciones → Kadesh Pet → Tienda.

Lo que hay: catálogo, lista de deseos y reseñas (fase 1); carrito, pedidos, pago con tarjeta o transferencia, compra como invitado y envíos a mano (fase 2). Faltan Dropi automático, cupones y huellitas por compra (plan en `~/.claude/plans/ayudame-con-un-plan-gleaming-codd.md`).

Las lists viejas de esta carpeta (`Product`, `Cart`, `Order`, `Payment`, `PaymentMethod`, `WishList`) no se usan y se retiran en la fase 6. No construir nada sobre ellas.

## Piezas

| Qué | Dónde |
|---|---|
| Enums, límites y topes | `constants.ts` (cambiarlos no requiere migración) |
| Lists | `StoreCategory`, `StoreBrand`, `StoreProduct`, `StoreProductVariant`, `StoreProductImage`, `StoreWishlistItem`, `StoreProductReview` |
| Forma pública de un producto, portadas en lote, copias guardadas | `utils/store/catalog.ts` |
| Interruptor `STORE_ENABLED` y versión del catálogo | `utils/store/config.ts` |
| Slugs | `utils/store/slug.ts` |
| Consultas públicas | `storeCatalog`, `storeCatalogProduct`, `storeCatalogFacets`, `storeCatalogReviews` (`graphql/customs/queries/store/storeCatalog.ts`) |
| Consultas con sesión | `myStoreWishlist`, `myStoreWishlistIds` |
| Mutaciones con sesión | `setStoreWishlist`, `submitStoreProductReview`, `deleteMyStoreProductReview` (`graphql/customs/mutations/store/`) |
| Lista de productos en Operaciones | `adminStoreProducts` (`graphql/customs/queries/admin/adminStore.ts`) |
| Altas y ediciones del admin | API generada (`createStoreProduct`, `updateStoreProductVariant`, `updateStoreProductReview`…) |
| Lists de pedidos | `StoreOrder`, `StoreOrderItem`, `StorePayment`, `StoreShipment`, `StoreOrderEvent`, `StoreAddress`, `StoreSettings` (una fila) |
| Lo que cuesta un carrito | `quoteCart` en `utils/store/pricing.ts` (lo usan la vista previa y la compra) |
| Vida de un pedido: apartar stock, pagar, cancelar, reembolsar, envíos | `utils/store/orders.ts` (lo único que escribe pedidos, pagos, envíos y la línea de tiempo) |
| Ajustes (envío, formas de pago, banco) | `getStoreSettings` en `utils/store/settings.ts` (en memoria 1 min) |
| Correos del pedido | `utils/store/emails.ts` |
| Carrito y pedidos de la persona | `storeCartQuote`, `myStoreOrders`, `myStoreOrder`, `myStoreAddresses` (`queries/store/storeOrders.ts`) |
| Comprar | `placeStoreOrder` (`mutations/store/placeStoreOrder.ts`) |
| Después de comprar | `uploadStoreTransferProof`, `resumeStoreOrderPayment`, `cancelMyStoreOrder`, `saveMyStoreAddress`, `deleteMyStoreAddress` (`mutations/store/storeOrderActions.ts`) |
| Pedidos en Operaciones | `adminStoreOrders`, `adminStoreOrder` (`queries/admin/adminStoreOrders.ts`) y `adminReviewStoreTransfer`, `adminUpdateStoreShipment`, `adminCancelStoreOrder`, `adminRefundStoreOrder`, `adminSetStoreOrderNote` (`mutations/admin/storeOrders.ts`) |
| Stripe | `webhooks/stripeStore.ts` (lo llama `webhooks/stripe.ts`) |
| Vencimiento de pedidos sin pagar | `expireStoreOrders` + `.github/workflows/expire-store-orders.yml` (cada hora) |

Apagada hasta poner `STORE_ENABLED=true`. Apagada, el catálogo público responde vacío y las mutaciones de la persona se niegan; un admin de plataforma ve todo (vista previa antes de abrir).

## Invariantes

- **Dinero en centavos enteros de MXN** (`...Cents`). Nunca decimales.
- **Todas las lists `Store*` son solo admin en la API generada.** La gente lee por las consultas `storeCatalog*`, que arman la respuesta con `toCatalogItem`.
- **`source`, costo y proveedor nunca salen al público.** La respuesta pública trae `seller`: `kadesh` para `own` y `dropi`, `mercado_libre` para el resto. Dropi no se nombra en la tienda, en correos ni en el seguimiento.
- **Un producto se ve si está `active` y tiene precio** (`priceCents > 0`, es decir, al menos una variante activa con precio).
- **Todo producto se vende por variantes.** Sin opciones, tiene una sola variante con `title` vacío. Carrito y pedidos apuntarán siempre a una variante.
- **Copias guardadas, no campos virtuales**: `priceCents`, `compareAtPriceCents`, `stockTotal` (de las variantes activas), `ratingAverage`, `ratingCount` (de las reseñas publicadas) y `nameSearch`. Las escribe el servidor; un valor mandado por la API se descarta.
- **`compareAtPriceCents` del producto solo existe si es mayor que el precio**, para que "en oferta" sea un filtro `not null`.
- **Sin estrellas externas.** Todo producto empieza en 0; solo cuentan las reseñas hechas en Kadesh. No se importan calificaciones de Dropi ni de Mercado Libre.
- **Una reseña y un deseo por persona y producto** (`key` único `<userId>:<productId>`).
- **Una reseña oculta por un admin no vuelve**: su autor no puede editarla para republicarla.
- **Un producto con reseñas se archiva, no se borra.** Borrar uno sin reseñas se lleva sus variantes, sus fotos (con el archivo en R2) y los deseos.
- **`(source, externalId)` es único.** `externalId` vacío se guarda como `null`.

## Pedidos

Tres estatus que se mueven por separado:

| Campo | Valores | Quién lo mueve |
|---|---|---|
| `status` | `open`, `completed`, `cancelled` | Se completa solo al entregarse todo; se cancela al vencer, al cancelar o al reembolsar |
| `paymentStatus` | `pending`, `in_review` (comprobante por revisar), `paid`, `failed`, `refunded` | Webhook de Stripe o un admin que confirma la transferencia |
| `fulfillmentStatus` | `unfulfilled`, `partial`, `shipped`, `delivered`, `returned` | Se deriva de los envíos (`fulfillmentFromShipments`) |

Cómo se compra:

1. El navegador guarda el carrito y pide `storeCartQuote` (variantes y cantidades). El servidor pone precios, envío y total.
2. `placeStoreOrder` vuelve a cotizar. Si el total ya no es el que la persona vio (`expectedTotalCents`), no crea nada y devuelve la cotización nueva.
3. Aparta el stock contado, crea el pedido con copia de precios, costo y dirección, y abre el pago: un PaymentIntent de Stripe (tarjeta) o los datos bancarios (transferencia).
4. Tarjeta: el front confirma con Stripe Elements y el webhook `payment_intent.succeeded` lo marca pagado. Transferencia: la persona sube el comprobante (`in_review`) y un admin lo confirma o lo rechaza con un motivo.
5. Al pagarse se crean los envíos: uno para lo que manda Kadesh (`pending`) y uno por proveedor de Dropi (`pending_approval`). Un admin captura paquetería y guía y los va moviendo.
6. Sin pago a tiempo (60 min con tarjeta, 48 h con transferencia), el cron lo cancela y el stock regresa.

Invariantes de pedidos:

- **El servidor calcula todo el dinero.** Del navegador solo llegan variantes, cantidades, dirección y forma de pago.
- **Cada paso es una sentencia condicional que solo gana uno** (`updateMany ... where <estado anterior>`): un webhook repetido, un doble clic o el cron encimado con un admin no aplican dos veces. No hay transacciones interactivas.
- **El stock se aparta con `stock >= cantidad`**: dos personas no se llevan la misma última pieza. `StoreOrderItem.reservedQuantity` dice cuánto apartó cada línea; devolverlo lo pone en cero en la misma sentencia, así que no regresa dos veces.
- **El pedido es una copia.** Nombre, precio, costo, origen y dirección quedan como estaban al comprar; editar el producto o la dirección no lo cambia.
- **Un pedido pagado no se cancela: se reembolsa.** Con tarjeta el reembolso sale por Stripe; con transferencia el pedido se cancela y el dinero se devuelve desde el banco.
- **Dinero que llega a un pedido ya cancelado** (el banco confirmó tarde) queda registrado y avisa a los admins para reembolsarlo; no revive el pedido.
- **Nada del pedido que ve la persona nombra a Dropi**: los envíos salen como `preparing`, `in_transit`, `delivered`… con paquetería y guía.
- **La línea de tiempo (`StoreOrderEvent`) guarda quién hizo cada paso.** Sin actor = el sistema (Stripe o el cron). Solo las filas `isPublic` las ve quien compró.
- **Compra como invitado**: el formulario pide correo y contraseña, y la cuenta se crea con el pedido, ya con sesión. La cuenta solo se crea cuando el carrito ya se validó. Si el correo ya existe, se pide iniciar sesión.
- **«Compra verificada»** en una reseña: la persona recibió ese producto en un envío entregado.
- **Un producto que está en pedidos o tiene reseñas se archiva, no se borra.**

Stripe: el endpoint de webhooks necesita además `payment_intent.succeeded` y `payment_intent.payment_failed` (ya tenía `charge.refunded`). Los pagos de la tienda llevan `metadata.kind = "store_order"`.

## Nombres que chocan con Keystone

Keystone genera `storeProducts`, `storeProduct`, `storeProductReviews`, `createStoreProduct`… para estas lists. Una consulta o mutación propia con ese nombre la pisa.

- Lo público empieza con `storeCatalog`.
- La compra es `placeStoreOrder`, no `createStoreOrder`.
- Las direcciones de la persona son `StoreShippingAddress`, `saveMyStoreAddress` y `deleteMyStoreAddress`: `StoreAddress` y `deleteStoreAddress` son los de la list.
- Un campo `xCount` choca con el conteo que Keystone agrega a la relación `x` (por eso `StoreOrder.unitsCount` y no `itemsCount`).
- `StoreSettings` necesita `graphql.plural` propio (`ManyStoreSettings`).
- Antes de dar por buena una list o un nombre nuevo, construir el esquema: el choque truena al arrancar, no al compilar.

## Consultas por petición

Medido con 12 y con 48 productos: el número no cambia.

| Consulta | Sentencias SQL |
|---|---|
| `storeCatalog` (con filtro de categoría) | 5 |
| `storeCatalogProduct` | 9 |
| `adminStoreProducts` | 6 |
| `storeCatalogFacets` | 5, una vez cada 10 min |
| `storeCartQuote` | 2 a 3 (variantes con su producto, portadas; los ajustes salen de memoria) |
| `myStoreOrders` | 4 |
| `adminStoreOrders` | 5 (en dos rondas) |

Las URLs de las fotos van firmadas por 1 h: los fronts deben cachear estas páginas menos de eso.

## Decisiones

### 2026-11-18 — catálogo, lista de deseos y reseñas

Qué: siete lists nuevas con prefijo `Store`, consultas públicas propias y admin por la API generada.

Por qué:
- **Lists nuevas y no las seis que ya existían**: `Product` no tenía imagen, stock ni variantes y `Cart` no guardaba cantidades. Cambiarlas era reescribirlas, y sus nombres (`Order`, `Payment`) se confunden con los del SaaS.
- **Solo admin en la API generada y lectura por consultas propias**: una sola regla que revisar para que no se escape el costo ni el proveedor, y las portadas y los conteos salen en lote. Keystone resuelve las relaciones a-muchos con una consulta por fila.
- **`source` interno y `seller` público**: la persona compra a Kadesh; quién surte es asunto de la operación.
- **Reseñas propias en una list nueva y no en `Review`**: `Review` es de veterinarias, no tiene llave única por persona y su promedio es un campo virtual con una consulta por fila.
- **Carrito en el navegador** (fases siguientes): el servidor solo valida y cotiza. Sin tabla de carrito no hay escrituras por cada clic.
- **Dropi no entrega calificaciones** y Mercado Libre no ofrece API para enlaces de afiliado: el enlace se pega a mano en `affiliateUrl`.

Qué no hacer:
- No abrir la lectura de las lists `Store*` en la API generada.
- No devolver `source`, `costCents`, `dropiSupplierId` ni `externalId` en una consulta pública.
- No pedir portada, promedio o conteo de variantes por fila: `loadStoreCovers` y las copias guardadas.
- No escribir `priceCents`, `stockTotal` ni `ratingAverage` a mano: `recomputeStoreProductTotals` y `recomputeStoreProductRating`.
- No mostrar un producto de Mercado Libre con botón de carrito: no se cobra en Kadesh.

### 2026-11-19 — pedidos, pago y envíos

Qué: siete lists de pedidos, la cotización en el servidor, `utils/store/orders.ts` como único que escribe pedidos, Stripe por PaymentIntent y transferencia con comprobante.

Por qué:
- **Carrito en el navegador y cotización en el servidor**: sin tabla de carrito no hay escrituras por cada clic, y el precio nunca viene del navegador.
- **PaymentIntent que confirma el navegador, y no un cobro directo como en los créditos**: la tarjeta puede pedir 3D Secure y Stripe lo resuelve en su formulario. El pedido se marca pagado por el webhook, no por lo que diga el navegador.
- **Sin transacciones**: el prisma de Keystone devuelve los errores en vez de lanzarlos y una transacción ocuparía una de las 5 conexiones. Cada paso es atómico por su cuenta y el cron deshace lo que quede a medias.
- **Tres estatus y no uno**: un pedido puede estar pagado y sin surtir, o surtido a medias; un solo estatus obliga a inventar combinaciones.
- **Envío con tarifa fija** (ajustable sin deploy, gratis desde un monto): cotizar con la paquetería en el checkout lo haría depender de un tercero en el momento de cobrar. El costo real se captura en cada envío para ver el margen.
- **Contraseña en el formulario de invitado**: no existe recuperación de contraseña, así que una cuenta creada con una contraseña al azar quedaría sin forma de entrar.
- **Folio al azar (`KP-` y 8 letras o números sin 0, O, 1, I)**: se dicta por teléfono y se escribe como concepto de la transferencia; al no ser consecutivo no revela cuántos pedidos hay.

Qué no hacer:
- No escribir `StoreOrder`, `StorePayment`, `StoreShipment` ni `StoreOrderEvent` fuera de `utils/store/orders.ts`.
- No marcar un pedido como pagado desde el front ni desde una mutación del comprador.
- No confiar en un total, precio o costo que mande el navegador.
- No tocar `stock` a mano al cancelar: `restoreStoreOrderStock`.
- No devolver `source`, costo, proveedor ni `provider` del envío en consultas del comprador.

## Pendientes

- No hay «olvidé mi contraseña» en ningún front: una cuenta creada al comprar depende de la contraseña que eligió la persona (o de entrar con Google con ese correo).
- Reembolsos parciales: hoy solo el total. Uno parcial hecho en Stripe queda anotado en el pedido.
- Fase 3: cliente de Dropi (`https://api.dropi.mx/integrations/`, cabecera `dropi-integration-key`), importador, aprobar el envío y mandarlo a Dropi, crons de seguimiento y de stock. Hoy un envío de Dropi se pide a mano en Dropi y se captura su guía aquí.
- Fase 4: cupones; huellitas por compra (10 por producto distinto, al entregarse) y por reseñar lo comprado (5); invitación a reseñar.
- Fase 6: retirar las lists viejas, `Review.product` y `Ad.product`.
