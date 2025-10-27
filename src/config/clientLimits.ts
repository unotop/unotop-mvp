/**
 * PR-17: Client Type Limits
 * 
 * Definuje maximálne hodnoty pre polia podľa typu klienta.
 * Používa sa na clamping vstupov a auto-rozšírenie sliderov.
 */

export type ClientType = "individual" | "family" | "company";

export interface ClientLimits {
  /** Max mesačný príjem (€) */
  monthlyIncomeMax: number;
  /** Max jednorazová investícia (€) */
  lumpSumMax: number;
  /** Max mesačný vklad (€) */
  monthlyContributionMax: number;
}

/**
 * Default limity (individual = základný klient)
 */
export const DEFAULT_LIMITS: ClientLimits = {
  monthlyIncomeMax: 10_000,
  lumpSumMax: 100_000,
  monthlyContributionMax: 5_000,
} as const;

/**
 * Limity podľa typu klienta
 */
export const CLIENT_LIMITS: Record<ClientType, ClientLimits> = {
  individual: { ...DEFAULT_LIMITS },
  
  family: {
    ...DEFAULT_LIMITS,
    monthlyIncomeMax: 20_000,      // Rodina: vyšší príjem
    lumpSumMax: 200_000,           // Rodina: vyššia jednorazová
  },
  
  company: {
    ...DEFAULT_LIMITS,
    monthlyIncomeMax: 100_000,     // Firma: veľmi vysoký príjem
    lumpSumMax: 1_000_000,         // Firma: milión jednorazovo
    monthlyContributionMax: 10_000, // Firma: vyšší mesačný vklad
  },
} as const;

/**
 * Získaj limity pre konkrétny typ klienta
 */
export function getClientLimits(clientType?: ClientType | string): ClientLimits {
  if (!clientType || !(clientType in CLIENT_LIMITS)) {
    return CLIENT_LIMITS.individual;
  }
  return CLIENT_LIMITS[clientType as ClientType];
}

/**
 * Clamp hodnotu na limit (používa sa v UI)
 */
export function clampToLimit(
  value: number,
  field: keyof ClientLimits,
  clientType: ClientType = "individual"
): { value: number; clamped: boolean } {
  const limits = getClientLimits(clientType);
  const max = limits[field];
  
  if (value > max) {
    return { value: max, clamped: true };
  }
  
  return { value, clamped: false };
}

/**
 * Formátuj label pre limit (používa sa v toast/warning)
 */
export function getLimitLabel(field: keyof ClientLimits): string {
  const labels: Record<keyof ClientLimits, string> = {
    monthlyIncomeMax: "mesačný príjem",
    lumpSumMax: "jednorazová investícia",
    monthlyContributionMax: "mesačný vklad",
  };
  return labels[field];
}

/**
 * Formátuj typ klienta pre UI
 */
export function getClientTypeLabel(clientType: ClientType): string {
  const labels: Record<ClientType, string> = {
    individual: "jednotlivca",
    family: "rodiny",
    company: "firmy",
  };
  return labels[clientType];
}
