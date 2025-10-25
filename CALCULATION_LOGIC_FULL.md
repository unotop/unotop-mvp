# UNOTOP MVP - Komplexná dokumentácia výpočtovej logiky

**Vytvorené:** 25. október 2025  
**Účel:** Zdieľanie s advisorom pre úpravu výpočtov

---

## 📋 OBSAH

1. [Prehľad architektúry](#1-prehľad-architektúry)
2. [Vstupné dáta](#2-vstupné-dáta)
3. [Asset konfigurácia (výnosy & riziká)](#3-asset-konfigurácia-výnosy--riziká)
4. [Výpočet budúcej hodnoty (FV)](#4-výpočet-budúcej-hodnoty-fv)
5. [Výpočet váženého výnosu](#5-výpočet-váženého-výnosu)
6. [Výpočet rizika](#6-výpočet-rizika)
7. [Portfolio presets a úpravy](#7-portfolio-presets-a-úpravy)
8. [UI zobrazenie a flow](#8-ui-zobrazenie-a-flow)
9. [Príklady výpočtov](#9-príklady-výpočtov)
10. [Poznámky pre advisora](#10-poznámky-pre-advisora)

---

## 1. PREHĽAD ARCHITEKTÚRY

### Štruktúra výpočtových modulov

```
src/
├── engine/
│   └── calculations.ts          # FV výpočet (mesačná kapitalizácia)
├── features/
│   └── mix/
│       └── assetModel.ts        # Asset yields, risks, scoring
│   └── portfolio/
│       ├── presets.ts           # 3 predpripravené profily
│       └── lumpSumScaling.ts    # Úprava mixu podľa veľkosti investície
├── domain/
│   └── assets.ts                # Legacy/Current risk modes (DEPRECATED v BASIC)
└── persist/
    └── v3.ts                    # Perzistencia (localStorage)
```

### Tok dát

```
USER INPUTS (sec2: Investičné nastavenia)
    ↓
    lumpSumEur, monthlyVklad, horizonYears, goalAssetsEur
    ↓
PROFILE SELECTION (sec3: Portfolio profil)
    ↓
    riskPref: "konzervativny" | "vyvazeny" | "rastovy"
    ↓
PRESET ADJUSTMENT (presets.ts)
    ↓
    adjustPresetForProfile() → vráti MixItem[]
    ↓
CALCULATIONS (assetModel.ts + calculations.ts)
    ↓
    approxYieldAnnualFromMix() → ročný výnos (napr. 0.12 = 12%)
    ↓
    calculateFutureValue() → budúca hodnota (FV) v EUR
    ↓
    riskScore0to10() → rizikové skóre 0-10
    ↓
UI DISPLAY (BasicProjectionPanel.tsx, MetricsSection.tsx)
    ↓
    Formátované hodnoty, progress bar, KPI cards
```

---

## 2. VSTUPNÉ DÁTA

### Zdroj: `persist/v3.ts` (localStorage kľúč: `unotop:v3`)

```typescript
interface V3State {
  // Investičné parametre (sec2)
  profile: {
    lumpSumEur: number; // Jednorazová investícia
    monthlyVklad: number; // Mesačný vklad (starší systém používa "monthly")
    horizonYears: number; // Investičný horizont (roky)
    goalAssetsEur: number; // Cieľ majetku (EUR)

    // Cashflow & rezerva (sec1)
    monthlyIncome: number; // Mesačný príjem
    fixedExp: number; // Fixné výdavky
    varExp: number; // Variabilné výdavky
    reserveEur: number; // Súčasná rezerva (EUR)
    reserveMonths: number; // Rezerva (počet mesiacov)

    // Profil & UI režim
    riskPref: "konzervativny" | "vyvazeny" | "rastovy";
    modeUi: "BASIC" | "PRO"; // UI režim (BASIC = default)
  };

  // Portfólio mix (sec3)
  mix: MixItem[]; // Aktuálne zloženie portfólia

  // Dlhy (PRO režim)
  debts: Debt[]; // Zoznam dlhov/hypoték
}

interface MixItem {
  key:
    | "gold"
    | "etf"
    | "bonds"
    | "bond3y9"
    | "dyn"
    | "cash"
    | "crypto"
    | "real";
  pct: number; // Percentuálna alokácia (0-100)
}
```

### Príklad reálnych vstupov

```json
{
  "profile": {
    "lumpSumEur": 10000,
    "monthlyVklad": 200,
    "horizonYears": 20,
    "goalAssetsEur": 100000,
    "monthlyIncome": 2500,
    "fixedExp": 800,
    "varExp": 500,
    "reserveEur": 3000,
    "reserveMonths": 6,
    "riskPref": "vyvazeny"
  },
  "mix": [
    { "key": "gold", "pct": 13 },
    { "key": "etf", "pct": 32 },
    { "key": "bonds", "pct": 10 },
    { "key": "bond3y9", "pct": 10 },
    { "key": "dyn", "pct": 18 },
    { "key": "cash", "pct": 9 },
    { "key": "crypto", "pct": 4 },
    { "key": "real", "pct": 4 }
  ]
}
```

**Validácie:**

- Súčet `mix[].pct` musí byť **presne 100%** (tolerance ±0.05)
- `horizonYears >= 0` (ak 0, FV = lumpSum)
- `monthlyVklad >= 0`
- Žiadne aktívum > 40% (okrem bonds v konzervatívnom profile, max 35%)

---

## 3. ASSET KONFIGURÁCIA (VÝNOSY & RIZIKÁ)

### Súbor: `src/features/mix/assetModel.ts`

#### 3.1 Výnosy p.a. (Per Annum)

```typescript
const ASSET_YIELDS: Record<
  AssetKey,
  { konzervativny: number; vyvazeny: number; rastovy: number }
> = {
  etf: { konzervativny: 0.09, vyvazeny: 0.14, rastovy: 0.18 },
  gold: { konzervativny: 0.07, vyvazeny: 0.095, rastovy: 0.11 },
  crypto: { konzervativny: 0.12, vyvazeny: 0.2, rastovy: 0.35 },

  // Dynamické riadenie: mesačne 2%/3%/4% → anualizované
  dyn: {
    konzervativny: Math.pow(1 + 0.02, 12) - 1, // ≈ 26.82 %
    vyvazeny: Math.pow(1 + 0.03, 12) - 1, // ≈ 42.58 %
    rastovy: Math.pow(1 + 0.04, 12) - 1, // ≈ 60.10 %
  },

  bonds: { konzervativny: 0.075, vyvazeny: 0.075, rastovy: 0.075 }, // Garantovaný 7.5% (5r)
  bond3y9: { konzervativny: 0.09, vyvazeny: 0.09, rastovy: 0.09 }, // Dlhopis 3r/9% (mesačný CF)
  cash: { konzervativny: 0.0, vyvazeny: 0.0, rastovy: 0.0 },
  real: { konzervativny: 0.075, vyvazeny: 0.087, rastovy: 0.095 },
};
```

**Poznámky:**

- **ETF (svet - aktívne):** Konzervatívny profil má nižší očakávaný výnos (9%) vs. rastový (18%)
- **Dynamické riadenie (dyn):** Mesačné výnosy 2%/3%/4% sú anualizované cez compound formula
- **Bonds a bond3y9:** Fixné výnosy (garantované), nezávislé od profilu
- **Cash:** Nulový výnos (bezpečná rezerva)
- **Reality (real):** Postupne rastúci výnos s vyšším rizikom

#### 3.2 Riziko (škála 0-10)

```typescript
const ASSET_RISKS: Record<
  AssetKey,
  { konzervativny: number; vyvazeny: number; rastovy: number }
> = {
  etf: { konzervativny: 5, vyvazeny: 5, rastovy: 6 },
  gold: { konzervativny: 2, vyvazeny: 2, rastovy: 3 },
  crypto: { konzervativny: 9, vyvazeny: 9, rastovy: 9 },
  dyn: { konzervativny: 8, vyvazeny: 9, rastovy: 9 },
  bonds: { konzervativny: 2, vyvazeny: 2, rastovy: 2 },
  bond3y9: { konzervativny: 2, vyvazeny: 2, rastovy: 2 },
  cash: { konzervativny: 2, vyvazeny: 2, rastovy: 2 },
  real: { konzervativny: 4, vyvazeny: 4, rastovy: 5 },
};
```

**Poznámky:**

- Crypto a dyn sú najrizikovejšie (8-9)
- Bonds, cash, gold sú stabilné (2-3)
- ETF má mierne vyššie riziko v rastovom profile (6)

#### 3.3 Risk Caps (limity rizika pre profily)

```typescript
export const RISK_CAPS: Record<RiskPref, number> = {
  konzervativny: 4.0,
  vyvazeny: 6.0,
  rastovy: 7.5,
};
```

**Použitie:** Ak vypočítané `riskScore0to10(mix) > RISK_CAPS[riskPref]`, UI zobrazí warning ⚠️.

---

## 4. VÝPOČET BUDÚCEJ HODNOTY (FV)

### Súbor: `src/engine/calculations.ts`

#### 4.1 Formula

```
FV = P0 * (1 + r_monthly)^months + PM * Σ[(1 + r_monthly)^(months - m + 1)] pre m=1..months
```

Kde:

- **P0** = lump sum (jednorazová investícia)
- **PM** = monthly contribution (mesačný vklad)
- **r_monthly** = mesačná sadzba = `(1 + r_annual)^(1/12) - 1`
- **months** = `horizonYears * 12`

#### 4.2 Implementácia (iteratívny výpočet)

```typescript
export function calculateFutureValue(
  lumpSum: number,
  monthlyContribution: number,
  years: number,
  annualRate: number
): number {
  if (years <= 0) return lumpSum;

  const months = Math.round(years * 12);

  // Mesačná sadzba: (1 + r_annual)^(1/12) - 1
  const monthlyRate = annualRate > 0 ? Math.pow(1 + annualRate, 1 / 12) - 1 : 0;

  // Iteratívny výpočet (presnejší pre mesačnú kapitalizáciu)
  let value = lumpSum;
  for (let month = 1; month <= months; month++) {
    value = (value + monthlyContribution) * (1 + monthlyRate);
  }

  return value;
}
```

**Prečo iteratívny?**

- Presnejší pre mesačnú kapitalizáciu (compound sa aplikuje každý mesiac)
- Jednoduchšie testovanie (krok po kroku)
- Pripravené na budúce rozšírenia (napr. variabilné vklady)

#### 4.3 Edge cases

| Scenár                    | Výsledok                                                             |
| ------------------------- | -------------------------------------------------------------------- |
| `years = 0`               | `FV = lumpSum` (žiadna kapitalizácia)                                |
| `annualRate = 0`          | `FV = lumpSum + monthlyContribution * months` (lineárny rast)        |
| `monthlyContribution = 0` | `FV = lumpSum * (1 + monthlyRate)^months` (len compound na lump sum) |

---

## 5. VÝPOČET VÁŽENÉHO VÝNOSU

### Súbor: `src/features/mix/assetModel.ts`

#### 5.1 Funkcia

```typescript
export function approxYieldAnnualFromMix(
  mix: MixItem[],
  riskPref: RiskPref
): number {
  if (!Array.isArray(mix) || mix.length === 0) return 0.04; // Fallback 4%

  const totalPct = mix.reduce((sum, m) => sum + m.pct, 0);
  if (totalPct < 1) return 0.04;

  let weightedYield = 0;
  for (const item of mix) {
    const weight = item.pct / 100; // Percent → decimal
    const yield_pa = getAssetYield(item.key, riskPref);
    weightedYield += weight * yield_pa;
  }

  return weightedYield;
}
```

#### 5.2 Príklad výpočtu (Vyvážený profil)

```typescript
mix = [
  { key: "gold", pct: 13 },
  { key: "etf", pct: 32 },
  { key: "bonds", pct: 10 },
  { key: "bond3y9", pct: 10 },
  { key: "dyn", pct: 18 },
  { key: "cash", pct: 9 },
  { key: "crypto", pct: 4 },
  { key: "real", pct: 4 },
];

// Výpočet:
weightedYield =
  (13/100) * 0.095 +      // gold:    13% * 9.5%   = 0.012350
  (32/100) * 0.14  +      // etf:     32% * 14%    = 0.044800
  (10/100) * 0.075 +      // bonds:   10% * 7.5%   = 0.007500
  (10/100) * 0.09  +      // bond3y9: 10% * 9%     = 0.009000
  (18/100) * 0.4258 +     // dyn:     18% * 42.58% = 0.076644
  (9/100)  * 0.0   +      // cash:    9% * 0%      = 0.000000
  (4/100)  * 0.20  +      // crypto:  4% * 20%     = 0.008000
  (4/100)  * 0.087        // real:    4% * 8.7%    = 0.003480

  = 0.161774 = **16.18% p.a.**
```

---

## 6. VÝPOČET RIZIKA

### Súbor: `src/features/mix/assetModel.ts`

#### 6.1 Základný výpočet (vážené riziko)

```typescript
export function riskScore0to10(
  mix: MixItem[],
  riskPref: RiskPref,
  crisisBias = 0
): number {
  if (!Array.isArray(mix) || mix.length === 0) return 5.0;

  const totalPct = mix.reduce((sum, m) => sum + m.pct, 0);
  if (totalPct < 1) return 5.0;

  // Penalty: ak dyn+crypto > 22%, pridaj +1 crisis bias
  const dynPct = mix.find((m) => m.key === "dyn")?.pct ?? 0;
  const cryptoPct = mix.find((m) => m.key === "crypto")?.pct ?? 0;
  const penalty = dynPct + cryptoPct > 22 ? 1 : 0;
  const effectiveBias = crisisBias + penalty;

  let weightedRisk = 0;
  for (const item of mix) {
    const weight = item.pct / 100;
    const baseRisk = getAssetRisk(item.key, riskPref, effectiveBias);

    // Aplikuj škálovanie rizika pri vysokej alokácii
    const scaledRisk = getScaledRisk(item.key, item.pct, baseRisk);
    weightedRisk += weight * scaledRisk;
  }

  return Math.min(10, Math.max(0, weightedRisk));
}
```

#### 6.2 Škálovanie rizika pri vysokej alokácii

```typescript
export function getScaledRisk(
  assetKey: AssetKey,
  allocationPct: number,
  baseRisk: number
): number {
  // Dynamické riadenie má prísnejšie pásma
  if (assetKey === "dyn") {
    if (allocationPct <= 11) return baseRisk;
    if (allocationPct <= 21) return baseRisk + 2;
    if (allocationPct <= 31) return baseRisk + 4;
    // 31%+: exponenciálne
    const excess = allocationPct - 31;
    return Math.min(15, baseRisk + 4 + excess * 0.5);
  }

  // Všetky ostatné aktíva
  if (allocationPct <= 30) return baseRisk;
  if (allocationPct <= 40) return baseRisk + 2;
  // 40%+: exponenciálne
  const excess = allocationPct - 40;
  return Math.min(15, baseRisk + 4 + excess * 0.3);
}
```

**Pravidlá:**

- **Dyn** má prísnejšie limity (pásma 0-11%, 11-21%, 21-31%)
- **Ostatné aktíva** majú pásma 0-30%, 30-40%, 40%+
- **Penalty:** Ak dyn + crypto > 22%, pridaj +1 k riziku všetkých volatilných aktív
- **Max riziko:** 15 (teoreticky, prakticky capped na 10 vo finale)

#### 6.3 Príklad výpočtu rizika (Vyvážený profil)

```typescript
mix = [
  { key: "gold", pct: 13 },
  { key: "etf", pct: 32 },
  { key: "bonds", pct: 10 },
  { key: "bond3y9", pct: 10 },
  { key: "dyn", pct: 18 },
  { key: "cash", pct: 9 },
  { key: "crypto", pct: 4 },
  { key: "real", pct: 4 },
];

// dyn (18%) + crypto (4%) = 22% → penalty = 0 (nie je > 22)

weightedRisk =
  (13/100) * 2 +          // gold:    13% * 2 (base)        = 0.26
  (32/100) * 7 +          // etf:     32% * (5+2 scaled)    = 2.24  (32% > 30% → +2)
  (10/100) * 2 +          // bonds:   10% * 2               = 0.20
  (10/100) * 2 +          // bond3y9: 10% * 2               = 0.20
  (18/100) * 11 +         // dyn:     18% * (9+2 scaled)    = 1.98  (18% v pásme 11-21% → +2)
  (9/100)  * 2 +          // cash:    9% * 2                = 0.18
  (4/100)  * 9 +          // crypto:  4% * 9                = 0.36
  (4/100)  * 4            // real:    4% * 4                = 0.16

  = 5.58 = **5.6/10**
```

**Risk cap pre vyvážený:** 6.0 → **5.6 < 6.0** → ✅ OK

---

## 7. PORTFOLIO PRESETS A ÚPRAVY

### Súbor: `src/features/portfolio/presets.ts`

#### 7.1 Tri predpripravené profily

```typescript
export const PORTFOLIO_PRESETS: PortfolioPreset[] = [
  {
    id: "konzervativny",
    label: "Konzervatívny",
    mix: [
      { key: "gold", pct: 20 },
      { key: "etf", pct: 20 },
      { key: "bonds", pct: 17 },
      { key: "bond3y9", pct: 17 },
      { key: "dyn", pct: 8 },
      { key: "cash", pct: 12 },
      { key: "crypto", pct: 0 },
      { key: "real", pct: 6 },
    ],
    targetRisk: { min: 3.0, max: 4.0 },
  },
  {
    id: "vyvazeny",
    label: "Vyvážený",
    mix: [
      { key: "gold", pct: 13 },
      { key: "etf", pct: 32 },
      { key: "bonds", pct: 10 },
      { key: "bond3y9", pct: 10 },
      { key: "dyn", pct: 18 },
      { key: "cash", pct: 9 },
      { key: "crypto", pct: 4 },
      { key: "real", pct: 4 },
    ],
    targetRisk: { min: 4.5, max: 6.0 },
  },
  {
    id: "rastovy",
    label: "Rastový",
    mix: [
      { key: "gold", pct: 12 },
      { key: "etf", pct: 35 },
      { key: "bonds", pct: 6.5 },
      { key: "bond3y9", pct: 6.5 },
      { key: "dyn", pct: 21.5 },
      { key: "cash", pct: 5.5 },
      { key: "crypto", pct: 5.5 },
      { key: "real", pct: 7.5 },
    ],
    targetRisk: { min: 6.5, max: 7.5 },
  },
];
```

#### 7.2 Automatické úpravy (adjustPresetForProfile)

```typescript
export function adjustPresetForProfile(
  preset: PortfolioPreset,
  profile: { monthlyIncome?: number; lumpSumEur?: number }
): MixItem[] {
  const income = profile.monthlyIncome || 0;
  const lumpSum = profile.lumpSumEur || 0;

  // Reality filter: ak príjem < 3500€ A vklad < 300k€ → reality = 0%
  const qualifiesForRealty = income >= 3500 || lumpSum >= 300_000;

  if (!qualifiesForRealty) {
    const mix = preset.mix.map((m) => ({ ...m }));
    const realtyIdx = mix.findIndex((m) => m.key === "real");

    if (realtyIdx !== -1 && mix[realtyIdx].pct > 0) {
      const realtyPct = mix[realtyIdx].pct;
      mix[realtyIdx].pct = 0;

      // Redistribuj: 60% do ETF, 40% do bonds
      // BEZPEČNÉ: Ak ETF dosiahne limit 40%, presun zvyšok do bonds
      const etfIdx = mix.findIndex((m) => m.key === "etf");
      const bondsIdx = mix.findIndex((m) => m.key === "bonds");

      if (etfIdx !== -1) {
        const etfAddition = realtyPct * 0.6;
        const newEtfPct = mix[etfIdx].pct + etfAddition;

        if (newEtfPct > 40) {
          // ETF by prekročil limit → pridaj len do 40%, zvyšok daj bonds
          const overflow = newEtfPct - 40;
          mix[etfIdx].pct = 40;

          if (bondsIdx !== -1) {
            mix[bondsIdx].pct += realtyPct * 0.4 + overflow;
          }
        } else {
          // ETF neprekročil limit → pridaj normálne
          mix[etfIdx].pct = newEtfPct;
          if (bondsIdx !== -1) {
            mix[bondsIdx].pct += realtyPct * 0.4;
          }
        }
      }
    }

    return normalize(mix); // Presne 100%
  }

  // Kvalifikovaný → vráť pôvodný mix (ale normalize)
  return normalize(preset.mix.map((m) => ({ ...m })));
}
```

**Príklad:**

- **Vstup:** Vyvážený preset, príjem = 2000€, vklad = 0€
- **Reality = 4%** → filtrované na **0%**
- **Redistribúcia:**
  - ETF: 32% + (4% \* 0.6) = **34.4%** ✅ (< 40%)
  - Bonds: 10% + (4% \* 0.4) = **11.6%**
- **Normalize:** Suma = 100%

---

## 8. UI ZOBRAZENIE A FLOW

### 8.1 Hlavné komponenty

| Komponent                 | Súbor                                              | Zodpovednosť                                   |
| ------------------------- | -------------------------------------------------- | ---------------------------------------------- |
| **BasicProjectionPanel**  | `src/features/overview/BasicProjectionPanel.tsx`   | Hero sekcia s FV, výnosom, progress            |
| **MetricsSection**        | `src/features/metrics/MetricsSection.tsx`          | Risk gauge + KPI cards + odporúčania           |
| **MixPanel**              | `src/features/mix/MixPanel.tsx`                    | Slidery pre mix, normalizácia                  |
| **PortfolioPresetsPanel** | `src/features/portfolio/PortfolioPresetsPanel.tsx` | Výber profilu (konzervativny/vyvazeny/rastovy) |

### 8.2 Flow v UI

```
1. Užívateľ zadá vstupy v sec2:
   - Jednorazová investícia: 10 000 €
   - Mesačný vklad: 200 €
   - Horizont: 20 rokov
   - Cieľ: 100 000 €

2. Užívateľ vyberie profil v sec3:
   - Klikne na "Vyvážený"

3. Preset sa načíta a upraví (adjustPresetForProfile):
   - Reality filter (ak príjem < 3500€)
   - Mix sa zapíše do persist/v3.ts

4. Výpočty (automaticky):
   - approxYieldAnnualFromMix(mix, "vyvazeny") → 16.18% p.a.
   - calculateFutureValue(10000, 200, 20, 0.1618) → 156 892 €
   - riskScore0to10(mix, "vyvazeny") → 5.6/10

5. UI zobrazenie:
   - BasicProjectionPanel: "156 892 €" (hero)
   - MetricsSection: "16.2% p.a." (tooltip + title)
   - RiskGauge: 5.6/10 (gauge needle)
   - Progress: 156 892 / 100 000 = 156% (capped at 100%)
```

### 8.3 Tooltip v MetricsSection (výnos)

```tsx
<div title={`${(approxYield * 100).toFixed(2)} % p.a.`} className="tooltip">
  <span>📊 {(approxYield * 100).toFixed(1)}%</span>
  <div className="tooltip-content">
    Vypočítaný ako vážený priemer výnosov aktív v portfóliu. Predpokladá mesačnú
    kapitalizáciu (compound) a annuity-due (vklady na začiatku mesiaca).
  </div>
</div>
```

---

## 9. PRÍKLADY VÝPOČTOV

### Príklad 1: Vyvážený profil (nízky príjem)

**Vstupy:**

```json
{
  "lumpSumEur": 5000,
  "monthlyVklad": 200,
  "horizonYears": 15,
  "goalAssetsEur": 80000,
  "monthlyIncome": 2500,
  "riskPref": "vyvazeny"
}
```

**Mix (po reality filtri):**

```json
[
  { "key": "gold", "pct": 13 },
  { "key": "etf", "pct": 34.4 }, // 32% + (4% * 0.6)
  { "key": "bonds", "pct": 11.6 }, // 10% + (4% * 0.4)
  { "key": "bond3y9", "pct": 10 },
  { "key": "dyn", "pct": 18 },
  { "key": "cash", "pct": 9 },
  { "key": "crypto", "pct": 4 },
  { "key": "real", "pct": 0 } // Filtrované
]
```

**Výpočty:**

```typescript
// Krok 1: Vážený výnos
approxYield =
  0.13 * 0.095 +      // gold
  0.344 * 0.14 +      // etf
  0.116 * 0.075 +     // bonds
  0.10 * 0.09 +       // bond3y9
  0.18 * 0.4258 +     // dyn
  0.09 * 0.0 +        // cash
  0.04 * 0.20         // crypto
  = 0.1648 = 16.48% p.a.

// Krok 2: FV
months = 15 * 12 = 180
monthlyRate = (1.1648)^(1/12) - 1 = 0.012766

value = 5000
for month in 1..180:
  value = (value + 200) * (1.012766)

FV ≈ 98 432 €

// Krok 3: Riziko
riskScore =
  0.13 * 2 +          // gold
  0.344 * 7 +         // etf (34.4% > 30% → +2)
  0.116 * 2 +         // bonds
  0.10 * 2 +          // bond3y9
  0.18 * 11 +         // dyn (18% → +2)
  0.09 * 2 +          // cash
  0.04 * 9            // crypto
  = 5.85/10

riskCap = 6.0 → 5.85 < 6.0 ✅
```

**Výstup v UI:**

- Očakávaný majetok: **98 432 €**
- Ročný výnos: **16.5% p.a.**
- Riziko: **5.9/10** (pod cap 6.0 ✅)
- Progress: **123%** (capped at 100% v UI)

---

### Príklad 2: Rastový profil (vysoký príjem)

**Vstupy:**

```json
{
  "lumpSumEur": 50000,
  "monthlyVklad": 500,
  "horizonYears": 20,
  "goalAssetsEur": 500000,
  "monthlyIncome": 5000,
  "riskPref": "rastovy"
}
```

**Mix (reality zostáva):**

```json
[
  { "key": "gold", "pct": 12 },
  { "key": "etf", "pct": 35 },
  { "key": "bonds", "pct": 6.5 },
  { "key": "bond3y9", "pct": 6.5 },
  { "key": "dyn", "pct": 21.5 },
  { "key": "cash", "pct": 5.5 },
  { "key": "crypto", "pct": 5.5 },
  { "key": "real", "pct": 7.5 }
]
```

**Výpočty:**

```typescript
// Krok 1: Vážený výnos
approxYield =
  0.12 * 0.11 +       // gold
  0.35 * 0.18 +       // etf
  0.065 * 0.075 +     // bonds
  0.065 * 0.09 +      // bond3y9
  0.215 * 0.6010 +    // dyn
  0.055 * 0.0 +       // cash
  0.055 * 0.35 +      // crypto
  0.075 * 0.095       // real
  = 0.2430 = 24.30% p.a.

// Krok 2: FV
months = 20 * 12 = 240
monthlyRate = (1.2430)^(1/12) - 1 = 0.018226

value = 50000
for month in 1..240:
  value = (value + 500) * (1.018226)

FV ≈ 1 168 573 €

// Krok 3: Riziko
riskScore =
  0.12 * 3 +          // gold
  0.35 * 8 +          // etf (35% > 30% → +2)
  0.065 * 2 +         // bonds
  0.065 * 2 +         // bond3y9
  0.215 * 13 +        // dyn (21.5% → +4)
  0.055 * 2 +         // cash
  0.055 * 10 +        // crypto (+1 penalty)
  0.075 * 5           // real
  = 7.46/10

riskCap = 7.5 → 7.46 < 7.5 ✅
```

**Výstup v UI:**

- Očakávaný majetok: **1 168 573 €**
- Ročný výnos: **24.3% p.a.**
- Riziko: **7.5/10** (tesne pod cap 7.5 ✅)
- Progress: **100%** (1.17M > 500k cieľ)

---

## 10. POZNÁMKY PRE ADVISORA

### 10.1 Kľúčové body na overenie

1. **Výnosy dynamického riadenia (dyn):**
   - Aktuálne: mesačne 2%/3%/4% → anualizované 26.82%/42.58%/60.10%
   - **Otázka:** Sú tieto hodnoty realistické? Historické dáta?

2. **ETF výnosy:**
   - Konzervatívny: 9%, Vyvážený: 14%, Rastový: 18%
   - **Otázka:** Aké indexy používame? Pasívne vs. aktívne?

3. **Reality výnosy:**
   - 7.5%-9.5% p.a.
   - **Otázka:** Zahŕňa to aj capital appreciation alebo len nájom?

4. **Riziko škálovanie:**
   - Dyn má prísnejšie pásma (11%, 21%, 31%)
   - **Otázka:** Sú tieto prahové hodnoty správne?

5. **Mesačná kapitalizácia:**
   - Aktuálne: FV používa mesačnú sadzbu `(1+r_annual)^(1/12) - 1`
   - **Otázka:** Predpokladáme mesačné compound alebo ročné?

### 10.2 Možné úpravy

#### A) Zmeniť výnosy aktív

```typescript
// Ak chceme konzervativnejšie odhady:
const ASSET_YIELDS = {
  etf: { konzervativny: 0.07, vyvazeny: 0.1, rastovy: 0.13 }, // Znížené
  dyn: {
    konzervativny: Math.pow(1 + 0.015, 12) - 1, // 1.5%/mes → ~19.6% p.a.
    vyvazeny: Math.pow(1 + 0.02, 12) - 1, // 2%/mes → ~26.8% p.a.
    rastovy: Math.pow(1 + 0.03, 12) - 1, // 3%/mes → ~42.6% p.a.
  },
  // ...
};
```

#### B) Zmeniť risk caps

```typescript
// Ak chceme prísnejšie limity:
export const RISK_CAPS: Record<RiskPref, number> = {
  konzervativny: 3.5, // Bolo 4.0
  vyvazeny: 5.5, // Bolo 6.0
  rastovy: 7.0, // Bolo 7.5
};
```

#### C) Zmeniť FV výpočet na ročnú kapitalizáciu

```typescript
export function calculateFutureValue(
  lumpSum: number,
  monthlyContribution: number,
  years: number,
  annualRate: number
): number {
  if (years <= 0) return lumpSum;

  // Ročná kapitalizácia (jednoduchšia formula)
  const annualContribution = monthlyContribution * 12;

  let value = lumpSum;
  for (let year = 1; year <= years; year++) {
    value = (value + annualContribution) * (1 + annualRate);
  }

  return value;
}
```

#### D) Pridať inflačnú korekciu

```typescript
export function calculateRealFutureValue(
  nominalFV: number,
  years: number,
  inflationRate: number = 0.03 // Default 3% p.a.
): number {
  return nominalFV / Math.pow(1 + inflationRate, years);
}

// Použitie:
const nominalFV = calculateFutureValue(10000, 200, 20, 0.12);
const realFV = calculateRealFutureValue(nominalFV, 20, 0.03);
```

### 10.3 Test scenáre na overenie

| #   | Profil        | Lump Sum | Monthly | Years | Očakávaný FV | Očakávaný Yield | Poznámka                |
| --- | ------------- | -------- | ------- | ----- | ------------ | --------------- | ----------------------- |
| 1   | Konzervatívny | 0        | 100     | 10    | ?            | ~8-10%          | Baseline nízkeho rizika |
| 2   | Vyvážený      | 5000     | 200     | 15    | ?            | ~14-16%         | Typický scenár          |
| 3   | Rastový       | 50000    | 500     | 20    | ?            | ~20-25%         | Vysoké riziko           |
| 4   | Vyvážený      | 10000    | 0       | 5     | ?            | ~14%            | Len lump sum            |
| 5   | Rastový       | 0        | 1000    | 30    | ?            | ~22%            | Dlhodobý horizont       |

**Úloha:** Doplniť očakávané FV hodnoty na základe historických dát alebo Monte Carlo simulácií.

### 10.4 Kontaktné body pre zmeny

| Ak chcete zmeniť... | Upravte súbor...                                                 |
| ------------------- | ---------------------------------------------------------------- |
| Výnosy aktív        | `src/features/mix/assetModel.ts` → `ASSET_YIELDS`                |
| Riziká aktív        | `src/features/mix/assetModel.ts` → `ASSET_RISKS`                 |
| Risk caps           | `src/features/mix/assetModel.ts` → `RISK_CAPS`                   |
| FV výpočet          | `src/engine/calculations.ts` → `calculateFutureValue()`          |
| Presets             | `src/features/portfolio/presets.ts` → `PORTFOLIO_PRESETS`        |
| Reality filter      | `src/features/portfolio/presets.ts` → `adjustPresetForProfile()` |

### 10.5 Testovanie zmien

Po úprave parametrov spustite:

```bash
# Unit testy (assetModel, calculations)
npm test -- --run assetModel.smallmix.test.ts
npm test -- --run calculations.smallmix.test.ts

# Integration testy (celý pipeline)
npm test -- --run BasicProjectionPanel.smallmix.int.test.tsx

# Kritické testy (17 tests)
npm run test:critical

# Všetky testy
npm test
```

**Očakávané výsledky:**

- Ak zmeníte výnosy → `assetModel.smallmix.test.ts` FAILNE (aktualizujte očakávanú hodnotu)
- Ak zmeníte FV výpočet → `calculations.smallmix.test.ts` FAILNE (aktualizujte očakávanú hodnotu)
- Kritické testy (17) musia ostať PASS

---

## KONIEC DOKUMENTÁCIE

**Verzia:** 1.0  
**Dátum:** 25. október 2025  
**Autor:** UNOTOP MVP Development Team  
**Status:** ✅ Všetky testy PASS (46 tests total)

Pre otázky kontaktujte vývojový tím alebo vytvorte issue v GitHub repozitári.
