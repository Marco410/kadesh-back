/** Qué app(s) consume esta entrada de versión / changelog. */
export const SYSTEM_RELEASE_PRODUCT = {
  PET: "pet",
  SAAS: "saas",
  ALL: "all",
} as const;

export type SystemReleaseProduct =
  (typeof SYSTEM_RELEASE_PRODUCT)[keyof typeof SYSTEM_RELEASE_PRODUCT];

export const SYSTEM_RELEASE_PRODUCT_OPTIONS: {
  label: string;
  value: SystemReleaseProduct;
}[] = [
  { label: "Pet", value: SYSTEM_RELEASE_PRODUCT.PET },
  { label: "SaaS", value: SYSTEM_RELEASE_PRODUCT.SAAS },
  { label: "Ambas", value: SYSTEM_RELEASE_PRODUCT.ALL },
];
