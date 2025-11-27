/**
 * PR-31: Profile-Aware Asset Policy
 * PR-34: Gold Policy Bands (Conservative: max 40%, Balanced: max 20%, Growth: max 15%)
 * 
 * Definuje maximálne podiely aktív podľa profilu a objemu plánu.
 * Zabezpečuje logické rozdelenie high-yield aktív medzi profily:
 * - Conservative: nízke riziko, môže mať dyn pri ≥100k (max 10%), VIAC ZLATA (20-30%)
 * - Balanced: stredný profil, MENEJ ZLATA (10-15%, max 20%)
 * - Growth: najviac dyn/crypto/real, NAJMENEJ ZLATA (8-12%, max 15%)
 * 
 * Invariant: maxShare_conservative <= maxShare_balanced <= maxShare_growth
 * (pri rovnakom volume band)
 * GOLD INVERSION: gold_conservative >= gold_balanced >= gold_growth (bezpečný pilier)
 */

import type { RiskPref } from "../mix/assetModel";
import type { MixItem } from "../mix/mix.service";

/**
 * PR-34: Gold Policy Bands
 * 
 * Definuje target ranges a hard caps pre zlato podľa profilu.
 * - Conservative: môže mať viac zlata (bezpečný pilier)
 * - Balanced/Growth: menej zlata, viac ETF/dyn/crypto
 */
export const GOLD_POLICY: Record<RiskPref, { targetMin: number; targetMax: number; hardCap: number }> = {
  konzervativny: { targetMin: 20, targetMax: 30, hardCap: 40 },  // Bezpečný profil, viac zlata OK
  vyvazeny: { targetMin: 10, targetMax: 15, hardCap: 20 },       // KEY: max 20% gold (znížené z 40%)
  rastovy: { targetMin: 8, targetMax: 12, hardCap: 15 },         // KEY: max 15% gold (znížené z 40%)
};

/**
 * Získaj gold policy pre daný profil
 * 
 * @param riskPref - Rizikový profil
 * @returns Gold policy (targetMin, targetMax, hardCap)
 */
export function getGoldPolicy(riskPref: RiskPref): { targetMin: number; targetMax: number; hardCap: number } {
  return GOLD_POLICY[riskPref];
}

/**
 * Minimum dyn % pre PREMIUM plány (aby sa dyn dostal do mixu)
 * 
 * Ak dyn < minimum, pridáme rozdiel z cash/bonds
 */
const DYN_MINIMUMS: Record<RiskPref, number> = {
  konzervativny: 5,  // Min 5% dyn pre Conservative PREMIUM
  vyvazeny: 8,       // Min 8% dyn pre Balanced PREMIUM  
  rastovy: 12,       // Min 12% dyn pre Growth PREMIUM
};

/**
 * Volume bands pre progressive unlocking
 */
type VolumeBand = "starter" | "core" | "premium";

function getVolumeBand(effectivePlanVolume: number): VolumeBand {
  if (effectivePlanVolume < 50000) return "starter";
  if (effectivePlanVolume < 100000) return "core";
  return "premium";
}

/**
 * Profile Asset Policy - maximálne podiely aktív
 * 
 * Štruktúra: [Conservative, Balanced, Growth] pre každý volume band
 */
const PROFILE_ASSET_CAPS: Record<
  VolumeBand,
  Record<RiskPref, Partial<Record<MixItem["key"], number>>>
> = {
  // STARTER (< 50k EUR)
  starter: {
    konzervativny: {
      dyn: 0,        // Žiadne dyn
      crypto: 0,     // Žiadne crypto
      real: 0,       // Žiadne reality
      bond3y9: 15,   // Obmedzené bond9
      etf: 30,       // Obmedzené ETF
      gold: 40,      // Cap na zlato
      cash: 20,      // Cap na IAD
    },
    vyvazeny: {
      dyn: 0,        // Žiadne dyn (STARTER aggressive caps)
      crypto: 3,     // Minimálne crypto
      real: 0,       // Žiadne reality
      bond3y9: 20,   // Viac bond9 než Conservative
      etf: 45,       // Viac ETF než Conservative
      gold: 40,
      cash: 15,
    },
    rastovy: {
      dyn: 5,        // Malé dyn
      crypto: 7,     // Viac crypto než Balanced
      real: 5,       // Malé reality
      bond3y9: 20,
      etf: 50,       // Najvyššie ETF
      gold: 40,
      cash: 10,
    },
  },

  // CORE (50k - 100k EUR)
  core: {
    konzervativny: {
      dyn: 5,        // Povolené malé dyn
      crypto: 0,     // Stále žiadne crypto
      real: 0,       // Žiadne reality
      bond3y9: 20,   // Viac bond9
      etf: 35,       // Viac ETF
      gold: 40,
      cash: 20,
    },
    vyvazeny: {
      dyn: 5,        // Rovnaké dyn ako Conservative
      crypto: 5,     // Viac crypto
      real: 10,      // Povolené reality
      bond3y9: 20,
      etf: 50,       // Viac ETF
      gold: 40,
      cash: 15,
    },
    rastovy: {
      dyn: 12,       // Výrazne viac dyn
      crypto: 10,    // Viac crypto
      real: 15,      // Viac reality
      bond3y9: 25,
      etf: 50,
      gold: 40,
      cash: 10,
    },
  },

  // PREMIUM (≥ 100k EUR)
  premium: {
    konzervativny: {
      dyn: 7,        // PR-33 FIX E: 5% → 7% dyn pre Conservative PREMIUM (mierne zvýšené pre yield, ale stále < Balanced)
      crypto: 0,     // Konzervatívny klient nepotrebuje crypto
      real: 5,       // Voliteľne malé reality (skôr 0)
      bond3y9: 12,   // PR-33 FIX E: 25% → 12% (KEY CHANGE - zabráni Conservative > Growth v yield)
      etf: 20,       // PR-31 FIX: Znížené z 35% → 20% (obmedziť high-yield optimalizáciu)
      gold: 40,
      cash: 20,
    },
    vyvazeny: {
      dyn: 10,       // Balanced môže mať 10% dyn
      crypto: 7,     // Viac crypto
      real: 10,      // Viac reality
      bond3y9: 25,
      etf: 50,       // Výrazne viac ETF
      gold: 40,
      cash: 15,
    },
    rastovy: {
      dyn: 20,       // Najvyššie dyn
      crypto: 10,    // Najvyššie crypto
      real: 20,      // Najvyššie reality
      bond3y9: 30,   // Najvyššie bond9
      etf: 55,       // Najvyššie ETF
      gold: 40,
      cash: 10,
    },
  },
};

/**
 * Získaj profile-aware asset caps
 * 
 * @param profile - Rizikový profil (konzervativny/vyvazeny/rastovy)
 * @param effectivePlanVolume - Efektívny objem plánu (lumpSum + monthly*12*years)
 * @returns Objekt s max % pre každé aktívum
 */
export function getProfileAssetCaps(
  profile: RiskPref,
  effectivePlanVolume: number
): Partial<Record<MixItem["key"], number>> {
  const band = getVolumeBand(effectivePlanVolume);
  const caps = PROFILE_ASSET_CAPS[band][profile];

  console.log(
    `[ProfileAssetPolicy] Profile: ${profile}, Volume: ${effectivePlanVolume.toLocaleString()} EUR → Band: ${band.toUpperCase()}`
  );

  return caps;
}

/**
 * Core assets pre redistribúciu prebytkov (podľa profilu)
 */
const CORE_ASSETS: Record<RiskPref, MixItem["key"][]> = {
  konzervativny: ["gold", "bonds", "bond3y9", "cash"], // Safe assets first
  vyvazeny: ["gold", "etf", "bonds", "bond3y9"],       // Mix safe + growth
  rastovy: ["etf", "gold", "bonds", "bond3y9"],        // Growth assets first
};

/**
 * Aplikuj profile asset policy na mix
 * 
 * Oreze aktíva nad policy caps a prebytky redistribuuje
 * do core assets podľa profilu.
 * 
 * @param mix - Mix aktív (mutable)
 * @param profile - Rizikový profil
 * @param effectivePlanVolume - Objem plánu
 * @returns Upravený mix + zoznam upravených aktív
 */
export function applyProfileAssetPolicy(
  mix: MixItem[],
  profile: RiskPref,
  effectivePlanVolume: number
): { mix: MixItem[]; adjustedAssets: string[] } {
  const caps = getProfileAssetCaps(profile, effectivePlanVolume);
  const coreAssets = CORE_ASSETS[profile];
  const adjustedAssets: string[] = [];
  const band = getVolumeBand(effectivePlanVolume);

  // PR-31 FIX: Pre PREMIUM plány zabezpeč minimum dyn
  if (band === "premium") {
    const dynItem = mix.find((m) => m.key === "dyn");
    const minDyn = DYN_MINIMUMS[profile];
    
    if (dynItem && dynItem.pct < minDyn) {
      const needed = minDyn - dynItem.pct;
      console.log(
        `[ProfileAssetPolicy] PREMIUM boost: dyn ${dynItem.pct.toFixed(1)}% → ${minDyn}% (adding ${needed.toFixed(1)}% from cash/bonds)`
      );
      
      // Pridaj dyn z cash (priorita) alebo bonds
      const cashItem = mix.find((m) => m.key === "cash");
      const bondsItem = mix.find((m) => m.key === "bonds");
      
      let added = 0;
      if (cashItem && cashItem.pct >= needed) {
        cashItem.pct -= needed;
        added = needed;
      } else if (cashItem && bondsItem) {
        const fromCash = cashItem.pct;
        const fromBonds = needed - fromCash;
        cashItem.pct = 0;
        bondsItem.pct = Math.max(0, bondsItem.pct - fromBonds);
        added = fromCash + Math.min(fromBonds, bondsItem.pct + fromBonds);
      }
      
      dynItem.pct += added;
      adjustedAssets.push("dyn");
    }
  }

  let totalOverflow = 0;

  // 1. Orežeme aktíva nad caps
  for (const item of mix) {
    const cap = caps[item.key];
    if (cap !== undefined && item.pct > cap) {
      const overflow = item.pct - cap;
      totalOverflow += overflow;
      item.pct = cap;
      adjustedAssets.push(item.key);

      console.log(
        `[ProfileAssetPolicy] ${item.key}: ${(cap + overflow).toFixed(1)}% → ${cap.toFixed(1)}% (cap enforced, overflow ${overflow.toFixed(1)}%)`
      );
    }
  }

  // 2. Redistribuujeme overflow do core assets
  if (totalOverflow > 0.01) {
    console.log(
      `[ProfileAssetPolicy] Redistributing ${totalOverflow.toFixed(1)}% overflow to core assets: ${coreAssets.join(", ")}`
    );

    // Distribuuj proporcionálne medzi core assets, ktoré majú priestor
    const availableCore = coreAssets
      .map((key) => {
        const item = mix.find((m) => m.key === key);
        const cap = caps[key] ?? 100;
        const room = item ? cap - item.pct : cap;
        return { key, room };
      })
      .filter((x) => x.room > 0.1);

    if (availableCore.length === 0) {
      console.warn(
        `[ProfileAssetPolicy] No room in core assets, distributing to all available`
      );
      // Fallback: distribuuj do všetkých aktív s priestorom
      const allAvailable = mix
        .map((item) => {
          const cap = caps[item.key] ?? 100;
          const room = cap - item.pct;
          return { key: item.key, room };
        })
        .filter((x) => x.room > 0.1);

      const totalRoom = allAvailable.reduce((sum, x) => sum + x.room, 0);

      for (const { key, room } of allAvailable) {
        const share = room / totalRoom;
        const add = totalOverflow * share;
        const item = mix.find((m) => m.key === key)!;
        item.pct += add;
      }
    } else {
      const totalRoom = availableCore.reduce((sum, x) => sum + x.room, 0);

      for (const { key, room } of availableCore) {
        const share = room / totalRoom;
        const add = totalOverflow * share;
        const item = mix.find((m) => m.key === key);
        if (item) {
          item.pct += add;
          console.log(
            `[ProfileAssetPolicy]   → ${key} +${add.toFixed(1)}% (room ${room.toFixed(1)}%)`
          );
        }
      }
    }
  }

  // 3. Normalize na 100%
  const sum = mix.reduce((acc, m) => acc + m.pct, 0);
  if (Math.abs(sum - 100) > 0.01) {
    const factor = 100 / sum;
    for (const item of mix) {
      item.pct *= factor;
    }
    console.log(
      `[ProfileAssetPolicy] Normalized: ${sum.toFixed(2)}% → 100.00%`
    );
  }

  return { mix, adjustedAssets };
}
