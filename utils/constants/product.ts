/** A qué app(s) pertenece un contenido compartido (changelog, blog). */
export const PRODUCT = {
  PET: "pet",
  SAAS: "saas",
  ALL: "all",
} as const;

export type Product = (typeof PRODUCT)[keyof typeof PRODUCT];

export const PRODUCT_OPTIONS: { label: string; value: Product }[] = [
  { label: "Pet", value: PRODUCT.PET },
  { label: "SaaS", value: PRODUCT.SAAS },
  { label: "Ambas", value: PRODUCT.ALL },
];

/** Productos con audiencia propia (suscripciones): "all" no es un destino. */
export type SingleProduct = Exclude<Product, typeof PRODUCT.ALL>;

export const SINGLE_PRODUCT_OPTIONS: { label: string; value: SingleProduct }[] = [
  { label: "Pet", value: PRODUCT.PET },
  { label: "SaaS", value: PRODUCT.SAAS },
];
