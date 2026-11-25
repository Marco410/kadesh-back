import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  META_FEED_COLUMNS,
  buildMetaFeedRows,
  cleanDescription,
  csvField,
  feedPrices,
  toMetaFeedCsv,
  type MetaFeedProduct,
} from "./metaFeed";

/** Run with `pnpm test:meta-feed`. */

const MEDIA = "https://api.example.test";

function product(overrides: Partial<MetaFeedProduct>): MetaFeedProduct {
  return {
    id: "prod",
    slug: "producto",
    name: "Producto",
    shortDescription: null,
    description: "Descripción",
    status: "active",
    source: "own",
    isFeatured: false,
    inventoryPolicy: "tracked",
    category: null,
    brand: null,
    animalTypes: [],
    variants: [{ id: "var", title: "", priceCents: 25000, compareAtPriceCents: null, stock: 3, isActive: true }],
    images: [{ id: "img" }],
    ...overrides,
  };
}

/** Minimal RFC 4180 parser, to read the CSV back and check its columns. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  return rows;
}

describe("Meta feed: which products go in", () => {
  const mercadoLibre = product({
    id: "ml-product",
    slug: "collar-mercado-libre",
    name: "Collar de Mercado Libre",
    source: "mercado_libre",
    variants: [{ id: "ml-variant", title: "", priceCents: 19900, compareAtPriceCents: null, stock: 0 }],
    images: [{ id: "ml-image" }],
  });
  const dropi = product({
    id: "kp-product",
    slug: "cepillo-quita-pelo",
    name: "Cepillo quita pelo Dropi",
    source: "dropi",
    description: [
      "<p>Cepillo de cerdas suaves para perro y gato.</p>",
      "Contenido gratuito para tus tiendas, descárgalo aquí",
      "Únete a nuestro grupo VIP: https://chat.whatsapp.com/AbCdEf123",
      "<ul><li>Fácil de limpiar 🐶</li><li>Mango \"ergonómico\", antiderrapante</li></ul>",
      "Proveedor: Dropi Bodega 12",
    ].join("\n"),
    variants: [
      { id: "kp-variant-s", title: "Chico", priceCents: 24900, compareAtPriceCents: null, stock: 4 },
      { id: "kp-variant-l", title: "Grande", priceCents: 29900, compareAtPriceCents: 34900, stock: 0 },
      { id: "kp-variant-off", title: "Viejo", priceCents: 9900, compareAtPriceCents: null, stock: 9, isActive: false },
    ],
    images: [{ id: "kp-cover" }, { id: "kp-2" }, { id: "kp-3" }],
    brand: null,
    category: { name: "Cepillo", parent: { name: "Accesorios" } },
    animalTypes: [{ name: "dog" }, { name: "cat" }],
    isFeatured: true,
  });
  // Internal data the loader never selects; here on purpose to prove none of it leaks.
  const withInternals = { ...dropi, externalId: "DROPI-998877", costCents: 11100, sku: "SUP-SKU-1" } as MetaFeedProduct;

  const { rows } = buildMetaFeedRows([mercadoLibre, withInternals], { mediaBaseUrl: MEDIA });
  const csv = toMetaFeedCsv(rows);

  it("leaves Mercado Libre out", () => {
    assert.ok(!rows.some((row) => row.id.startsWith("ml-")));
    assert.ok(!csv.includes("collar-mercado-libre"));
    assert.ok(!csv.includes("ml-image"));
  });

  it("puts Dropi in, one row per variant on sale", () => {
    assert.deepEqual(
      rows.map((row) => row.id),
      ["kp-variant-s", "kp-variant-l"],
    );
    assert.equal(rows[0].title, "Cepillo quita pelo - Chico");
    assert.equal(rows[0].availability, "in stock");
    assert.equal(rows[1].availability, "out of stock");
    assert.equal(rows[0].quantity_to_sell_on_facebook, "4");
    assert.equal(rows[0].brand, "Kadesh Pet");
    assert.equal(rows[0].product_type, "Accesorios > Cepillo");
    assert.equal(rows[0].custom_label_0, "destacado");
    assert.equal(rows[0].custom_label_1, "Perro,Gato");
    // Both variants share the product id, so Meta shows them as one listing.
    assert.equal(rows[0].item_group_id, "kp-product");
    assert.equal(rows[1].item_group_id, "kp-product");
    assert.equal(
      rows[0].link,
      "https://pet.kadesh.com.mx/tienda/cepillo-quita-pelo?utm_source=facebook&utm_medium=catalogo&utm_campaign=tienda",
    );
    assert.equal(rows[0].image_link, `${MEDIA}/media/store/kp-cover.jpg`);
    assert.equal(rows[0].additional_image_link, `${MEDIA}/media/store/kp-2.jpg,${MEDIA}/media/store/kp-3.jpg`);
  });

  it("never mentions Dropi, cost, supplier ids or supplier text", () => {
    assert.ok(!/dropi/i.test(csv), "the word Dropi leaked");
    assert.ok(!/costo|cost/i.test(csv));
    assert.ok(!csv.includes("DROPI-998877"));
    assert.ok(!csv.includes("998877"));
    assert.ok(!csv.includes("11100") && !csv.includes("111.00"));
    assert.ok(!csv.includes("SUP-SKU-1"));
    assert.ok(!/contenido gratuito/i.test(csv));
    assert.ok(!/whatsapp|https:\/\/chat\./i.test(csv));
    assert.ok(!/proveedor|bodega/i.test(csv));
  });

  it("writes plain-text descriptions without HTML or emojis", () => {
    assert.equal(
      rows[0].description,
      'Cepillo de cerdas suaves para perro y gato. Fácil de limpiar Mango "ergonómico", antiderrapante',
    );
  });

  it("is a valid CSV with the expected header and escaping", () => {
    const parsed = parseCsv(csv);
    assert.deepEqual(parsed[0], [...META_FEED_COLUMNS]);
    assert.equal(parsed.length, 3);
    for (const line of parsed) assert.equal(line.length, META_FEED_COLUMNS.length);
    assert.equal(parsed[1][2], rows[0].description);
    // additional_image_link always goes between quotes.
    assert.ok(csv.includes(`"${MEDIA}/media/store/kp-2.jpg,${MEDIA}/media/store/kp-3.jpg"`));
  });
});

describe("Meta feed: price and sale_price", () => {
  it("without a previous price: price is the price, sale_price empty", () => {
    assert.deepEqual(feedPrices(25000, null), { price: "250.00 MXN", sale_price: "" });
  });

  it("with a higher previous price: price is the previous one, sale_price the current one", () => {
    assert.deepEqual(feedPrices(29900, 34900), { price: "349.00 MXN", sale_price: "299.00 MXN" });
  });

  it("ignores a previous price that is not higher", () => {
    assert.deepEqual(feedPrices(29900, 29900), { price: "299.00 MXN", sale_price: "" });
    assert.deepEqual(feedPrices(29900, 10000), { price: "299.00 MXN", sale_price: "" });
  });

  it("uses a dot, two decimals and no thousands separator", () => {
    assert.deepEqual(feedPrices(123456789, null), { price: "1234567.89 MXN", sale_price: "" });
    assert.deepEqual(feedPrices(5, null), { price: "0.05 MXN", sale_price: "" });
  });
});

describe("Meta feed: other rules", () => {
  it("made-to-order products are available for order with no quantity", () => {
    const { rows } = buildMetaFeedRows([product({ inventoryPolicy: "untracked" })], { mediaBaseUrl: MEDIA });
    assert.equal(rows[0].availability, "available for order");
    assert.equal(rows[0].quantity_to_sell_on_facebook, "");
  });

  it("uses the short description when the long one is empty", () => {
    const { rows } = buildMetaFeedRows([product({ description: "  ", shortDescription: "Corta" })], {
      mediaBaseUrl: MEDIA,
    });
    assert.equal(rows[0].description, "Corta");
  });

  it("leaves out photos under 500x500: the next large one becomes the cover", () => {
    const { rows, skipped, smallImages } = buildMetaFeedRows(
      [
        product({
          id: "mixed",
          images: [
            { id: "tiny-cover", width: 340, height: 340 },
            { id: "big", width: 1024, height: 1024 },
            { id: "narrow", width: 482, height: 900 },
            { id: "external", width: null, height: null },
            { id: "exact", width: 500, height: 500 },
          ],
        }),
        product({ id: "all-small", images: [{ id: "s1", width: 300, height: 300 }, { id: "s2", width: 499, height: 800 }] }),
      ],
      { mediaBaseUrl: MEDIA },
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].image_link, `${MEDIA}/media/store/big.jpg`);
    assert.equal(rows[0].additional_image_link, `${MEDIA}/media/store/external.jpg,${MEDIA}/media/store/exact.jpg`);
    assert.deepEqual(skipped, [{ productId: "all-small", reason: "no_valid_image" }]);
    assert.equal(smallImages, 4);
  });

  it("skips drafts and reports products without photos or variants on sale", () => {
    const { rows, skipped } = buildMetaFeedRows(
      [
        product({ id: "draft", status: "draft" }),
        product({ id: "no-photo", images: [] }),
        product({ id: "no-price", variants: [{ id: "v0", title: "", priceCents: 0, compareAtPriceCents: null, stock: 1 }] }),
      ],
      { mediaBaseUrl: MEDIA },
    );
    assert.equal(rows.length, 0);
    assert.deepEqual(skipped, [
      { productId: "no-photo", reason: "no_valid_image" },
      { productId: "no-price", reason: "no_variant_on_sale" },
    ]);
  });

  it("caps titles at 150 and descriptions at 5000 characters", () => {
    const { rows } = buildMetaFeedRows([product({ name: "x".repeat(400), description: "palabra ".repeat(2000) })], {
      mediaBaseUrl: MEDIA,
    });
    assert.ok(rows[0].title.length <= 150);
    assert.ok(rows[0].description.length <= 5000);
  });

  it("escapes quotes, commas and line breaks", () => {
    assert.equal(csvField('dice "hola", y\nadiós'), '"dice ""hola"", y\nadiós"');
    assert.equal(csvField("simple"), "simple");
  });

  it("drops supplier lines but keeps the rest", () => {
    assert.equal(cleanDescription("Línea buena\nwww.proveedor.com\nOtra buena"), "Línea buena Otra buena");
  });

  it("removes inline HTML without leaving a space before punctuation", () => {
    assert.equal(cleanDescription("<p>Hecha <b>a mano</b>.</p>"), "Hecha a mano.");
  });
});
