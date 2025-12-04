# PR-34: Balanced & Growth Profile – Gold Policy, RiskCap Fallback & Yield Optimizer Alignment

**Status:** 🔴 BLOCKING (Balanced/Growth nepoužiteľné v produkčných scenároch)

**Context:** PR-33 fixed LOOP/DEADLOCK crashes, ale fundamentálna logika gold policy je zlá:

- Balanced/Growth končia s **36-40% zlata** (viac ako Conservative 20%)
- Výnos/riziko hierarchia je **invertovaná** (Conservative 9.5% @ risk 3.7 > Balanced 7.7% @ risk 6.5)
- Scenáre 0/600/20 sú **neaplikovateľné** (VALIDATION FAILED: gold/ETF over cap)

---

## 1. Ciele PR-34

Stabilizovať Balanced & Growth profily, aby:

1. ✅ **Vždy sa dali zvoliť** (žiadne preset-validation errors kvôli gold/ETF caps)
2. ✅ **Logická hierarchia:**
   - `yield_C < yield_B < yield_G` (min 0.3 p.b. gaps)
   - `risk_C < risk_B < risk_G`
   - `gold_B ≤ gold_C` a `gold_G ≤ gold_B` (pri rovnakom vstupe)
3. ✅ **Max výnos pod risk capom** (engine využije risk budget, nedrží zbytočný gold+cash balík)

---

## 2. Konkrétne Problémy (s logmi & scenármi)

### 2.1 Pomer výnos/riziko je nelogický medzi profilmi

**Scenár 10 000 / 300 / 20:**
| Profil | Yield p.a. | Risk | Problém |
|--------|------------|------|---------|
| Conservative | ~9.5% | ~3.7 | ✅ OK |
| Balanced | ~7.7% | ~6.5 | ❌ Vyššie riziko, **nižší výnos** ako C → nezmysel |
| Growth | ~9.8% | ~8.5 | ❌ Len o 0.3 p.b. viac než C, ale za **+4.8 risk** → zlý pomer |

**Scenár 0 / 600 / 20:**
| Profil | Status |
|--------|--------|
| Conservative | ✅ ~9% p.a. @ risk 4.4 |
| Balanced | ❌ **VALIDATION FAILED** (gold alebo ETF nad cap) |
| Growth | ❌ **VALIDATION FAILED** (gold alebo ETF nad cap) |

### 2.2 Zlato je používané ako „odpadkový kôš" pre riskCap

**Aktuálne správanie:**

```
[EnforceRiskCap] Iteration 1: dyn 8.0% → 6.0% (-2.00 p.b.)
[EnforceRiskCap] Primary sink: gold +1.50 p.b., cash +0.50 p.b.
[EnforceRiskCap] Iteration 2: crypto 5.0% → 3.0% (-2.00 p.b.)
[EnforceRiskCap] Primary sink: gold +1.50 p.b., cash +0.50 p.b.
[EnforceRiskCap] After iteration 5: gold 38.5% (was 15%)
```

**Výsledok:**

- Balanced/Growth končia na **36-40% zlata**, často viac ako Conservative (20%)
- `enforceRiskCap` pri B/G sype riziko do `gold + cash` → nafukuje zlato → yieldOptimizer pridá ETF/bond9 → **validation zabije mix**

### 2.3 Stále sú tam DEADLOCK / emergency fallback stavy

**Logy z enforceRiskCap.ts:**

```
[EnforceRiskCap] DEADLOCK: Cannot redistribute 2.35 p.b. (all targets full: gold 40.0%, cash 20.0%)
[EnforceRiskCap] EMERGENCY FALLBACK (iteration 11): Vynulujem rizikovú časť portfólia
[EnforceRiskCap]   → dyn 8.0% → 0% (emergency)
[EnforceRiskCap]   → crypto 5.0% → 0% (emergency)
```

**Tzn.** engine síce nepadá (PR-33), ale vnútorne **panikári**, prelieva percentá naprázdno a končí zvláštnymi mixami.

### 2.4 Yield optimizer porušuje capy → validation fail

**Flow:**

1. `yieldOptimizer` spraví kroky typu `IAD DK → ETF` alebo `IAD DK → Bond 9%`
2. **Nekontroluje**, či tým neprelezie:
   - ETF > 50%
   - gold > 40%
3. `PortfolioSelector` hodí: **"Validation failed: Príliš vysoká alokácia ETF (52.3%). Max 50%."**
4. Preset sa **neaplikuje** → Balanced/Growth sú pre používateľa **rozbité**

### 2.5 Biznis logika profilov sa nerespektuje

**Očakávanie:**
| Profil | Gold Target | Gold Max | ETF Target | Dyn Target |
|--------|-------------|----------|------------|------------|
| Conservative | 20-30% | 40% | 15-25% | 5-7% |
| Balanced | 10-15% | 20% | 40-50% | 5-10% |
| Growth | 8-12% | 15% | 35-45% | 10-15% |

**Realita (po enforceRiskCap):**
| Profil | Gold Actual | Problém |
|--------|-------------|---------|
| Conservative | ~20% | ✅ OK |
| Balanced | ~36% | ❌ **Viac ako Conservative!** |
| Growth | ~40% | ❌ **Viac ako Balanced!** |

**Hlavný princíp porušený:** "vždy max výnos pod risk capom" – dnes engine často drží veľký gold+cash balík a **nevyužíva naplno risk budget**.

---

## 3. TODO – Technické Úlohy

### 3.1 Gold & Sink Policy podľa profilu (P0 – BLOCKING)

**Súbory:**

- `src/features/policy/profileAssetPolicy.ts`
- `src/features/portfolio/enforceRiskCap.ts`
- `src/features/mix/assetModel.ts` (ak treba config s capmi/profilmi)

**Úlohy:**

#### ✅ Task 3.1.A: Profilové gold bandy & caps

**Súbor:** `profileAssetPolicy.ts`

Doplniť do `PROFILE_ASSET_CAPS` profilové gold bandy:

```typescript
// PR-34: Gold policy bands (target ranges)
const GOLD_POLICY: Record<
  RiskPref,
  { targetMin: number; targetMax: number; hardCap: number }
> = {
  konzervativny: { targetMin: 20, targetMax: 30, hardCap: 40 }, // OK, môže viac zlata
  vyvazeny: { targetMin: 10, targetMax: 15, hardCap: 20 }, // KEY: max 20% gold!
  rastovy: { targetMin: 8, targetMax: 12, hardCap: 15 }, // KEY: max 15% gold!
};
```

Export funkcie:

```typescript
export function getGoldPolicy(riskPref: RiskPref): {
  targetMin: number;
  targetMax: number;
  hardCap: number;
};
```

#### ✅ Task 3.1.B: Profilovo podmienený sink v enforceRiskCap

**Súbor:** `enforceRiskCap.ts`

**PRED (ZLATO = univerzálny sink):**

```typescript
const PRIMARY_SINK = [
  { key: "gold", weight: 0.75 }, // ❌ Rovnaký pre C/B/G → B/G končia s 40% zlata
  { key: "cash", weight: 0.25 },
];
```

**PO (sink závisí od profilu):**

```typescript
// PR-34: Profile-aware sink policy
const RISK_SINKS: Record<
  RiskPref,
  Array<{ key: MixItemKey; weight: number; maxPct?: number }>
> = {
  konzervativny: [
    { key: "bonds", weight: 0.3 }, // Primárne bonds
    { key: "iad", weight: 0.25 }, // bond9
    { key: "gold", weight: 0.35 }, // Zlato OK (až do 40%)
    { key: "cash", weight: 0.1 },
  ],
  vyvazeny: [
    { key: "bonds", weight: 0.4 }, // Primárne bonds
    { key: "iad", weight: 0.3 }, // bond9
    { key: "gold", weight: 0.2, maxPct: 20 }, // KEY: zlato len do 20%!
    { key: "cash", weight: 0.1 },
  ],
  rastovy: [
    { key: "bonds", weight: 0.35 }, // Primárne bonds
    { key: "iad", weight: 0.3 }, // bond9
    { key: "real", weight: 0.2 }, // Reality (nízke riziko, vyšší yield ako gold)
    { key: "gold", weight: 0.1, maxPct: 15 }, // KEY: zlato len do 15%!
    { key: "cash", weight: 0.05 },
  ],
};
```

**Logika v iterácii:**

```typescript
// Ak je gold nad profilový cap, považovať za "full"
for (const sink of RISK_SINKS[riskPref]) {
  const item = mix.find((m) => m.key === sink.key);
  if (!item) continue;

  // PR-34: Ak je sink.maxPct definovaný a aktuálne % >= maxPct → skip (sink je "full")
  if (sink.maxPct && item.pct >= sink.maxPct) {
    console.log(
      `[EnforceRiskCap]   → ${sink.key} FULL (${item.pct.toFixed(1)}% >= ${sink.maxPct}% cap)`
    );
    continue;
  }

  const room = sink.maxPct ? Math.max(0, sink.maxPct - item.pct) : Infinity;
  const allocation = Math.min(remainingReduction * sink.weight, room);

  // ... apply allocation ...
}
```

---

### 3.2 RiskCap DEADLOCK & Emergency Fallback (P0 – BLOCKING)

**Súbory:**

- `src/features/portfolio/enforceRiskCap.ts`
- `tests/risk-engine.test.tsx` (nový súbor)

**Úlohy:**

#### ✅ Task 3.2.A: Zjednodušiť iterácie v enforceRiskCap

**Súbor:** `enforceRiskCap.ts`

**PRED:**

```typescript
const MAX_ITERATIONS = 15;
// ... po 10 iteráciách emergency fallback (dyn/crypto/real → 0) ...
```

**PO:**

```typescript
const MAX_ITERATIONS = 10; // Redukcia z 15 → 10

// Iteration logic:
// 1-8: Normálny redistribučný algoritmus (RISK_SINKS podľa profilu)
// 9-10: Priamy cut high-risk assets (dyn/crypto/real/ETF) → presun do bonds/IAD
//       BEZ nafukovania zlata!

if (iterations >= 9 && currentRisk > riskMax) {
  console.warn(
    `[EnforceRiskCap] Iteration ${iterations}: Direct cut high-risk assets`
  );

  // Priorita: dyn > crypto > real > ETF (cut od najrisknejšieho)
  const cutTargets = ["dyn", "crypto", "real", "etf"];

  for (const key of cutTargets) {
    if (currentRisk <= riskMax) break;

    const item = mix.find((m) => m.key === key);
    if (!item || item.pct < 0.1) continue;

    // Cut polovicu (alebo všetko, ak risk stále vysoký)
    const cutAmount = item.pct * 0.5;
    item.pct -= cutAmount;

    // Presun do bonds/IAD (50/50 split, NIE zlato!)
    const bondsIdx = mix.findIndex((m) => m.key === "bonds");
    const iadIdx = mix.findIndex((m) => m.key === "iad");

    if (bondsIdx >= 0) mix[bondsIdx].pct += cutAmount * 0.5;
    if (iadIdx >= 0) mix[iadIdx].pct += cutAmount * 0.5;

    console.log(
      `[EnforceRiskCap]   → ${key} -${cutAmount.toFixed(1)}% (direct cut)`
    );

    // Normalize & recompute risk
    mix = normalize(mix);
    currentRisk = riskScore0to10(mix, riskPref, 0);
  }
}
```

#### ✅ Task 3.2.B: Odstrániť / minimalizovať DEADLOCK stavy

**Súbor:** `enforceRiskCap.ts`

**Zmeny:**

1. **Odstránené:** `DEADLOCK: Cannot redistribute ... (all targets full)` error
2. **Nové správanie:** Ak všetky RISK_SINKS sú full → automaticky jump to iteration 9+ (direct cut mode)

```typescript
// Check ak sú všetky sinks full
const allSinksFull = RISK_SINKS[riskPref].every((sink) => {
  const item = mix.find((m) => m.key === sink.key);
  return sink.maxPct && item && item.pct >= sink.maxPct;
});

if (allSinksFull && currentRisk > riskMax) {
  console.warn(`[EnforceRiskCap] All sinks full, switching to direct cut mode`);
  iterations = 9; // Jump to direct cut logic
  continue;
}
```

#### ✅ Task 3.2.C: Unit testy pre risk engine

**Súbor:** `tests/risk-engine.test.tsx` (nový)

**Testy:**

```typescript
describe("PR-34 Risk Engine - Profile-Aware Sinks", () => {
  it("Scenár 0/600/20 Balanced → no DEADLOCK, gold ≤ 20%", () => {
    const result = getAdjustedMix(balancedPreset, {
      riskPref: "vyvazeny",
      lumpSumEur: 0,
      monthlyEur: 600,
      horizonYears: 20,
      // ...
    });

    const goldPct = result.mix.find((m) => m.key === "gold")?.pct ?? 0;
    const risk = riskScore0to10(result.mix, "vyvazeny", 0);

    expect(goldPct).toBeLessThanOrEqual(20); // Profilový gold cap
    expect(risk).toBeLessThanOrEqual(7.0); // Risk cap Balanced
    expect(result.warnings).not.toContain("DEADLOCK");
  });

  it("Scenár 10000/300/20 Growth → no DEADLOCK, gold ≤ 15%", () => {
    // Similar test for Growth (gold cap 15%)
  });

  it("Scenár 98100/600/23 Growth → no EMERGENCY, gold ≤ 15%", () => {
    // Test high-volume Growth scenario
  });
});
```

---

### 3.3 Yield Optimizer musí rešpektovať capy (P1)

**Súbory:**

- `src/features/portfolio/yieldOptimizer.ts`
- `src/features/portfolio/presets.ts` (PortfolioSelector validation)

**Úlohy:**

#### ✅ Task 3.3.A: Cap check pred aplikovaním moves

**Súbor:** `yieldOptimizer.ts`

**PRED:**

```typescript
// Generate candidate move: IAD DK → ETF
const testMix = [...mix];
testMix[iadIdx].pct -= moveSize;
testMix[etfIdx].pct += moveSize;

// ❌ Nekontroluje, či ETF prelezie 50% cap!
const testYield = approxYieldAnnualFromMix(testMix);
if (testYield > currentYield) {
  // Apply move
}
```

**PO:**

```typescript
// PR-34: Cap validation PRED aplikovaním move
import { getGoldPolicy } from "../policy/profileAssetPolicy";

// Generate candidate move
const testMix = [...mix];
testMix[iadIdx].pct -= moveSize;
testMix[etfIdx].pct += moveSize;

// VALIDATE CAPS
const goldPolicy = getGoldPolicy(riskPref);
const etfPct = testMix.find((m) => m.key === "etf")?.pct ?? 0;
const goldPct = testMix.find((m) => m.key === "gold")?.pct ?? 0;
const dynPct = testMix.find((m) => m.key === "dyn")?.pct ?? 0;
const cryptoPct = testMix.find((m) => m.key === "crypto")?.pct ?? 0;

// Check caps
if (etfPct > 50) {
  console.log(
    `[YieldOptimizer] Move rejected: ETF ${etfPct.toFixed(1)}% > 50% cap`
  );
  continue; // Skip this move
}
if (goldPct > goldPolicy.hardCap) {
  console.log(
    `[YieldOptimizer] Move rejected: gold ${goldPct.toFixed(1)}% > ${goldPolicy.hardCap}% cap`
  );
  continue;
}
// ... check dyn/crypto/real caps ...

// If all caps OK → apply move
const testYield = approxYieldAnnualFromMix(testMix);
if (testYield > currentYield) {
  mix = testMix;
  currentYield = testYield;
}
```

#### ✅ Task 3.3.B: Safety pass po optimizácii

**Súbor:** `yieldOptimizer.ts`

Pridať na koniec `optimizeYield()`:

```typescript
// PR-34: Safety pass - stiahnuť aktíva nad cap na cap
const goldPolicy = getGoldPolicy(riskPref);

mix.forEach((item) => {
  let cap: number | undefined;

  if (item.key === "etf") cap = 50;
  else if (item.key === "gold") cap = goldPolicy.hardCap;
  else if (item.key === "dyn")
    cap = getDynCap(riskPref); // Z profileAssetPolicy
  else if (item.key === "crypto") cap = getCryptoCap(riskPref);

  if (cap && item.pct > cap) {
    const overflow = item.pct - cap;
    item.pct = cap;

    // Overflow do IAD/bonds (50/50)
    const iadIdx = mix.findIndex((m) => m.key === "iad");
    const bondsIdx = mix.findIndex((m) => m.key === "bonds");

    if (iadIdx >= 0) mix[iadIdx].pct += overflow * 0.5;
    if (bondsIdx >= 0) mix[bondsIdx].pct += overflow * 0.5;

    console.log(
      `[YieldOptimizer] Safety pass: ${item.key} ${(cap + overflow).toFixed(1)}% → ${cap}%`
    );
  }
});

// Final normalize
mix = normalize(mix);
```

**Výsledok:** `PortfolioSelector` **NIKDY** nehodí "Príliš vysoká alokácia gold/ETF" error.

---

### 3.4 Profilová Diferenciácia & Monotónnosť Výnosov (P1)

**Súbory:**

- `src/features/policy/profileAssetPolicy.ts`
- `src/features/portfolio/presets.ts` (PORTFOLIO_PRESETS)
- `tests/profile-hierarchy.test.tsx`

**Úlohy:**

#### ✅ Task 3.4.A: Upraviť default preset mixy

**Súbor:** `presets.ts`

**Conservative preset (unchanged):**

```typescript
{
  id: "konzervativny",
  mix: [
    { key: "gold", pct: 20 },      // OK, môže viac zlata
    { key: "etf", pct: 20 },
    { key: "bonds", pct: 17 },
    { key: "bond3y9", pct: 17 },   // bond9
    { key: "dyn", pct: 5 },
    { key: "cash", pct: 15 },      // IAD DK
    { key: "crypto", pct: 0 },
    { key: "real", pct: 6 },
  ],
}
```

**Balanced preset (ADJUSTED):**

```typescript
{
  id: "vyvazeny",
  mix: [
    { key: "gold", pct: 12 },      // PR-34: Znížené z 40% → 12% (target band 10-15%)
    { key: "etf", pct: 50 },       // Zvýšené z 45% → 50%
    { key: "bonds", pct: 5 },
    { key: "bond3y9", pct: 8 },    // Zvýšené z 5% → 8%
    { key: "dyn", pct: 8 },        // Zvýšené z 0% → 8% (CORE/PREMIUM stage boost)
    { key: "cash", pct: 10 },      // Znížené z 5% → 10% (IAD DK baseline)
    { key: "crypto", pct: 4 },     // Zvýšené z 0% → 4%
    { key: "real", pct: 3 },       // Zvýšené z 0% → 3%
  ],
  targetRisk: { min: 5.5, max: 6.5 },
}
```

**Growth preset (ADJUSTED):**

```typescript
{
  id: "rastovy",
  mix: [
    { key: "gold", pct: 10 },      // PR-34: Znížené z 40% → 10% (target band 8-12%)
    { key: "etf", pct: 40 },       // Znížené z 47% → 40% (uvoľniť priestor pre dyn/crypto/real)
    { key: "bonds", pct: 3 },      // Zvýšené z 2.5% → 3%
    { key: "bond3y9", pct: 5 },    // Zvýšené z 2.5% → 5%
    { key: "dyn", pct: 15 },       // Zvýšené z 0% → 15% (PREMIUM stage boost)
    { key: "cash", pct: 8 },       // Zvýšené z 5% → 8%
    { key: "crypto", pct: 8 },     // Zvýšené z 3% → 8%
    { key: "real", pct: 11 },      // Zvýšené z 0% → 11%
  ],
  targetRisk: { min: 7.0, max: 8.0 },
}
```

**Rationale:**

- **Conservative:** Bez zmeny (zlato 20% OK, bonds/IAD heavy)
- **Balanced:** Zlato 12% (target 10-15%), boost ETF/bond9/dyn/crypto
- **Growth:** Zlato 10% (target 8-12%), aggressive dyn/crypto/real

#### ✅ Task 3.4.B: Regression testy pre monotónnosť

**Súbor:** `tests/profile-hierarchy.test.tsx`

**3 referenčné scenáre:**

```typescript
describe("PR-34 Profile Hierarchy - Yield & Risk Monotonicity", () => {
  const scenarios = [
    { lump: 0, monthly: 600, years: 20 },
    { lump: 10000, monthly: 300, years: 20 },
    { lump: 98100, monthly: 600, years: 23 },
  ];

  scenarios.forEach(({ lump, monthly, years }) => {
    it(`${lump}/${monthly}/${years} → yield_C < yield_B < yield_G`, () => {
      const mixC = getAdjustedMix(conservativePreset, {
        riskPref: "konzervativny",
        lumpSumEur: lump,
        monthlyEur: monthly,
        horizonYears: years /* ... */,
      });
      const mixB = getAdjustedMix(balancedPreset, {
        riskPref: "vyvazeny",
        lumpSumEur: lump,
        monthlyEur: monthly,
        horizonYears: years /* ... */,
      });
      const mixG = getAdjustedMix(growthPreset, {
        riskPref: "rastovy",
        lumpSumEur: lump,
        monthlyEur: monthly,
        horizonYears: years /* ... */,
      });

      const yieldC = approxYieldAnnualFromMix(mixC.mix, "konzervativny") * 100;
      const yieldB = approxYieldAnnualFromMix(mixB.mix, "vyvazeny") * 100;
      const yieldG = approxYieldAnnualFromMix(mixG.mix, "rastovy") * 100;

      const riskC = riskScore0to10(mixC.mix, "konzervativny", 0);
      const riskB = riskScore0to10(mixB.mix, "vyvazeny", 0);
      const riskG = riskScore0to10(mixG.mix, "rastovy", 0);

      // Yield monotonicity
      expect(yieldB).toBeGreaterThanOrEqual(yieldC + 0.3); // Min 0.3 p.b. gap
      expect(yieldG).toBeGreaterThanOrEqual(yieldB + 0.5); // Min 0.5 p.b. gap

      // Risk monotonicity
      expect(riskB).toBeGreaterThan(riskC);
      expect(riskG).toBeGreaterThan(riskB);

      // Risk caps
      expect(riskC).toBeLessThanOrEqual(5.0); // Conservative cap
      expect(riskB).toBeLessThanOrEqual(7.0); // Balanced cap
      expect(riskG).toBeLessThanOrEqual(8.5); // Growth cap

      // Gold monotonicity (pri rovnakom vstupe)
      const goldC = mixC.mix.find((m) => m.key === "gold")?.pct ?? 0;
      const goldB = mixB.mix.find((m) => m.key === "gold")?.pct ?? 0;
      const goldG = mixG.mix.find((m) => m.key === "gold")?.pct ?? 0;

      expect(goldB).toBeLessThanOrEqual(goldC); // Balanced ≤ Conservative
      expect(goldG).toBeLessThanOrEqual(goldB); // Growth ≤ Balanced

      console.log(
        `[${lump}/${monthly}/${years}] C: ${yieldC.toFixed(1)}% @ ${riskC.toFixed(1)} (gold ${goldC.toFixed(1)}%) | B: ${yieldB.toFixed(1)}% @ ${riskB.toFixed(1)} (gold ${goldB.toFixed(1)}%) | G: ${yieldG.toFixed(1)}% @ ${riskG.toFixed(1)} (gold ${goldG.toFixed(1)}%)`
      );
    });
  });
});
```

---

## 4. Extra Biznis Pravidlo (P3 – nice-to-have)

### 4.1 Objem > 100k → dyn až do 10% pre Conservative

**Súbor:** `profileAssetPolicy.ts`

**Logic:**

```typescript
// PR-34: High-volume Conservative dyn boost
if (riskPref === "konzervativny" && effectivePlanVolume > 100000) {
  const dynItem = mix.find((m) => m.key === "dyn");

  // Ak dyn < 10%, zvýš na 10% (z cash/IAD)
  if (dynItem && dynItem.pct < 10) {
    const needed = 10 - dynItem.pct;

    // Odobrať z cash/IAD (50/50)
    const cashIdx = mix.findIndex((m) => m.key === "cash");
    const iadIdx = mix.findIndex((m) => m.key === "iad");

    if (cashIdx >= 0) mix[cashIdx].pct -= needed * 0.5;
    if (iadIdx >= 0) mix[iadIdx].pct -= needed * 0.5;

    dynItem.pct = 10;

    console.log(
      `[ProfileAssetPolicy] High-volume Conservative: dyn boost to 10% (volume ${effectivePlanVolume.toLocaleString()} EUR)`
    );
  }
}
```

**Note:** Ak sa nestíha, môže ísť do PR-35.

---

## 5. Priority Summary

| Priority | Task  | Description                                                         | Blocker?                         |
| -------- | ----- | ------------------------------------------------------------------- | -------------------------------- |
| **P0**   | 3.1.A | Gold policy bands (C: 40%, B: 20%, G: 15%)                          | ✅ Yes                           |
| **P0**   | 3.1.B | Profile-aware RISK_SINKS (B/G: bonds/IAD primárne, zlato secondary) | ✅ Yes                           |
| **P0**   | 3.2.A | Zjednodušiť riskCap iterácie (max 10, direct cut mode @ 9+)         | ✅ Yes                           |
| **P0**   | 3.2.B | Odstrániť DEADLOCK stavy (auto jump to direct cut)                  | ✅ Yes                           |
| **P0**   | 3.2.C | Unit testy pre risk engine (0/600/20, 10k/300/20, 98k/600/23)       | ✅ Yes                           |
| **P1**   | 3.3.A | Yield optimizer cap checks (ETF/gold/dyn/crypto validation)         | ⚠️ Blocker pre validation errors |
| **P1**   | 3.3.B | Safety pass po optimizácii (stiahnuť overflow na cap)               | ⚠️ Blocker pre validation errors |
| **P1**   | 3.4.A | Upraviť Balanced/Growth preset mixy (zlato 12%/10%)                 | 🔶 High                          |
| **P1**   | 3.4.B | Regression testy (3 scenáre × 3 profily = 9 tests)                  | 🔶 High                          |
| **P3**   | 4.1   | High-volume Conservative dyn boost (>100k → 10% dyn)                | ⏸️ Nice-to-have                  |

---

## 6. Otázky pre CS (GitHub Copilot)

### Q1: Gold Policy

> Vidíš problém v tom, aby **Balanced a Growth mali menej zlata** ako Conservative pri rovnakom vstupe, keďže zlato tu používame primárne ako „bezpečný pilier"?

**Odpoveď očakávaná:** ✅ Nie, je to logické. Conservative chce bezpečnosť → viac zlata. Balanced/Growth chcú rast → viac ETF/dyn/crypto.

### Q2: Yields Stability

> Sú tebou navrhnuté yields (ETF 11%, dyn 45%, crypto 20%, atď.) **stabilné**, ak ich použijeme s **vyššou váhou v Growth profile**, aby sme sa v dlhom horizonte dostali bližšie k **12-13% p.a. pri G** (pri dlhom horizonte a plnom využití risk capu)?

**Odpoveď očakávaná:** ✅ Áno, ak Growth má dyn 15%, crypto 8%, real 11% (vs Conservative dyn 5%, crypto 0%, real 6%), dostane sa na 12-13% p.a.

### Q3: RiskCap Simplicity

> Uprednostníš radšej **jednoduchšiu riskCap logiku** (menej iterácií, priamy cut do bonds/IAD) pred komplexným fallbackom, ak to zníži riziko ďalších DEADLOCK situácií?

**Odpoveď očakávaná:** ✅ Áno, preferujem: 1-8 iterácií normálne, 9-10 direct cut (bez emergency vynulovania). Stabilnejšie a ľahšie debugovať.

---

## 7. Expected Outcome

Po PR-34 implementácii:

**Scenár 10 000 / 300 / 20:**
| Profil | Yield p.a. | Risk | Gold % | Status |
|--------|------------|------|--------|--------|
| Conservative | ~9.5% | ~3.7 | ~20% | ✅ Bez zmeny |
| Balanced | ~11.0% | ~6.0 | ~12% | ✅ **Fixed** (vyšší yield, menej zlata) |
| Growth | ~13.0% | ~7.5 | ~10% | ✅ **Fixed** (najviac yield, najmenej zlata) |

**Scenár 0 / 600 / 20:**
| Profil | Status |
|--------|--------|
| Conservative | ✅ ~9% p.a. @ risk 4.4, gold ~20% |
| Balanced | ✅ **No VALIDATION FAIL** (gold ≤ 20%, ETF ≤ 50%) |
| Growth | ✅ **No VALIDATION FAIL** (gold ≤ 15%, ETF ≤ 50%) |

**Console Logs:**

- ❌ **PRED:** "DEADLOCK: Cannot redistribute..." → ✅ **PO:** Gone (auto direct cut)
- ❌ **PRED:** "EMERGENCY FALLBACK: vynulujem..." → ✅ **PO:** Replaced by direct cut mode
- ❌ **PRED:** "Validation failed: Príliš vysoká alokácia gold..." → ✅ **PO:** Gone (optimizer cap checks)

**Tests:**

- ✅ 17/17 critical tests PASS (z PR-33)
- ✅ +9 profile hierarchy tests PASS (3 scenáre × 3 profily)
- ✅ +3 risk engine tests PASS (0/600/20, 10k/300/20, 98k/600/23)

**Total:** 29/29 tests PASS

---

## 8. Implementation Plan

1. **Phase 1 (P0 – Blocking):** Tasks 3.1.A, 3.1.B, 3.2.A, 3.2.B (Gold policy + RiskCap fix) → **Blocker removal**
2. **Phase 2 (P1 – High):** Tasks 3.3.A, 3.3.B (Yield optimizer cap checks) → **Validation fix**
3. **Phase 3 (P1 – High):** Tasks 3.4.A, 3.4.B (Preset mixy + regression tests) → **Quality assurance**
4. **Phase 4 (P3 – Optional):** Task 4.1 (High-volume Conservative dyn boost) → **Nice-to-have**

**Estimated effort:**

- Phase 1: ~2-3 hodiny (core logic changes)
- Phase 2: ~1-2 hodiny (cap validation)
- Phase 3: ~1-2 hodiny (preset adjustments + tests)
- Phase 4: ~30 min (single rule)

**Total:** ~4-7 hodín (depending na testovanie & debugging)

---

## 9. Commit Message Template

```
fix(PR-34): Stabilize Balanced & Growth profiles - gold policy & riskCap alignment

PROBLEM:
- Balanced/Growth končili s 36-40% zlata (viac ako Conservative 20%)
- Yield/risk hierarchy invertovaná (Conservative 9.5% @ 3.7 > Balanced 7.7% @ 6.5)
- Scenáre 0/600/20 neaplikovateľné (VALIDATION FAILED: gold/ETF over cap)
- DEADLOCK/EMERGENCY fallback stavy stále prítomné

FIXES:
- Gold policy bands: C 40%, B 20%, G 15% (hard caps)
- Profile-aware RISK_SINKS (B/G: bonds/IAD primárne, zlato secondary)
- RiskCap simplified: max 10 iterácií, direct cut @ 9+ (no emergency vynulovanie)
- Yield optimizer cap checks (ETF/gold/dyn/crypto validation pred move)
- Balanced/Growth preset mixy adjusted (zlato 12%/10%, boost ETF/dyn/crypto)

RESULTS:
- 29/29 tests PASS (17 critical + 9 hierarchy + 3 risk engine)
- Yield hierarchy: C 9.5% < B 11.0% < G 13.0% (monotonic)
- Gold hierarchy: C 20% > B 12% > G 10% (correct inversion)
- No VALIDATION FAILED errors (gold/ETF caps respected)
- No DEADLOCK/EMERGENCY (direct cut mode stable)

BREAKING CHANGES: None (internal logic only, API unchanged)
```
