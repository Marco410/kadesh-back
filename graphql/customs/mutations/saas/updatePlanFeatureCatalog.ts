import { KeystoneContext } from "@keystone-6/core/types";
import { isPlatformAdmin } from "../../../../utils/access/tenant";

const typeDefs = `
  input PlanFeatureCatalogItemInput {
    key: String!
    name: String!
    description: String!
  }

  input UpdatePlanFeatureCatalogInput {
    features: [PlanFeatureCatalogItemInput!]!
  }

  type UpdatePlanFeatureCatalogResult {
    success: Boolean!
    message: String!
    plansUpdated: Int
    subscriptionsUpdated: Int
  }

  type Mutation {
    updatePlanFeatureCatalog(
      input: UpdatePlanFeatureCatalogInput!
    ): UpdatePlanFeatureCatalogResult!
  }
`;

const definition = `
  updatePlanFeatureCatalog(input: UpdatePlanFeatureCatalogInput!): UpdatePlanFeatureCatalogResult!
`;

type CatalogItem = {
  key: string;
  name: string;
  description: string;
};

type FeatureRow = {
  key: string;
  name?: string | null;
  description?: string | null;
  included?: boolean | null;
  [extra: string]: unknown;
};

function fail(message: string) {
  return {
    success: false,
    message,
    plansUpdated: null,
    subscriptionsUpdated: null,
  };
}

function asFeatureArray(value: unknown): FeatureRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is FeatureRow =>
      Boolean(v) &&
      typeof v === "object" &&
      typeof (v as FeatureRow).key === "string" &&
      Boolean((v as FeatureRow).key),
  );
}

/**
 * Aplica nombre/descripción del catálogo a un array de features.
 * Conserva `included` y cualquier otra propiedad. No agrega keys nuevas.
 */
export function applyFeatureCatalog(
  current: unknown,
  catalogByKey: Map<string, CatalogItem>,
): { next: FeatureRow[]; changed: boolean } {
  const rows = asFeatureArray(current);
  let changed = false;
  const next = rows.map((row) => {
    const meta = catalogByKey.get(row.key);
    if (!meta) return row;
    if (row.name === meta.name && row.description === meta.description) {
      return row;
    }
    changed = true;
    return {
      ...row,
      name: meta.name,
      description: meta.description,
    };
  });
  return { next, changed };
}

const resolver = {
  updatePlanFeatureCatalog: async (
    _root: unknown,
    { input }: { input: { features: CatalogItem[] } },
    context: KeystoneContext,
  ) => {
    if (!isPlatformAdmin(context.session)) {
      return fail("Solo operaciones puede editar los módulos.");
    }

    const raw = Array.isArray(input?.features) ? input.features : [];
    if (raw.length === 0) {
      return fail("Manda al menos un módulo para actualizar.");
    }

    const catalogByKey = new Map<string, CatalogItem>();
    for (const item of raw) {
      const key = String(item?.key ?? "").trim();
      const name = String(item?.name ?? "").trim();
      const description = String(item?.description ?? "").trim();
      if (!key) continue;
      if (!name) {
        return fail(`El módulo "${key}" necesita un nombre.`);
      }
      catalogByKey.set(key, { key, name, description });
    }

    if (catalogByKey.size === 0) {
      return fail("No hay módulos válidos para actualizar.");
    }

    const sudo = context.sudo();

    const plans = await sudo.query.SaasPlan.findMany({
      query: "id planFeatures",
    });

    let plansUpdated = 0;
    for (const plan of plans) {
      const { next, changed } = applyFeatureCatalog(
        plan.planFeatures,
        catalogByKey,
      );
      if (!changed) continue;
      await sudo.query.SaasPlan.updateOne({
        where: { id: plan.id },
        data: { planFeatures: next },
      });
      plansUpdated += 1;
    }

    const subscriptions = await sudo.query.SaasCompanySubscription.findMany({
      query: "id planFeatures",
    });

    let subscriptionsUpdated = 0;
    for (const sub of subscriptions) {
      const { next, changed } = applyFeatureCatalog(
        sub.planFeatures,
        catalogByKey,
      );
      if (!changed) continue;
      await sudo.query.SaasCompanySubscription.updateOne({
        where: { id: sub.id },
        data: { planFeatures: next },
      });
      subscriptionsUpdated += 1;
    }

    return {
      success: true,
      message:
        plansUpdated === 0 && subscriptionsUpdated === 0
          ? "Sin cambios: el texto ya era el mismo en todos lados."
          : `Actualizado en ${plansUpdated} plan${plansUpdated === 1 ? "" : "es"} y ${subscriptionsUpdated} suscripción${subscriptionsUpdated === 1 ? "" : "es"}.`,
      plansUpdated,
      subscriptionsUpdated,
    };
  },
};

export default { typeDefs, definition, resolver };
