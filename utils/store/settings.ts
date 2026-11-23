import type { KeystoneContext } from "@keystone-6/core/types";
import {
  STORE_DEFAULT_RETURN_POLICY,
  STORE_SETTINGS_CACHE_MS,
  STORE_SETTINGS_DEFAULTS,
} from "../../models/Pet/Store/constants";

/**
 * `StoreSettings` (one row) read from memory: every quote and every order needs it. Re-read after
 * a minute, or right away when an admin edits it. Without a row yet, the defaults apply.
 */

export type StoreSettingsValue = {
  shippingFlatCents: number;
  /** 0 = shipping is never free. */
  freeShippingMinCents: number;
  cardEnabled: boolean;
  transferEnabled: boolean;
  bankName: string;
  bankBeneficiary: string;
  bankClabe: string;
  bankNote: string;
  transferExpiryHours: number;
  cardExpiryMinutes: number;
  returnPolicy: string;
  supportWhatsapp: string;
};

let cache: { value: StoreSettingsValue; at: number } | null = null;

export function resetStoreSettingsCache(): void {
  cache = null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function int(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
}

export async function getStoreSettings(context: KeystoneContext): Promise<StoreSettingsValue> {
  if (cache && Date.now() - cache.at < STORE_SETTINGS_CACHE_MS) return cache.value;
  const prisma = (context.sudo() as KeystoneContext & { prisma: any }).prisma;
  let row: Record<string, unknown> | null = null;
  try {
    const found = await prisma.storeSettings.findFirst();
    if (found instanceof Error) throw found;
    row = found;
  } catch (error) {
    console.error("[store] could not read StoreSettings, using defaults:", error);
  }
  const value: StoreSettingsValue = {
    shippingFlatCents: int(row?.shippingFlatCents, STORE_SETTINGS_DEFAULTS.shippingFlatCents),
    freeShippingMinCents: row ? int(row.freeShippingMinCents, 0) : STORE_SETTINGS_DEFAULTS.freeShippingMinCents,
    cardEnabled: row ? row.cardEnabled !== false : STORE_SETTINGS_DEFAULTS.cardEnabled,
    transferEnabled: row ? row.transferEnabled !== false : STORE_SETTINGS_DEFAULTS.transferEnabled,
    bankName: text(row?.bankName),
    bankBeneficiary: text(row?.bankBeneficiary),
    bankClabe: text(row?.bankClabe),
    bankNote: text(row?.bankNote),
    transferExpiryHours: int(row?.transferExpiryHours, STORE_SETTINGS_DEFAULTS.transferExpiryHours) || STORE_SETTINGS_DEFAULTS.transferExpiryHours,
    cardExpiryMinutes: int(row?.cardExpiryMinutes, STORE_SETTINGS_DEFAULTS.cardExpiryMinutes) || STORE_SETTINGS_DEFAULTS.cardExpiryMinutes,
    returnPolicy: text(row?.returnPolicy) || STORE_DEFAULT_RETURN_POLICY,
    supportWhatsapp: text(row?.supportWhatsapp),
  };
  cache = { value, at: Date.now() };
  return value;
}

/** A transfer can only be offered once the bank account is filled in. */
export function isTransferAvailable(settings: StoreSettingsValue): boolean {
  return settings.transferEnabled && Boolean(settings.bankClabe && settings.bankBeneficiary);
}

/** Card payments need Stripe configured on the server. */
export function isCardAvailable(settings: StoreSettingsValue): boolean {
  return settings.cardEnabled && Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

/** Bank data a buyer needs to pay an order by transfer. */
export function transferInstructions(
  settings: StoreSettingsValue,
  order: { number: string; totalCents: number; expiresAt: Date | null },
) {
  return {
    bankName: settings.bankName,
    beneficiary: settings.bankBeneficiary,
    clabe: settings.bankClabe,
    note: settings.bankNote || null,
    reference: order.number,
    amountCents: order.totalCents,
    expiresAt: order.expiresAt ? new Date(order.expiresAt).toISOString() : null,
  };
}
