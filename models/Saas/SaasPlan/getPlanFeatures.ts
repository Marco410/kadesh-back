import path from "path";
import fs from "fs";

export type PlanFeatureItem = {
  key: string;
  name: string;
  description: string;
  included: boolean;
};

type PlanFeatureSource = {
  key: string;
  name: string;
  description: string;
};

let cachedFeatures: PlanFeatureSource[] | null = null;

function loadPlanFeaturesJson(): PlanFeatureSource[] {
  if (cachedFeatures) return cachedFeatures;
  const filePath = path.join(__dirname, "plan_features.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  cachedFeatures = JSON.parse(raw) as PlanFeatureSource[];
  return cachedFeatures;
}

/**
 * Devuelve el array de plan features tomando la base desde plan_features.json
 * y aplicando por cada key el valor de `included` que indiques.
 *
 * @param includedByKey - Mapa key -> boolean. Si una key no está en el mapa, se usa `true` por defecto.
 * @returns Array de features con { key, name, description, included }
 *
 * @example
 * // Todas incluidas (comportamiento por defecto)
 * getPlanFeatures()
 *
 * @example
 * // Solo algunas incluidas, el resto false
 * getPlanFeatures({ lead_sync: true, crm: true, calendar_crm: false })
 *
 * @example
 * // Todas true excepto una
 * getPlanFeatures({ sales_commission: false })
 */
export function getPlanFeatures(
  includedByKey?: Partial<Record<string, boolean>>,
): PlanFeatureItem[] {
  const base = loadPlanFeaturesJson();
  return base.map((f) => ({
    key: f.key,
    name: f.name,
    description: f.description,
    included: includedByKey?.[f.key] ?? true,
  }));
}
