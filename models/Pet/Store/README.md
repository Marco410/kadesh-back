# Store (tienda de Kadesh Pet)

Tienda de `pet.kadesh.com.mx`. Un solo catálogo con tres orígenes de producto:

| `source` | Qué es | Cómo se compra | Qué ve la persona |
|---|---|---|---|
| `own` | Producto de Kadesh, con stock contado o sobre pedido | En Kadesh | Vendido por Kadesh |
| `dropi` | Dropshipping: Kadesh cobra, Dropi surte y envía | En Kadesh | Vendido por Kadesh |
| `mercado_libre` | Enlace de afiliado | En Mercado Libre | Disponible en Mercado Libre |

Se administra en kadesh-business → Operaciones → Kadesh Pet → Tienda.

Lo que hay: catálogo, lista de deseos y reseñas (fase 1); carrito, pedidos, pago con tarjeta o transferencia, compra como invitado y envíos a mano (fase 2); cupones, huellitas por comprar y por reseñar lo comprado, e invitación a reseñar al entregarse (fase 4). Falta Dropi automático (fase 3, en espera de que Dropi dé acceso a su API).

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
| Reporte de ventas | `adminStoreSummary` (`queries/admin/adminStoreSummary.ts`): ventas, margen, por día, por origen, más vendidos, cupones e inventario |
| Stripe | `webhooks/stripeStore.ts` (lo llama `webhooks/stripe.ts`) |
| Cupones | lists `StoreCoupon` y `StoreCouponRedemption`; `evaluateCoupon`, `reserveCoupon`, `releaseStoreOrderCoupon` en `utils/store/coupons.ts`. El admin los crea con la API generada |
| Huellitas de la tienda | `pawsOnStoreShipmentDelivered`, `pawsOnStorePurchaseUndone`, `pawsOnStoreProductReview` en `utils/pet/pawsTriggers.ts`; reglas en `models/Pet/Paws/constants.ts` |
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
- **Agregar al carrito desde la tarjeta**: `singleVariantId` viene solo si el producto lo vende Kadesh, hay stock y tiene una sola variante a la venta; con varias (`variantsCount` > 1) hay que elegir en la ficha. Sale de `loadStoreSaleVariants`, una consulta para toda la página.
- **Una reseña y un deseo por persona y producto** (`key` único `<userId>:<productId>`).
- **Una reseña oculta por un admin no vuelve**: su autor no puede editarla para republicarla.
- **Cada reseña pública lleva el `id` de su autor** (`author.id`): la app lo usa para ocultar las reseñas de quien la persona bloqueó y para reportar o bloquear al autor (requisito de las tiendas de apps).
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
- **«Compra verificada»** en una reseña: la persona recibió ese producto en un envío entregado de un pedido que no se reembolsó.
- **Un producto que está en pedidos o tiene reseñas se archiva, no se borra.**

## Cupones

Un código (`StoreCoupon.code`, en mayúsculas y sin espacios: `normalizeCouponCode`) de tres tipos: `percent`, `fixed` (centavos) o `free_shipping`. Puede pedir un subtotal mínimo, tener tope de descuento, fechas, límite de usos en total y por persona, ser solo para la primera compra, y aplicar solo a ciertas categorías (incluye sus subcategorías) o productos. Sin categorías ni productos aplica a todo el carrito.

- **Una sola revisión para la vista previa y la compra**: `quoteCart(items, { couponCode, userId })` llama a `evaluateCoupon`. Un código que no aplica no rompe la cotización: sale `couponApplied: false` con el motivo en `couponMessage`.
- **El descuento es sobre los productos, nunca sobre el envío.** `totalCents = subtotalCents − couponDiscountCents + shippingCents`. Un cupón de envío gratis deja `shippingCents` en 0 y `couponDiscountCents` en 0.
- **El total nunca baja de `STORE_MIN_ORDER_TOTAL_CENTS`** ($10): Stripe no cobra menos.
- **Un uso se toma con un incremento condicional** (`usedCount < usageLimit`) al crear el pedido. Si alguien más se llevó el último, el pedido recién creado se cancela (regresa su stock) y la compra responde `COUPON_INVALID`.
- **El uso se devuelve** cuando el pedido se cancela sin pagar, vence o se reembolsa (`releaseStoreOrderCoupon`, una sentencia que borra la fila de `StoreCouponRedemption` y descuenta `usedCount`; llamarla dos veces no descuenta dos).
- **`usedCount` lo lleva el servidor**: lo que mande la API se descarta.
- **Sin sesión no se revisan las reglas por persona** (usos por persona, primera compra): se revisan al comprar, donde siempre hay cuenta.
- **En el pedido queda copia**: `StoreOrder.couponCode` y `couponDiscountCents`, y en cada línea su parte (`StoreOrderItem.discountCents`).
- **Probar códigos tiene tope**: 20 códigos que no aplicaron cada 10 min por IP en `storeCartQuote`. Un cupón que sí aplica no cuenta: el carrito se cotiza con él en cada cambio.

## Huellitas

Decisión de Marco (2026-11-19): comprar y reseñar dan huellitas; todavía no se paga con ellas.

| Acción | Huellitas | Cuándo | Llave |
|---|---|---|---|
| `purchase` | 10 por línea del pedido (no por pieza) | Al marcarse entregado el envío que la lleva | `purchase:<orderItemId>` |
| `product_review` | 5, con cualquier calificación | Al publicar la reseña de algo comprado y recibido | `product_review:<userId>:<productId>` |

- Solo cuentan líneas de $100 o más ya con el descuento del cupón (`PURCHASE_MIN_LINE_CENTS`). Tope de 3 al día por acción. No cuentan para la racha ni para el tope global de 60.
- Se quitan si el envío se marca devuelto o el pedido se reembolsa (compra), y si la persona borra su reseña o un admin la oculta (reseña).
- Una reseña sin compra verificada (incluye todo lo de Mercado Libre) no da nada.
- La invitación a reseñar sale una sola vez, cuando el pedido completo se entrega: la notificación `store.order_delivered` y el correo de entrega, con un botón por producto (hasta 5) hacia `/tienda/<slug>#resenas`.

Stripe: el endpoint de webhooks necesita además `payment_intent.succeeded` y `payment_intent.payment_failed` (ya tenía `charge.refunded`). Los pagos de la tienda llevan `metadata.kind = "store_order"`.

## Reporte de ventas

`adminStoreSummary(days)` responde para 7, 30, 90 o 365 días (otro valor = 30).

- **Una venta es un pedido con `paymentStatus: paid`**, contado el día de `paidAt` en hora de CDMX. Un pedido reembolsado deja de ser venta y sale en «Reembolsos» el día de `cancelledAt`.
- **No cuentan los pedidos de cuentas de prueba** (`User.userTest`).
- **Ventas** = lo que pagó la gente (productos − cupones + envío cobrado). **Margen** = ventas − costo de productos (`StoreOrder.costCents`) − costo real de los envíos (`StoreShipment.shippingCostCents`). No descuenta la comisión de Stripe.
- **Por origen** usa las líneas: lo que dejó cada una ya con su parte del cupón (`totalCents − discountCents`).
- **Todo se agrega en la base**: el número de sentencias no crece con los pedidos. La serie es por día hasta 90 días y por mes en 365.
- **Los montos van como `Float`** en GraphQL: una suma en centavos puede pasar del tope de `Int` (unos 21 millones de pesos).
- **Inventario** (agotados y por agotarse) es el de ahora, no el del periodo.
- Se guarda 5 min en memoria por periodo (cuatro entradas como mucho).

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
| `storeCatalog` (con filtro de categoría) | 6 (las variantes a la venta de toda la página en una) |
| `storeCatalogProduct` | 10 |
| `adminStoreProducts` | 6 |
| `storeCatalogFacets` | 5, una vez cada 10 min |
| `storeCartQuote` | 2 a 3 (variantes con su producto, portadas; los ajustes salen de memoria); con cupón, de 1 a 3 más |
| `myStoreOrders` | 4 |
| `adminStoreOrders` | 5 (en dos rondas) |
| `adminStoreSummary` | 8 (en dos rondas de 4), una vez cada 5 min por periodo; devuelve como mucho 90 puntos de serie y 10 filas por lista |

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

### 2026-11-19 — cupones y huellitas de la tienda

Qué: lists `StoreCoupon` y `StoreCouponRedemption`, el cupón dentro de `quoteCart`, y tres disparadores de huellitas.

Por qué:
- **El cupón vive en la cotización**: así la vista previa y la compra no pueden dar totales distintos, y `expectedTotalCents` ya cubre el caso de un cupón que cambió.
- **Fila de uso por pedido además del contador**: el contador permite el incremento condicional; la fila dice quién lo usó, sirve para el límite por persona y hace que devolver el uso sea idempotente.
- **Huellitas al entregar y no al pagar**: un pedido que se cancela o no llega no debe haber dado nada, y así no hay que deshacer en el caso común.
- **Por línea y con mínimo de $100**: suben nivel y ranking igual que ayudar, así que comprar cosas baratas para subir no debe convenir.
- **La invitación a reseñar va en el aviso de entrega y no en uno aparte**: un solo aviso por pedido, sin cron ni recordatorios.

Qué no hacer:
- No calcular un descuento fuera de `evaluateCoupon`, ni aceptar un monto de descuento del navegador.
- No escribir `usedCount` ni `StoreCouponRedemption` fuera de `utils/store/coupons.ts`.
- No dar huellitas al pagar ni por pieza.
- No premiar una reseña sin compra verificada.

## Pendientes

- No hay «olvidé mi contraseña» en ningún front: una cuenta creada al comprar depende de la contraseña que eligió la persona (o de entrar con Google con ese correo).
- Reembolsos parciales: hoy solo el total. Uno parcial hecho en Stripe queda anotado en el pedido.
- Fase 3: cliente de Dropi (`https://api.dropi.mx/integrations/`, cabecera `dropi-integration-key`), importador, aprobar el envío y mandarlo a Dropi, crons de seguimiento y de stock. Hoy un envío de Dropi se pide a mano en Dropi y se captura su guía aquí.
- El tope diario de huellitas cuenta premios dados, aunque luego se hayan revertido: quien borra y reescribe reseñas el mismo día se topa antes.
- Una reseña escrita antes de un reembolso conserva sus 5 huellitas (el reembolso solo quita las de la compra).
- Fase 6: retirar las lists viejas, `Review.product` y `Ad.product`.
