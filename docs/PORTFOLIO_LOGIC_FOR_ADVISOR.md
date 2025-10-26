# Logika prepočtov portfólií – Technická špecifikácia pre advisora

**Dátum:** 26. október 2025  
**Verzia:** v0.6.7-hotfix3  
**Účel:** Kompletná dokumentácia logiky výpočtov a validácie portfólií pre finančného advisora

---

## 🔴 AKTUÁLNY KRITICKÝ PROBLÉM

### Symptóm:

Pri **nízkych vkladoch** (napr. 0 € jednorazovo + 100 € mesačne):

- **Konzervativny profil** sa **nevyberie** na kliknutie
- Console error: `"Riziko 4.7 prekračuje limit 3.5 pre konzervativny profil"`
- Telemetry spam v konzole (50+ logov policy_adjustment)

### Root Cause:

1. **Asset minimumy** (PR-12) vynulujú bonds (2500 €) a dyn (1000 €)
2. Fallback logika presunie alokáciu → **ETF**
3. ETF zvýši **riziko na 4.7** (nad konzervativny cap 3.5)
4. Validácia **zlyháva** → portfolio sa nevyberie

---

## 📊 PREPOČTOVÁ PIPELINE (krok po kroku)

### Pipeline Flow:

```
BaseMix (preset)
  ↓
1. bondMinimumAdjustment (bonds 5%)
  ↓
2. lumpSumScaling (ak lumpSum < 10k)
  ↓
3. monthlyScaling (ak monthly > 0)
  ↓
4. cashReserveAdjustment
  ↓
5. applyMinimums ← PROBLÉM JE TU
  ↓
6. enforceStageCaps (STARTER/CORE/GROWTH)
  ↓
7. normalize (100%)
  ↓
FINAL MIX
  ↓
VALIDÁCIA: riskScore vs cap → FAIL!
```

---

## 🎯 1. ZÁKLADNÉ PORTFÓLIÁ (BaseMix)

### 1.1 Konzervativny

```typescript
{
  key: "gold", pct: 20      // Zlato (fyzické)
  key: "etf", pct: 20       // ETF svetové
  key: "bonds", pct: 17     // Garantované dlhopisy (10Y)
  key: "bond3y9", pct: 17   // Garantované dlhopisy (3-9Y)
  key: "dyn", pct: 8        // Dynamické riadenie
  key: "cash", pct: 12      // Hotovosť/rezerva
  key: "crypto", pct: 0     // Krypto (nie je v konzervatívnom)
  key: "real", pct: 6       // Reality/nehnuteľnosti
}
SUMA: 100%
OČAKÁVANÉ RIZIKO: ~2.5-3.0 (0-10 škála)
```

### 1.2 Vyvážený

```typescript
{
  key: "gold", pct: 15
  key: "etf", pct: 50
  key: "bonds", pct: 0
  key: "bond3y9", pct: 0
  key: "dyn", pct: 8
  key: "cash", pct: 15
  key: "crypto", pct: 4
  key: "real", pct: 8
}
SUMA: 100%
OČAKÁVANÉ RIZIKO: ~4.5-5.5
```

### 1.3 Rastový

```typescript
{
  key: "gold", pct: 10
  key: "etf", pct: 55
  key: "bonds", pct: 0
  key: "bond3y9", pct: 0
  key: "dyn", pct: 10
  key: "cash", pct: 10
  key: "crypto", pct: 5
  key: "real", pct: 10
}
SUMA: 100%
OČAKÁVANÉ RIZIKO: ~6.0-7.5
```

---

## 💰 2. ASSET MINIMUMY (PR-12) ← PROBLÉM

### 2.1 Minimálne vstupy (EUR)

| Asset      | Jednorazový min | Mesačný min | Fallback               |
| ---------- | --------------- | ----------- | ---------------------- |
| **ETF**    | 0               | 20          | -                      |
| **Gold**   | 0               | 50          | ETF 60% + Cash 40%     |
| **Bonds**  | **2500**        | 0           | **ETF 70% + Cash 30%** |
| **Dyn**    | **1000**        | 0           | **ETF 100%**           |
| **Crypto** | 100             | 50          | Cash 100%              |
| **Cash**   | 0               | 0           | -                      |
| **Real**   | **300000**      | 0           | ETF 80% + Cash 20%     |

### 2.2 Výpočet "totalFirstYear"

```typescript
totalFirstYear = lumpSumEur + (monthlyEur * 12)

Príklad:
  lumpSumEur = 0
  monthlyEur = 100
  → totalFirstYear = 1200 EUR
```

### 2.3 Logika applyMinimums (src/features/portfolio/assetMinimums.ts)

```typescript
function applyMinimums(mix: MixItem[], profile: Profile): Result {
  const lumpSum = profile.lumpSumEur || 0;
  const monthly = profile.monthlyEur || 0;
  const totalFirstYear = lumpSum + monthly * 12;

  // Pre každý asset: check minimá
  for (const item of mix) {
    const minDef = ASSET_MINIMUMS[item.key];
    const isAvailable = isAssetAvailable(
      item.key,
      lumpSum,
      monthly,
      totalFirstYear
    );

    if (!isAvailable && item.pct > 0) {
      // Asset nie je dostupný → FALLBACK
      const fallback = minDef.fallback;
      const amountToRedistribute = item.pct;

      // Vynuluj asset
      item.pct = 0;

      // Redistribuuj podľa fallback pravidiel
      for (const [targetKey, targetPct] of Object.entries(fallback)) {
        const targetIdx = mix.findIndex((m) => m.key === targetKey);
        mix[targetIdx].pct += amountToRedistribute * targetPct;
      }

      // Log warning
      warnings.push({
        type: "info",
        scope: "minimums",
        message: `${LABELS[item.key]} nedostupné...`,
      });
    }
  }

  return { mix, warnings };
}
```

---

## 📈 3. STAGE CAPS (src/features/policy/stage.ts)

### 3.1 Stage Detection

```typescript
function detectStage(
  lumpSumEur: number,
  monthlyEur: number,
  horizonYears: number,
  goalAssetsEur: number
): Stage {
  const totalFirstYear = lumpSumEur + monthlyEur * 12;

  // STARTER: malé vklady, dlhý horizont
  if (totalFirstYear < 10000 && horizonYears >= 10) {
    return "STARTER";
  }

  // GROWTH: vyššie vklady, stredný horizont
  if (totalFirstYear >= 10000 && horizonYears >= 5) {
    return "GROWTH";
  }

  // CORE: všetko ostatné (default)
  return "CORE";
}
```

### 3.2 Asset Caps podľa Stage (src/features/portfolio/presets.ts)

```typescript
const ASSET_CAPS = {
  STARTER: {
    etf: 50, // max 50% ETF
    gold: 40, // max 40% zlato
    dyn: 15, // max 15% dyn
    crypto: 10, // max 10% krypto
    real: 15, // max 15% reality
  },
  CORE: {
    etf: 70,
    gold: 50,
    dyn: 25,
    crypto: 15,
    real: 30,
  },
  GROWTH: {
    etf: 80,
    gold: 60,
    dyn: 30,
    crypto: 20,
    real: 40,
  },
};

// Kombo cap: dyn + crypto spolu
const COMBO_CAP = {
  STARTER: 18,
  CORE: 25,
  GROWTH: 35,
};
```

### 3.3 enforceStageCaps Logic

```typescript
function enforceStageCaps(
  mix: MixItem[],
  riskPref: RiskPref,
  stage: Stage
): MixItem[] {
  const caps = getAssetCaps(riskPref, stage);
  const comboCap = getDynCryptoComboCap(stage);

  let overflow = 0;

  // 1. Enforce individuálne caps
  for (const item of mix) {
    const cap = caps[item.key];
    if (cap && item.pct > cap) {
      overflow += item.pct - cap;
      item.pct = cap;
      // Telemetry: policy_adjustment
    }
  }

  // 2. Enforce combo cap (dyn + crypto)
  const dynPct = getPct("dyn");
  const cryptoPct = getPct("crypto");
  const comboSum = dynPct + cryptoPct;

  if (comboSum > comboCap) {
    const comboOverflow = comboSum - comboCap;
    // Proporcionálne zníž dyn a crypto
    overflow += comboOverflow;
  }

  // 3. Redistribuuj overflow
  // → Do buckets: etf, bonds, gold, cash
  // → Skip assets kde inputPct === 0 (vynulované applyMinimums)

  const buckets = ["etf", "bonds", "gold", "cash"];
  const inputSnapshot = new Map(mix.map((m) => [m.key, m.pct]));

  for (const bucket of buckets) {
    const inputPct = inputSnapshot.get(bucket) || 0;
    if (inputPct === 0) continue; // ← PR-12 FIX

    const current = getPct(bucket);
    const cap = caps[bucket];
    const room = cap ? Math.max(0, cap - current) : Infinity;
    const toAdd = Math.min(room, overflow);

    setPct(bucket, current + toAdd);
    overflow -= toAdd;
  }

  // 4. Normalize na 100%
  return normalize(mix);
}
```

---

## 🎲 4. VÝPOČET RIZIKA (src/features/mix/assetModel.ts)

### 4.1 Risk Scoring Logic

```typescript
// Risk váhy pre každý asset (0-10 škála)
const RISK_WEIGHTS = {
  cash: 0.5,
  bonds: 1.5,
  bond3y9: 2.0,
  gold: 3.0,
  etf: 5.0,
  dyn: 6.0,
  real: 6.5,
  crypto: 9.0,
};

function riskScore0to10(mix: MixItem[], riskPref?: RiskPref): number {
  let score = 0;

  for (const item of mix) {
    const weight = RISK_WEIGHTS[item.key] || 5;
    score += (item.pct / 100) * weight;
  }

  return score;
}

// Príklad (Konzervativny po applyMinimums):
// gold: 20% * 3.0 = 0.60
// etf: 54% * 5.0 = 2.70  ← ZVÝŠENÉ z 20% na 54%!
// bonds: 0% * 1.5 = 0    ← VYNULOVANÉ
// bond3y9: 0% * 2.0 = 0  ← VYNULOVANÉ
// dyn: 0% * 6.0 = 0      ← VYNULOVANÉ
// cash: 20% * 0.5 = 0.10 ← ZVÝŠENÉ z 12% na 20%
// real: 6% * 6.5 = 0.39
// TOTAL: 4.79 → zaokrúhlené 4.7
```

### 4.2 Risk Caps (src/features/policy/risk.ts)

```typescript
const BASE_CAPS = {
  konzervativny: 3.5, // ← KONZERVATIVNY CAP
  vyvazeny: 6.0,
  rastovy: 7.5,
};

function getAdaptiveRiskCap(riskPref: RiskPref, stage: Stage): number {
  const base = BASE_CAPS[riskPref];

  // STARTER má nižšie caps (mladší investor)
  if (stage === "STARTER") {
    return base * 0.85; // -15%
  }

  // GROWTH má vyššie caps (skúsený investor)
  if (stage === "GROWTH") {
    return base * 1.15; // +15%
  }

  return base; // CORE
}
```

---

## ⚠️ 5. VALIDÁCIA (src/features/portfolio/presets.ts)

### 5.1 Validačná Logika

```typescript
function validatePresetRisk(
  mix: MixItem[],
  presetId: string,
  risk: number,
  cap: number,
  lumpSumEur: number,
  monthlyEur: number
): ValidationResult {
  const totalFirstYear = lumpSumEur + monthlyEur * 12;

  // Check 1: Riziko vs cap
  if (risk > cap) {
    return {
      valid: false,
      message: `Riziko ${risk.toFixed(1)} prekračuje limit ${cap} pre ${presetId} profil.`,
    };
  }

  // Check 2: Minimálne vklady (2000 EUR threshold - odstránený v PR-11)
  // if (totalFirstYear < 2000) {
  //   return { valid: false, message: '...' };
  // }

  return { valid: true };
}
```

### 5.2 Prečo validácia zlyháva?

**Scenár: Konzervativny pri 100 EUR mesačne**

1. **BaseMix:**
   - bonds: 17%, bond3y9: 17%, dyn: 8%
   - RISK: ~2.8 ✅

2. **Po applyMinimums:**
   - bonds: 0% (fallback → ETF 70% + cash 30%)
   - bond3y9: 0% (fallback → ETF 70% + cash 30%)
   - dyn: 0% (fallback → ETF 100%)
   - **ETF exploduje: 20% + 11.9 + 11.9 + 8 = 51.8%**
   - RISK: ~4.2 ⚠️

3. **Po enforceStageCaps (STARTER):**
   - ETF cap 50% → zníž na 50%
   - Overflow 1.8% → redistribúcia do gold/cash
   - **Final: ETF 50%, gold 27%, cash 17%**
   - RISK: **4.7** ❌

4. **Validácia:**
   - risk 4.7 > cap 3.5 → **FAIL**

---

## 🔧 6. MOŽNÉ RIEŠENIA

### Option 1: Znížiť ETF risk weight

```typescript
// CURRENT:
const RISK_WEIGHTS = { etf: 5.0 };

// NAVRHOVANÉ:
const RISK_WEIGHTS = { etf: 4.0 }; // -20%

// Dopad na Konzervativny (po adjustments):
// gold: 27% * 3.0 = 0.81
// etf: 50% * 4.0 = 2.00 ← ZNÍŽENÉ z 2.50
// cash: 17% * 0.5 = 0.08
// real: 6% * 6.5 = 0.39
// TOTAL: 3.28 ✅ (pod cap 3.5)
```

**PRO:**

- Jednoduchá zmena (1 riadok)
- Nič sa nerozbije
- Okamžité riešenie

**CON:**

- ETF je objectively rizikovejší než cash/bonds
- Porušuje "realistickú" risk škálu
- Advisor by mal schváliť

---

### Option 2: Zvýšiť konzervativny cap

```typescript
// CURRENT:
const BASE_CAPS = { konzervativny: 3.5 };

// NAVRHOVANÉ:
const BASE_CAPS = { konzervativny: 4.0 }; // +14%

// alebo pre STARTER stage:
function getAdaptiveRiskCap(riskPref, stage) {
  if (riskPref === "konzervativny" && stage === "STARTER") {
    return 4.5; // vyšší cap pre mladých
  }
  // ...
}
```

**PRO:**

- Rešpektuje reálne riziká aktív
- STARTER investori môžu uniesť viac rizika (dlhý horizont)

**CON:**

- "Konzervativny" profil už nie je konzervativny
- Marketing/regulácia môže mať problém

---

### Option 3: Inteligentnejší fallback

```typescript
// CURRENT:
bonds fallback → ETF 70% + cash 30%

// NAVRHOVANÉ:
bonds fallback → {
  if (riskPref === 'konzervativny') {
    gold: 50%,  // bezpečnejšie ako ETF
    etf: 30%,
    cash: 20%
  } else {
    etf: 70%,
    cash: 30%
  }
}
```

**PRO:**

- Risk-aware fallback
- Konzervativny profil zostane konzervativny

**CON:**

- Zložitejšia logika
- Viac kódu na testovanie

---

### Option 4: Gradual asset unlock

```typescript
// Namiesto binárneho (dostupné/nedostupné):
function getAssetAllocationLimit(
  asset: AssetKey,
  totalFirstYear: number
): number {
  if (asset === "bonds") {
    if (totalFirstYear < 1000) return 0; // 0%
    if (totalFirstYear < 2500) return 10; // max 10%
    return 100; // unlimited
  }
  // ...
}
```

**PRO:**

- Plynulý prechod
- Žiadne náhle skoky v riziku

**CON:**

- Najkomplexnejšia implementácia
- Advisor musí definovať thresholdy

---

## 📊 7. TESTOVACÍ SCENÁR

### Test Case: Konzervativny pri nízkych vkladoch

```typescript
// INPUT:
lumpSumEur = 0
monthlyEur = 100
horizonYears = 20
goalAssetsEur = 50000
riskPref = 'konzervativny'

// EXPECTED OUTPUT (po oprave):
stage = 'STARTER'
mix = {
  gold: 27%,
  etf: 43%,    // znížené z 50%
  cash: 20%,   // zvýšené z 17%
  real: 6%,
  bonds: 0%,
  bond3y9: 0%,
  dyn: 0%,
  crypto: 0%
}
riskScore = 3.4  // ✅ pod cap 3.5
validation = PASS ✅
```

---

## 🎯 8. ODPORÚČANIE PRE ADVISORA

### Immediate Fix (do 1 hodiny):

**Option 1: Znížiť ETF risk weight na 4.0**

- Najrýchlejšie riešenie
- Minimálny dopad na ostatné profily
- Potrebuje advisor approval

### Short-term (do týždňa):

**Option 3: Risk-aware fallback pre konzervativny**

- Bonds/dyn → gold+cash namiesto ETF
- Zachová konzervativny charakter

### Long-term (mesiac):

**Option 4: Gradual asset unlock**

- Definovať thresholdy s advisorom
- Plynulý prechod medzi úrovňami
- Najlepší UX

---

## 📁 9. SÚBORY NA REVIEW

### Kritické súbory:

1. `src/features/portfolio/assetMinimums.ts` (asset minimumy + fallback)
2. `src/features/portfolio/presets.ts` (enforceStageCaps + validácia)
3. `src/features/mix/assetModel.ts` (risk scoring)
4. `src/features/policy/risk.ts` (risk caps)
5. `src/features/policy/stage.ts` (stage detection)

### Test files:

1. `tests/invariants.limits.test.tsx`
2. `tests/acceptance.mix-cap.ui.test.tsx`

---

## 🔥 10. URGENT ACTION ITEMS

1. **Advisor rozhodnutie:**
   - Schváliť ETF risk weight 4.0? (áno/nie)
   - Alebo zvýšiť konzervativny cap na 4.0?
   - Alebo redesign fallback?

2. **Implementácia:**
   - Zmena 1 riadku (risk weight)
   - Alebo 10 riadkov (fallback)
   - Alebo 100+ riadkov (gradual unlock)

3. **Testing:**
   - Manuálne testy všetkých 3 profilov
   - Pri 100/500/1000/5000 EUR mesačne
   - Pri 0/1000/2500/10000 EUR jednorazovo

4. **Dokumentácia:**
   - Update UX copy (InfoBox text)
   - Update warning messages
   - Update FAQ

---

## 📞 KONTAKT

Pre otázky, pripomienky alebo schválenie riešenia kontaktuj development team.

**Verzia dokumentu:** 1.0  
**Posledná aktualizácia:** 26.10.2025 23:15  
**Status:** ČAKÁ NA ADVISOR ROZHODNUTIE
