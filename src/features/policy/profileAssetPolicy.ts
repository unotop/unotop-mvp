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
  vyvazeny: 10,      // PR-34: Zvýšené z 8% → 10% (4700/500/20 baseline)
  rastovy: 15,       // PR-34: Zvýšené z 12% → 15% (4700/500/20 aggressive)
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
  // PR-34 FIX: Rastový/Vyvážený STARTER musia mať vyššie caps (dyn, crypto)
  // aby sa odlíšili od konzervatívneho. Inak risk 3.9 namiesto 8.5.
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
      dyn: 18,       // P1.2 FIX: Zvýšené z 15% → 18% (separation from Conservative, below Growth)
      crypto: 5,     // PR-34: Zvýšené z 3% → 5%
      real: 0,       // Žiadne reality (stále malý plán)
      bond3y9: 22,   // P1.2 FIX: Zvýšené z 20% → 22% (yield boost)
      etf: 50,       // PR-34: Zvýšené z 45% → 50%
      gold: 15,      // P1.2 FIX: Znížené z 20% → 15% (menej zlata než Conservative, viac než Growth)
      cash: 15,
    },
    rastovy: {
      dyn: 25,       // P1.2 FIX: Zvýšené z 22% → 25% (ešte viac dyn pre yield boost)
      crypto: 12,    // P0 FIX: Zvýšené z 10% → 12%
      real: 5,       // Malé reality
      bond3y9: 25,   // P1.2 FIX: Zvýšené z 20% → 25% (bond9 má vyšší yield než bonds)
      etf: 55,       // PR-34: Zvýšené z 50% → 55%
      gold: 8,       // P1.2 FIX: Znížené z 12% → 8% (menej bezpečného piliera, viac priestoru pre high-yield)
      cash: 10,
    },
  },

  // CORE (50k - 100k EUR)
  core: {
    konzervativny: {
      dyn: 0,        // P1.5 FIX: Znížené z 5% → 0% (žiadne dyn v CORE conservative)
      crypto: 0,     // Žiadne crypto
      real: 0,       // Žiadne reality
      bond3y9: 20,   // Viac bond9
      etf: 30,       // P1.5 FIX: Znížené z 35% → 30% (strict risk control)
      gold: 40,
      cash: 20,
    },
    vyvazeny: {
      dyn: 8,        // PR-34: Zvýšené z 5% → 8% (10k/300/20 yield gap fix)
      crypto: 5,     // Viac crypto
      real: 10,      // Povolené reality
      bond3y9: 20,
      etf: 50,       // Viac ETF
      gold: 40,
      cash: 15,
    },
    rastovy: {
      dyn: 22,       // P0 FIX: Zvýšené z 15% → 22% (CORE Growth must have high dyn)
      crypto: 12,    // P0 FIX: Zvýšené z 10% → 12%
      real: 15,      // Viac reality
      bond3y9: 25,
      etf: 50,
      gold: 15,      // P0 FIX: Znížené z 40% → 15% (konzistencia s STARTER)
      cash: 10,
    },
  },

  // PREMIUM (≥ 100k EUR)
  premium: {
    konzervativny: {
      dyn: 5,        // P1.5 FIX: Znížené z 7% → 5% (strict Conservative risk control)
      crypto: 0,     // Konzervatívny klient nepotrebuje crypto
      real: 5,       // Voliteľne malé reality (skôr 0)
      bond3y9: 12,   // PR-33 FIX E: 25% → 12% (KEY CHANGE - zabráni Conservative > Growth v yield)
      etf: 25,       // P1.5 FIX: Znížené z 20% → 25% (mierne zvýšené, ale stále < Balanced)
      gold: 40,
      cash: 20,
    },
    vyvazeny: {
      dyn: 12,       // PR-34: Zvýšené z 10% → 12% (4700/500/20 yield fix)
      crypto: 7,     // Viac crypto
      real: 10,      // Viac reality
      bond3y9: 25,
      etf: 50,       // Výrazne viac ETF
      gold: 40,
      cash: 15,
    },
    rastovy: {
      dyn: 22,       // PR-34: Zvýšené z 20% → 22% (4700/500/20 aggressive yield)
      crypto: 12,    // P0 FIX: Zvýšené z 10% → 12% (najvyššie crypto)
      real: 20,      // Najvyššie reality
      bond3y9: 30,   // Najvyššie bond9
      etf: 55,       // Najvyššie ETF
      gold: 12,      // P0 FIX: Znížené z 40% → 12% (konzistencia, priestor pre dyn/crypto)
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
 * P1.5 FIX: Conservative prioritizuje bonds/cash PRED gold (strict risk control)
 */
const CORE_ASSETS: Record<RiskPref, MixItem["key"][]> = {
  konzervativny: ["bonds", "bond3y9", "cash", "gold"], // P1.5: Safety bonds FIRST, gold last
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
