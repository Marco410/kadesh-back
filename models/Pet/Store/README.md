# Store (tienda de Kadesh Pet)

Tienda de `pet.kadesh.com.mx`. Un solo catálogo con tres orígenes de producto:

| `source` | Qué es | Cómo se compra | Qué ve la persona |
|---|---|---|---|
| `own` | Producto de Kadesh, con stock contado o sobre pedido | En Kadesh | Vendido por Kadesh |
| `dropi` | Dropshipping: Kadesh cobra, Dropi surte y envía | En Kadesh | Vendido por Kadesh |
| `mercado_libre` | Enlace de afiliado | En Mercado Libre | Disponible en Mercado Libre |

Se administra en kadesh-business → Operaciones → Kadesh Pet → Tienda.

Fase 1 (lo que hay): catálogo, lista de deseos y reseñas. Carrito, pedidos, pagos, envíos, Dropi, cupones y huellitas por compra son las fases siguientes (plan en `~/.claude/plans/ayudame-con-un-plan-gleaming-codd.md`).

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

## Nombres que chocan con Keystone

Keystone genera `storeProducts`, `storeProduct`, `storeProductReviews`, `createStoreProduct`… para estas lists. Una consulta o mutación propia con ese nombre la pisa.

- Lo público empieza con `storeCatalog`.
- En la fase 2, la mutación de compra no puede llamarse `createStoreOrder` si la list se llama `StoreOrder`. Usar `placeStoreOrder`.

## Consultas por petición

Medido con 12 y con 48 productos: el número no cambia.

| Consulta | Sentencias SQL |
|---|---|
| `storeCatalog` (con filtro de categoría) | 5 |
| `storeCatalogProduct` | 9 |
| `adminStoreProducts` | 6 |
| `storeCatalogFacets` | 5, una vez cada 10 min |

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

## Pendientes

- Fase 2: `StoreAddress`, `StoreOrder`, `StoreOrderItem`, `StorePayment`, `StoreOrderEvent`, `StoreSettings`; Stripe y transferencia; compra como invitado. Agregar `orderItem` a `StoreProductReview` y llenar `verifiedPurchase`.
- Fase 3: cliente de Dropi (`https://api.dropi.mx/integrations/`, cabecera `dropi-integration-key`), importador, `StoreShipment`, crons de seguimiento y de stock.
- Fase 4: cupones; huellitas por compra (10 por producto distinto, al entregarse) y por reseñar lo comprado (5); invitación a reseñar.
- Fase 6: retirar las lists viejas, `Review.product` y `Ad.product`.
