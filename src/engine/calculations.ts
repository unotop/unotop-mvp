/**
 * Core Business Logic - Unified Calculation Functions
 * 
 * Centrálne výpočty pre investície.
 * Yield a risk scoring sú v features/mix/assetModel.ts (zachované kvôli komplexnej logike).
 * 
 * Prečo tu:
 * - Jednoduchšie testovanie (pure functions)
 * - Žiadne duplicity FV výpočtu
 * - Príprava na IWA (Integrované Hodnotenie Aktív)
 */

/**
 * Vypočítaj budúcu hodnotu investície s mesačnou kapitalizáciou
 * 
 * Formula: FV = P0 * (1+r)^Y + PM * 12 * ((1+r)^Y - 1) / r
 * 
 * Kde:
 * - P0 = jednorazová investícia (lump sum)
 * - PM = mesačný vklad
 * - r = anualizovaný výnos (decimal, napr. 0.07 pre 7%)
 * - Y = horizont v rokoch
 * 
 * Implementácia používa mesačnú sadzbu pre presnejšiu kapitalizáciu:
 * r_monthly = (1 + r_annual)^(1/12) - 1
 * 
 * @param lumpSum - Jednorazová investícia (EUR)
 * @param monthlyContribution - Mesačný vklad (EUR)
 * @param years - Investičný horizont (roky)
 * @param annualRate - Anualizovaný výnos (decimal, napr. 0.07 = 7%)
 * @returns Budúca hodnota investície (EUR)
 */
export function calculateFutureValue(
  lumpSum: number,
  monthlyContribution: number,
  years: number,
  annualRate: number
): number {
  if (years <= 0) return lumpSum;

  // Počet mesiacov
  const months = Math.round(years * 12);

  // Mesačná sadzba: (1 + r_annual)^(1/12) - 1
  const monthlyRate = annualRate > 0 
    ? Math.pow(1 + annualRate, 1 / 12) - 1 
    : 0;

  // Iteratívny výpočet (presnejší pre mesačnú kapitalizáciu)
  let value = lumpSum;
  for (let month = 1; month <= months; month++) {
    value = (value + monthlyContribution) * (1 + monthlyRate);
  }

  return value;
}
