import { KeystoneContext } from "@keystone-6/core/types";
import { AnimalTypes } from "../constants/constants";
import { recomputeStoreProductRating, recomputeStoreProductTotals, storePrisma } from "../store/catalog";
import { mxDayWindow, mxToday, shiftDay } from "../usage/dailyUsageRollup";

/**
 * Test data for the Kadesh Pet store, so it can be tried locally: categories, brands, products of
 * the three sources (in stock, low stock, sold out, made to order, draft), store settings with a
 * fake bank account, coupons, reviews and a month of orders in every status (for Pedidos and
 * Resumen in Operaciones).
 *
 * Idempotent: each part is skipped when its first row already exists. Everything is fake: photos
 * come from picsum.photos, the bank account and the people are made up.
 */

const SEED_EMAIL_DOMAIN = "tienda-seed.kadesh.local";

type Ids = Record<string, string>;

function photo(seed: string, index = 1) {
  return { externalUrl: `https://picsum.photos/seed/kadesh-${seed}-${index}/800/800`, order: index };
}

async function createTaxonomy(context: KeystoneContext): Promise<{ categories: Ids; brands: Ids } | null> {
  const sudo = context.sudo();
  const existing = await sudo.db.StoreCategory.findMany({ take: 1 });
  if (existing.length > 0) {
    console.log("♻️  Tienda: ya hay categorías, se salta el catálogo de prueba.");
    return null;
  }

  const categories: Ids = {};
  const parents = [
    { key: "dogs", name: "Perros", order: 1 },
    { key: "cats", name: "Gatos", order: 2 },
    { key: "hygiene", name: "Higiene", order: 3 },
  ];
  for (const parent of parents) {
    const row = await sudo.db.StoreCategory.createOne({ data: { name: parent.name, order: parent.order, isActive: true } });
    categories[parent.key] = String(row.id);
  }
  const children = [
    { key: "dogFood", name: "Alimento para perro", parent: "dogs", order: 1 },
    { key: "dogToys", name: "Juguetes para perro", parent: "dogs", order: 2 },
    { key: "walk", name: "Paseo", parent: "dogs", order: 3 },
    { key: "beds", name: "Camas", parent: "dogs", order: 4 },
    { key: "catFood", name: "Alimento para gato", parent: "cats", order: 1 },
    { key: "litter", name: "Arenas", parent: "cats", order: 2 },
    { key: "scratchers", name: "Rascadores", parent: "cats", order: 3 },
  ];
  for (const child of children) {
    const row = await sudo.db.StoreCategory.createOne({
      data: { name: child.name, order: child.order, isActive: true, parent: { connect: { id: categories[child.parent] } } },
    });
    categories[child.key] = String(row.id);
  }

  const brands: Ids = {};
  for (const [key, name] of [
    ["huellas", "Huellas MX"],
    ["bigotes", "Bigotes"],
    ["patitas", "Patitas Felices"],
  ] as const) {
    const row = await sudo.db.StoreBrand.createOne({ data: { name, isActive: true } });
    brands[key] = String(row.id);
  }
  console.log(`🌱 Tienda: ${Object.keys(categories).length} categorías y ${Object.keys(brands).length} marcas.`);
  return { categories, brands };
}

type ProductSeed = {
  key: string;
  name: string;
  shortDescription: string;
  description: string;
  source: "own" | "dropi" | "mercado_libre";
  status?: string;
  inventoryPolicy?: "tracked" | "untracked";
  category: string;
  brand?: string;
  animals: AnimalTypes[];
  isFeatured?: boolean;
  externalId?: string;
  dropiSupplierId?: number;
  affiliateUrl?: string;
  photos: number;
  variants: Array<{ title?: string; priceCents: number; compareAtPriceCents?: number; costCents?: number; stock?: number }>;
};

const PRODUCTS: ProductSeed[] = [
  {
    key: "croquetas",
    name: "Croquetas premium sabor pollo",
    shortDescription: "Alimento completo para perro adulto, con pollo como primer ingrediente.",
    description: "Croquetas para perros adultos de todas las razas. Pollo como primer ingrediente, arroz integral y omega 3 para piel y pelo.",
    source: "own",
    inventoryPolicy: "tracked",
    category: "dogFood",
    brand: "huellas",
    animals: [AnimalTypes.DOG],
    isFeatured: true,
    photos: 3,
    variants: [
      { title: "2 kg", priceCents: 28900, compareAtPriceCents: 32900, costCents: 17500, stock: 12 },
      { title: "7 kg", priceCents: 84900, costCents: 52000, stock: 3 },
      { title: "15 kg", priceCents: 159000, costCents: 98000, stock: 0 },
    ],
  },
  {
    key: "arena",
    name: "Arena aglomerante sin aroma 10 kg",
    shortDescription: "Forma grumos firmes y no deja polvo.",
    description: "Arena de bentonita para gato. Grumos firmes, fácil de limpiar y sin aroma.",
    source: "own",
    inventoryPolicy: "tracked",
    category: "litter",
    brand: "bigotes",
    animals: [AnimalTypes.CAT],
    photos: 2,
    variants: [{ priceCents: 21900, costCents: 12000, stock: 25 }],
  },
  {
    key: "collar",
    name: "Collar bordado con el nombre de tu mascota",
    shortDescription: "Hecho a mano sobre pedido, en tres tallas.",
    description: "Collar de nylon con el nombre bordado. Se hace sobre pedido y sale en 3 a 5 días hábiles.",
    source: "own",
    inventoryPolicy: "untracked",
    category: "walk",
    brand: "patitas",
    animals: [AnimalTypes.DOG, AnimalTypes.CAT],
    isFeatured: true,
    photos: 2,
    variants: [
      { title: "Chico", priceCents: 24900, costCents: 9000 },
      { title: "Mediano", priceCents: 26900, costCents: 10000 },
      { title: "Grande", priceCents: 28900, costCents: 11000 },
    ],
  },
  {
    key: "pelota",
    name: "Pelota de hule resistente",
    shortDescription: "Rebota, flota y aguanta mordidas fuertes.",
    description: "Pelota de hule natural para perros que muerden mucho.",
    source: "own",
    inventoryPolicy: "tracked",
    category: "dogToys",
    brand: "huellas",
    animals: [AnimalTypes.DOG],
    photos: 1,
    variants: [{ priceCents: 8900, costCents: 3500, stock: 2 }],
  },
  {
    key: "rascador",
    name: "Rascador torre de tres niveles",
    shortDescription: "Con casita, hamaca y postes de sisal.",
    description: "Torre para gato de 120 cm con tres niveles.",
    source: "own",
    inventoryPolicy: "tracked",
    category: "scratchers",
    brand: "bigotes",
    animals: [AnimalTypes.CAT],
    photos: 2,
    variants: [{ priceCents: 129900, compareAtPriceCents: 149900, costCents: 78000, stock: 0 }],
  },
  {
    key: "shampoo",
    name: "Shampoo de avena para piel sensible",
    shortDescription: "Para perros y gatos, sin parabenos.",
    description: "Shampoo suave de avena coloidal. 500 ml.",
    source: "own",
    inventoryPolicy: "tracked",
    category: "hygiene",
    brand: "patitas",
    animals: [AnimalTypes.DOG, AnimalTypes.CAT],
    photos: 1,
    variants: [{ priceCents: 15900, costCents: 7000, stock: 30 }],
  },
  {
    key: "cama",
    name: "Cama ortopédica de espuma viscoelástica",
    shortDescription: "Alivia articulaciones; funda lavable.",
    description: "Cama con espuma viscoelástica y funda desmontable.",
    source: "dropi",
    inventoryPolicy: "untracked",
    category: "beds",
    brand: "huellas",
    animals: [AnimalTypes.DOG],
    isFeatured: true,
    externalId: "SEED-DROPI-1",
    dropiSupplierId: 1,
    photos: 3,
    variants: [
      { title: "Mediana", priceCents: 69900, costCents: 41000 },
      { title: "Grande", priceCents: 89900, compareAtPriceCents: 99900, costCents: 53000 },
    ],
  },
  {
    key: "fuente",
    name: "Fuente de agua para gato 2 L",
    shortDescription: "Agua en movimiento y filtrada para que tome más.",
    description: "Fuente silenciosa con filtro de carbón.",
    source: "dropi",
    inventoryPolicy: "untracked",
    category: "catFood",
    animals: [AnimalTypes.CAT],
    externalId: "SEED-DROPI-2",
    dropiSupplierId: 1,
    photos: 2,
    variants: [{ priceCents: 45900, costCents: 26000 }],
  },
  {
    key: "correa",
    name: "Correa retráctil 5 m",
    shortDescription: "Freno de un botón, para perros de hasta 25 kg.",
    description: "Correa retráctil con cinta de 5 m.",
    source: "dropi",
    inventoryPolicy: "untracked",
    category: "walk",
    animals: [AnimalTypes.DOG],
    externalId: "SEED-DROPI-3",
    dropiSupplierId: 2,
    photos: 1,
    variants: [{ priceCents: 32900, costCents: 18000 }],
  },
  {
    key: "transportadora",
    name: "Transportadora mediana para viaje",
    shortDescription: "Aprobada para cabina en varias aerolíneas.",
    description: "Transportadora rígida con puerta metálica.",
    source: "mercado_libre",
    category: "walk",
    animals: [AnimalTypes.DOG, AnimalTypes.CAT],
    affiliateUrl: "https://listado.mercadolibre.com.mx/transportadora-rigida-perro",
    externalId: "MLM-SEED-1",
    photos: 1,
    variants: [{ priceCents: 79900 }],
  },
  {
    key: "comedero",
    name: "Comedero automático con temporizador",
    shortDescription: "Hasta 4 comidas al día.",
    description: "Comedero programable de 4 L.",
    source: "mercado_libre",
    category: "catFood",
    animals: [AnimalTypes.CAT, AnimalTypes.DOG],
    affiliateUrl: "https://listado.mercadolibre.com.mx/comedero-automatico-mascotas",
    externalId: "MLM-SEED-2",
    photos: 1,
    variants: [{ priceCents: 114900 }],
  },
  {
    key: "sueter",
    name: "Suéter navideño (borrador)",
    shortDescription: "No sale en la tienda: está en borrador.",
    description: "Juguete en preparación: todavía no sale en la tienda.",
    source: "own",
    status: "draft",
    inventoryPolicy: "tracked",
    category: "dogToys",
    animals: [AnimalTypes.DOG],
    photos: 1,
    variants: [{ priceCents: 19900, stock: 10 }],
  },
];

async function createProducts(
  context: KeystoneContext,
  taxonomy: { categories: Ids; brands: Ids },
): Promise<Record<string, { id: string; name: string; variants: Array<{ id: string; title: string; priceCents: number; costCents: number | null }> }>> {
  const sudo = context.sudo();
  const prisma = storePrisma(context);
  const animalTypes = (await sudo.query.AnimalType.findMany({ query: "id name" })) as Array<{ id: string; name: string }>;
  const animalId = (type: AnimalTypes) => animalTypes.find((row) => row.name === type)?.id;

  const created: Record<string, { id: string; name: string; variants: Array<{ id: string; title: string; priceCents: number; costCents: number | null }> }> = {};
  for (const seed of PRODUCTS) {
    const animals = seed.animals.map(animalId).filter((id): id is string => Boolean(id));
    const row = await sudo.db.StoreProduct.createOne({
      data: {
        name: seed.name,
        shortDescription: seed.shortDescription,
        description: seed.description,
        source: seed.source,
        status: seed.status ?? "active",
        isFeatured: Boolean(seed.isFeatured),
        ...(seed.inventoryPolicy ? { inventoryPolicy: seed.inventoryPolicy } : {}),
        ...(seed.externalId ? { externalId: seed.externalId } : {}),
        ...(seed.dropiSupplierId ? { dropiSupplierId: seed.dropiSupplierId } : {}),
        ...(seed.affiliateUrl ? { affiliateUrl: seed.affiliateUrl } : {}),
        category: { connect: { id: taxonomy.categories[seed.category] } },
        ...(seed.brand ? { brand: { connect: { id: taxonomy.brands[seed.brand] } } } : {}),
        ...(animals.length ? { animalTypes: { connect: animals.map((id) => ({ id })) } } : {}),
        variants: {
          create: seed.variants.map((variant, index) => ({
            title: variant.title ?? "",
            priceCents: variant.priceCents,
            ...(variant.compareAtPriceCents ? { compareAtPriceCents: variant.compareAtPriceCents } : {}),
            ...(variant.costCents ? { costCents: variant.costCents } : {}),
            ...(variant.stock !== undefined ? { stock: variant.stock } : {}),
            order: index + 1,
            isActive: true,
          })),
        },
        images: {
          create: Array.from({ length: seed.photos }, (_, index) => ({ ...photo(seed.key, index + 1), alt: seed.name })),
        },
      },
    });
    const id = String(row.id);
    await recomputeStoreProductTotals(context, id, { priceTouched: true });
    const variants = (await prisma.storeProductVariant.findMany({
      where: { productId: id },
      orderBy: { order: "asc" },
      select: { id: true, title: true, priceCents: true, costCents: true },
    })) as Array<{ id: string; title: string | null; priceCents: number; costCents: number | null }>;
    created[seed.key] = { id, name: seed.name, variants: variants.map((variant) => ({ ...variant, title: variant.title ?? "" })) };
  }
  // Affiliate prices show "revisado el …": give them a check date.
  await prisma.storeProduct.updateMany({ where: { source: "mercado_libre", externalId: { startsWith: "MLM-SEED" } }, data: { externalSyncedAt: new Date() } });
  console.log(`🌱 Tienda: ${PRODUCTS.length} productos.`);
  return created;
}

async function createSettings(context: KeystoneContext) {
  const prisma = storePrisma(context);
  const existing = await prisma.storeSettings.findFirst({ select: { id: true } });
  if (existing && !(existing instanceof Error)) {
    console.log("♻️  Tienda: ya hay ajustes, no se tocan.");
    return;
  }
  const created = await prisma.storeSettings.create({
    data: {
      id: 1,
      shippingFlatCents: 9900,
      freeShippingMinCents: 79900,
      cardEnabled: true,
      transferEnabled: true,
      bankName: "Banco de prueba",
      bankBeneficiary: "Kadesh Pet (datos de prueba)",
      bankClabe: "012345678901234567",
      bankNote: "Datos de prueba del seed: no transfieras a esta cuenta.",
      transferExpiryHours: 48,
      cardExpiryMinutes: 60,
      // Empty: the default rule (STORE_DEFAULT_RETURN_POLICY, 5 days, defective only) is shown.
      returnPolicy: "",
      supportWhatsapp: "4430000000",
    },
  });
  if (created instanceof Error) throw created;
  console.log("🌱 Tienda: ajustes con envío de $99, gratis desde $799, tarjeta y transferencia.");
}

async function createCoupons(context: KeystoneContext, categories: Ids | null) {
  const sudo = context.sudo();
  const coupons = [
    { code: "BIENVENIDA10", description: "Seed: 10 % en la primera compra", type: "percent", value: 10, firstOrderOnly: true },
    { code: "ENVIOGRATIS", description: "Seed: envío gratis desde $500", type: "free_shipping", value: 0, minSubtotalCents: 50000 },
    { code: "FIJO50", description: "Seed: $50 desde $400, 100 usos", type: "fixed", value: 5000, minSubtotalCents: 40000, usageLimit: 100, usageLimitPerUser: 1 },
    ...(categories?.dogToys
      ? [{ code: "JUGUETES20", description: "Seed: 20 % en juguetes para perro, tope $150", type: "percent", value: 20, maxDiscountCents: 15000, categories: { connect: [{ id: categories.dogToys }] } }]
      : []),
    { code: "VENCIDO", description: "Seed: ya venció", type: "percent", value: 15, startsAt: new Date(Date.now() - 20 * 86_400_000).toISOString(), endsAt: new Date(Date.now() - 86_400_000).toISOString() },
  ];
  let added = 0;
  for (const coupon of coupons) {
    const existing = await sudo.db.StoreCoupon.findOne({ where: { code: coupon.code } });
    if (existing) continue;
    // The API refuses an end date in the past; an expired test coupon gets its dates afterwards.
    const { startsAt, endsAt, ...data } = coupon as typeof coupon & { startsAt?: string; endsAt?: string };
    const created = await sudo.db.StoreCoupon.createOne({ data });
    if (startsAt || endsAt) {
      const dated = await storePrisma(context).storeCoupon.update({
        where: { id: String(created.id) },
        data: { startsAt: startsAt ? new Date(startsAt) : null, endsAt: endsAt ? new Date(endsAt) : null },
      });
      if (dated instanceof Error) throw dated;
    }
    added += 1;
  }
  console.log(added ? `🌱 Tienda: ${added} cupones (BIENVENIDA10, ENVIOGRATIS, FIJO50, JUGUETES20, VENCIDO).` : "♻️  Tienda: los cupones ya existían.");
}

/** People who bought and reviewed. Created with prisma: they never sign in and must not call Stripe. */
async function createBuyers(context: KeystoneContext): Promise<Array<{ id: string; name: string; lastName: string; email: string }>> {
  const prisma = storePrisma(context);
  const people = [
    { name: "Ana", lastName: "Prueba Tienda" },
    { name: "Beto", lastName: "Prueba Tienda" },
    { name: "Carla", lastName: "Prueba Tienda" },
  ];
  const buyers = [];
  for (const person of people) {
    const email = `${person.name.toLowerCase()}@${SEED_EMAIL_DOMAIN}`;
    let row = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (row instanceof Error) throw row;
    if (!row) {
      row = await prisma.user.create({
        data: {
          ...person,
          email,
          username: `${person.name.toLowerCase()}-tienda-seed`,
          referralCode: `SEED-TIENDA-${person.name.toUpperCase()}`,
          phone: "4431234567",
        },
        select: { id: true },
      });
      if (row instanceof Error) throw row;
    }
    buyers.push({ id: row.id as string, ...person, email });
  }
  return buyers;
}

async function createReviews(
  context: KeystoneContext,
  products: Awaited<ReturnType<typeof createProducts>>,
  buyers: Awaited<ReturnType<typeof createBuyers>>,
) {
  const prisma = storePrisma(context);
  const reviews = [
    { product: "croquetas", buyer: 0, rating: 5, title: "A mi perro le encantan", body: "Se las come todas y no le cayeron pesadas. Llegaron rápido.", verified: true },
    { product: "croquetas", buyer: 1, rating: 4, title: "Buena calidad", body: "Bien, aunque la bolsa de 2 kg dura poco.", verified: true },
    { product: "croquetas", buyer: 2, rating: 5, title: null, body: "Excelente precio por la calidad.", verified: false },
    { product: "collar", buyer: 0, rating: 5, title: "Quedó precioso", body: "El bordado se ve muy bien y es resistente.", verified: true },
    { product: "cama", buyer: 1, rating: 3, title: "Cómoda pero chica", body: "La mediana le quedó justa a mi labrador; pidan la grande.", verified: true },
    { product: "arena", buyer: 2, rating: 4, title: "No deja olor", body: "Hace grumos firmes. Un poco de polvo al vaciarla.", verified: false },
    { product: "transportadora", buyer: 0, rating: 5, title: "Sirvió para el avión", body: "La aceptaron en cabina sin problema.", verified: false },
  ];
  for (const review of reviews) {
    const product = products[review.product];
    const buyer = buyers[review.buyer];
    if (!product || !buyer) continue;
    const created = await prisma.storeProductReview.create({
      data: {
        key: `${buyer.id}:${product.id}`,
        rating: review.rating,
        title: review.title ?? "",
        body: review.body,
        status: "published",
        verifiedPurchase: review.verified,
        product: { connect: { id: product.id } },
        user: { connect: { id: buyer.id } },
      },
    });
    if (created instanceof Error) throw created;
  }
  // A review answered by Kadesh.
  const answered = await prisma.storeProductReview.updateMany({
    where: { productId: products.cama?.id, userId: buyers[1]?.id },
    data: { adminReply: "¡Gracias! Ya agregamos la tabla de medidas a la descripción." },
  });
  if (answered instanceof Error) throw answered;
  for (const key of new Set(reviews.map((review) => review.product))) {
    await recomputeStoreProductRating(context, products[key]?.id);
  }
  console.log(`🌱 Tienda: ${reviews.length} reseñas.`);
}

const ADDRESS = {
  shipRecipientName: "Ana Prueba",
  shipPhone: "4431234567",
  shipStreet: "Av. Madero Poniente",
  shipExteriorNumber: "100",
  shipNeighborhood: "Centro",
  shipCity: "Morelia",
  shipStateCode: "16",
  shipPostalCode: "58000",
  shipReferences: "Portón azul (dirección de prueba)",
};

/**
 * A month of orders in every status: delivered, on the way, to fulfil, waiting for a transfer,
 * transfer to review, cancelled and refunded. Written with prisma: they are history, so they do
 * not touch stock, coupons, paws or send emails.
 */
async function createOrders(
  context: KeystoneContext,
  products: Awaited<ReturnType<typeof createProducts>>,
  buyers: Awaited<ReturnType<typeof createBuyers>>,
) {
  const prisma = storePrisma(context);
  const existing = await prisma.storeOrder.findFirst({ where: { number: { startsWith: "KP-SEED" } }, select: { id: true } });
  if (existing instanceof Error) throw existing;
  if (existing) {
    console.log("♻️  Tienda: ya hay pedidos de prueba.");
    return;
  }

  const today = mxToday();
  // Noon (Mexico City) of `ago` days back, plus a few hours so they do not all look the same.
  const at = (ago: number, hours = 0) => new Date(mxDayWindow(shiftDay(today, -ago)).start.getTime() + (12 + hours) * 3_600_000);

  type Line = { product: string; variant?: number; quantity: number; discount?: number };
  type OrderSeed = {
    buyer: number;
    daysAgo: number;
    lines: Line[];
    method?: "stripe_card" | "bank_transfer";
    stage: "delivered" | "shipped" | "to_fulfil" | "awaiting_transfer" | "transfer_review" | "cancelled" | "refunded";
    coupon?: string;
    freeShipping?: boolean;
  };
  const orders: OrderSeed[] = [
    { buyer: 0, daysAgo: 27, lines: [{ product: "croquetas", quantity: 2 }, { product: "pelota", quantity: 1 }], stage: "delivered" },
    { buyer: 1, daysAgo: 24, lines: [{ product: "cama", variant: 0, quantity: 1 }], stage: "delivered", method: "bank_transfer" },
    { buyer: 2, daysAgo: 20, lines: [{ product: "arena", quantity: 3 }], stage: "delivered" },
    { buyer: 0, daysAgo: 16, lines: [{ product: "collar", variant: 1, quantity: 1 }, { product: "shampoo", quantity: 1 }], stage: "delivered", coupon: "BIENVENIDA10" },
    { buyer: 1, daysAgo: 12, lines: [{ product: "croquetas", variant: 1, quantity: 1 }], stage: "refunded" },
    { buyer: 2, daysAgo: 9, lines: [{ product: "fuente", quantity: 1 }, { product: "arena", quantity: 1 }], stage: "delivered", coupon: "ENVIOGRATIS", freeShipping: true },
    { buyer: 0, daysAgo: 6, lines: [{ product: "correa", quantity: 1 }, { product: "croquetas", quantity: 1 }], stage: "shipped" },
    { buyer: 1, daysAgo: 4, lines: [{ product: "cama", variant: 1, quantity: 1 }, { product: "pelota", quantity: 2 }], stage: "shipped", method: "bank_transfer" },
    { buyer: 2, daysAgo: 2, lines: [{ product: "shampoo", quantity: 2 }, { product: "collar", variant: 0, quantity: 1 }], stage: "to_fulfil", coupon: "FIJO50" },
    { buyer: 0, daysAgo: 1, lines: [{ product: "fuente", quantity: 1 }], stage: "to_fulfil" },
    { buyer: 1, daysAgo: 1, lines: [{ product: "arena", quantity: 2 }], stage: "transfer_review", method: "bank_transfer" },
    { buyer: 2, daysAgo: 0, lines: [{ product: "croquetas", quantity: 1 }], stage: "awaiting_transfer", method: "bank_transfer" },
    { buyer: 0, daysAgo: 3, lines: [{ product: "pelota", quantity: 1 }], stage: "cancelled" },
  ];

  const couponCut: Record<string, (subtotal: number) => number> = {
    BIENVENIDA10: (subtotal) => Math.floor(subtotal * 0.1),
    ENVIOGRATIS: () => 0,
    FIJO50: () => 5000,
  };
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";

  for (const [index, seed] of orders.entries()) {
    const buyer = buyers[seed.buyer]!;
    const method = seed.method ?? "stripe_card";
    const placedAt = at(seed.daysAgo, index % 5);
    const lines = seed.lines.map((line) => {
      const product = products[line.product]!;
      const variant = product.variants[line.variant ?? 0]!;
      const source = PRODUCTS.find((item) => item.key === line.product)!.source;
      return { product, variant, source, quantity: line.quantity, total: variant.priceCents * line.quantity };
    });
    const subtotal = lines.reduce((sum, line) => sum + line.total, 0);
    const discount = seed.coupon ? couponCut[seed.coupon]?.(subtotal) ?? 0 : 0;
    const shipping = seed.freeShipping || subtotal >= 79900 ? 0 : 9900;
    // Split the discount across lines in proportion (the last one takes the rounding).
    let left = discount;
    const lineDiscounts = lines.map((line, i) => {
      const share = i === lines.length - 1 ? left : Math.floor((discount * line.total) / subtotal);
      left -= share;
      return share;
    });

    const paid = !["awaiting_transfer", "transfer_review", "cancelled"].includes(seed.stage);
    const paidAt = paid ? new Date(placedAt.getTime() + (method === "bank_transfer" ? 5 : 0.1) * 3_600_000) : null;
    const status =
      seed.stage === "delivered" ? "completed" : seed.stage === "cancelled" || seed.stage === "refunded" ? "cancelled" : "open";
    const paymentStatus =
      seed.stage === "refunded" ? "refunded" : paid ? "paid" : seed.stage === "transfer_review" ? "in_review" : seed.stage === "cancelled" ? "failed" : "pending";
    const fulfillmentStatus = seed.stage === "delivered" ? "delivered" : seed.stage === "shipped" ? "shipped" : "unfulfilled";
    const number = `KP-SEED${letters[Math.floor(index / letters.length)]}${letters[index % letters.length]}A${(index % 8) + 2}`;
    const customerName = `${buyer.name} ${buyer.lastName}`;

    const order = await prisma.storeOrder.create({
      data: {
        number,
        user: { connect: { id: buyer.id } },
        customerName,
        email: buyer.email,
        phone: "4431234567",
        channel: "web",
        status,
        paymentStatus,
        fulfillmentStatus,
        paymentMethod: method,
        unitsCount: lines.reduce((sum, line) => sum + line.quantity, 0),
        subtotalCents: subtotal,
        couponCode: seed.coupon ?? null,
        couponDiscountCents: discount,
        shippingCents: shipping,
        totalCents: subtotal - discount + shipping,
        costCents: lines.reduce((sum, line) => sum + (line.variant.costCents ?? 0) * line.quantity, 0),
        paidAt,
        expiresAt: paid || seed.stage === "cancelled" ? null : new Date(Date.now() + 40 * 3_600_000),
        cancelledAt: seed.stage === "cancelled" || seed.stage === "refunded" ? at(Math.max(0, seed.daysAgo - 1)) : null,
        cancelReason: seed.stage === "refunded" ? "Llegó dañado (pedido de prueba)." : seed.stage === "cancelled" ? "No se pagó a tiempo." : "",
        ...ADDRESS,
        shipRecipientName: customerName,
        searchText: `${number} ${customerName} ${buyer.email} 4431234567`.toLowerCase(),
        createdAt: placedAt,
        items: {
          create: lines.map((line, i) => ({
            product: { connect: { id: line.product.id } },
            variant: { connect: { id: line.variant.id } },
            name: line.product.name,
            variantTitle: line.variant.title,
            source: line.source,
            unitPriceCents: line.variant.priceCents,
            unitCostCents: line.variant.costCents,
            quantity: line.quantity,
            discountCents: lineDiscounts[i] ?? 0,
            totalCents: line.total,
          })),
        },
        payments: {
          create: [
            {
              provider: method,
              amountCents: subtotal - discount + shipping,
              status: seed.stage === "refunded" ? "refunded" : paid ? "succeeded" : seed.stage === "cancelled" ? "failed" : "pending",
              transferReference: method === "bank_transfer" ? number : "",
              createdAt: placedAt,
            },
          ],
        },
      },
      select: { id: true, items: { select: { id: true, source: true } } },
    });
    if (order instanceof Error) throw order;

    // A coupon used by an order that was not cancelled counts as used, as it does in a real checkout.
    if (seed.coupon && status !== "cancelled") {
      const coupon = await prisma.storeCoupon.findUnique({ where: { code: seed.coupon }, select: { id: true } });
      if (coupon instanceof Error) throw coupon;
      if (coupon) {
        const redemption = await prisma.storeCouponRedemption.create({
          data: {
            key: `${coupon.id}:${order.id}`,
            coupon: { connect: { id: coupon.id } },
            order: { connect: { id: order.id } },
            user: { connect: { id: buyer.id } },
            discountCents: discount,
            createdAt: placedAt,
          },
        });
        if (redemption instanceof Error) throw redemption;
        const counted = await prisma.storeCoupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } });
        if (counted instanceof Error) throw counted;
      }
    }

    // Packages: one for Kadesh's own products and one for the dropshipped ones.
    if (paid) {
      const shipmentStatus =
        seed.stage === "delivered" ? "delivered" : seed.stage === "shipped" ? "in_transit" : seed.stage === "refunded" ? "cancelled" : null;
      for (const provider of ["own", "dropi"] as const) {
        const itemIds = order.items.filter((item: { source: string }) => item.source === provider).map((item: { id: string }) => item.id);
        if (itemIds.length === 0) continue;
        const status = shipmentStatus ?? (provider === "dropi" ? "pending_approval" : "pending");
        const shipped = status === "delivered" || status === "in_transit";
        const shipment = await prisma.storeShipment.create({
          data: {
            order: { connect: { id: order.id } },
            provider,
            status,
            carrier: shipped ? (provider === "own" ? "Estafeta" : "TIUI") : "",
            trackingCode: shipped ? `SEED${index}${provider === "own" ? "K" : "D"}` : "",
            shippingCostCents: shipped ? (provider === "own" ? 8500 : 9500) : null,
            shippedAt: shipped ? new Date(paidAt!.getTime() + 24 * 3_600_000) : null,
            deliveredAt: status === "delivered" ? new Date(paidAt!.getTime() + 72 * 3_600_000) : null,
            items: { connect: itemIds.map((id: string) => ({ id })) },
          },
        });
        if (shipment instanceof Error) throw shipment;
      }
    }

    // Timeline.
    const events: Array<{ type: string; message: string; minutes: number; isPublic?: boolean }> = [
      { type: "placed", message: "Hiciste el pedido.", minutes: 0, isPublic: true },
    ];
    if (seed.stage === "transfer_review") events.push({ type: "transfer_proof_uploaded", message: "Subiste tu comprobante.", minutes: 60, isPublic: true });
    if (paid) events.push({ type: "paid", message: "Recibimos tu pago.", minutes: method === "bank_transfer" ? 300 : 6, isPublic: true });
    if (seed.stage === "delivered" || seed.stage === "shipped") events.push({ type: "shipped", message: "Tu pedido va en camino.", minutes: 1500, isPublic: true });
    if (seed.stage === "delivered") events.push({ type: "completed", message: "Entregamos tu pedido.", minutes: 4400, isPublic: true });
    if (seed.stage === "refunded") events.push({ type: "refunded", message: "Reembolsamos tu pedido: llegó dañado.", minutes: 2000, isPublic: true });
    if (seed.stage === "cancelled") events.push({ type: "expired", message: "Se canceló porque no se pagó a tiempo.", minutes: 60, isPublic: true });
    for (const event of events) {
      const row = await prisma.storeOrderEvent.create({
        data: {
          order: { connect: { id: order.id } },
          type: event.type,
          message: event.message,
          isPublic: Boolean(event.isPublic),
          createdAt: new Date(placedAt.getTime() + event.minutes * 60_000),
        },
      });
      if (row instanceof Error) throw row;
    }
  }
  console.log(`🌱 Tienda: ${orders.length} pedidos de los últimos 30 días, en todos los estatus.`);
}

export async function createStoreSeed(context: KeystoneContext) {
  await createSettings(context);
  const taxonomy = await createTaxonomy(context);
  await createCoupons(context, taxonomy?.categories ?? null);
  if (!taxonomy) return;
  const products = await createProducts(context, taxonomy);
  const buyers = await createBuyers(context);
  await createReviews(context, products, buyers);
  await createOrders(context, products, buyers);
  console.log("🛒 Tienda lista. Enciéndela con STORE_ENABLED=true (back) y NEXT_PUBLIC_STORE_ENABLED=true (landing).");
}
