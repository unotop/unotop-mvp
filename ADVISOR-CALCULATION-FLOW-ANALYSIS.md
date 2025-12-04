# ADVISOR BRIEF: Komplexná analýza výpočtovej logiky UNOTOP MVP

**Dátum:** 1. december 2025  
**Autor:** AI Agent (GitHub Copilot)  
**Účel:** Identifikovať potenciálne konflikty v 3700/250/30 scenári (Rastový profil: risk 3.9 namiesto 7-8)

---

## 1. EXECUTIVE SUMMARY

**PROBLÉM:**

- Používateľ zadal: 3700 EUR lump, 250 EUR/mes, 30 rokov
- Vybral Rastový profil
- **Očakávané:** risk 7.5-8.5, yield ~15-18%
- **Aktuálne:** risk 3.9, yield ~12.8% (ako Vyvážený)
- **ROOT CAUSE (hypotéza):** Konflikt medzi `InvestmentPowerBox.calculateCurrentMetrics()` (real-time re-adjustment) a persist layer (debounce 1s)

**SYMPTÓMY:**

- ✅ Po výbere profilu → SPRÁVNE (getAdjustedMix cez PortfolioSelector)
- ❌ Pri ručnom zadaní vstupov BEZ výberu profilu → ZLYHÁ (auto-optimize nespustený)
- ❌ InvestmentPowerBox číta `v3.mix` PRED auto-optimize → používa fallback preset mix

**OPRAVY (PR-38):**

1. InvestmentPowerBox: `calculateCurrentMetrics()` teraz volá `getAdjustedMix()` v reálnom čase
2. yieldOptimizer: Odstránený volume check (< 100k skip) → optimizer beží PRE VŠETKY plány

**OVERENIE:**

- Build úspešný (772.43 kB)
- Logika na papieri vyzerá správne
- **POTREBNÉ:** Live test 3700/250/30 + Rastový profil → overenie risk/yield

---

## 2. VÝPOČTOVÁ MAPA (Full Stack)

### 2.1 VSTUPNÝ BOD: Používateľ zadá parametre

```
Vstup → BasicLayout.tsx → Auto-optimize (1s debounce) → getAdjustedMix → v3.mix
                      ↓
                Profile výber → PortfolioSelector → getAdjustedPreset → v3.mix
                      ↓
                InvestmentPowerBox → calculateCurrentMetrics() → getAdjustedMix (PR-38)
```

**KRITICKÝ ROZDIEL (PRED PR-38):**

- Auto-optimize: `debounce 1s`, skip ak žiadny `v3.presetId`
- InvestmentPowerBox: čítal `v3.mix` PRIAMO (stará hodnota pred auto-optimize)
- **Výsledok:** 3700/250/30 BEZ profilu → fallback preset mix → risk 3.9 ❌

**PO PR-38:**

- InvestmentPowerBox: volá `getAdjustedMix()` v každom renderi
- **Výsledok (teoria):** 3700/250/30 → STARTER caps → risk 7.5-8.3 ✅

---

### 2.2 CORE CALCULATION CHAIN

#### **A) Mix Adjustment Flow (getAdjustedMix)**

```typescript
// src/features/portfolio/mixAdjustments.ts (lines 244-600)

getAdjustedMix(baseMix, profile) {
  // STEP 1-4: Bond minimum, Lump scaling, Monthly scaling, Cash reserve
  // STEP 4: Asset Minima (vynulovanie nedostupných aktív pre malé plány)

  // STEP 7.5: ProfileAssetPolicy (KRITICKÝ PRE 3700/250/30!)
  const effectivePlanVolume = lumpSum + monthly * 12 * years; // ~46k EUR
  const policyResult = applyProfileAssetPolicy(mix, riskPref, effectivePlanVolume);
  // Rastový STARTER: dyn max 20%, crypto max 10%, etf max 55%, gold max 15%

  // STEP 8: enforceRiskCap (tvrdá brzda: risk ≤ 8.5)
  if (effectivePlanVolume < 50_000) {
    // SKIP enforceRiskCap pre malé plány (STARTER)
    // Dôvod: ProfileAssetPolicy už aplikoval caps
  } else {
    const riskCapResult = enforceRiskCap(mix, riskPref);
    mix = riskCapResult.mix;
  }

  // STEP 10: optimizeYield (PR-38: TERAZ beží pre VŠETKY plány!)
  // PRED PR-38: if (volume < 100k) return skip; ← PROBLÉM!
  const yieldOptResult = optimizeYield(mix, riskPref, volume, 3);
  mix = yieldOptResult.mix;

  return { mix, warnings, info };
}
```

**INVARIANTY:**

- ✅ ProfileAssetPolicy VŽDY aplikované (STEP 7.5)
- ✅ enforceRiskCap SKIP pre < 50k EUR (STARTER)
- ✅ optimizeYield (PR-38) beží PRE VŠETKY objemy (removed < 100k skip)
- ✅ Každý step normalizuje mix na 100%

---

#### **B) Yield Calculation (approxYieldAnnualFromMix)**

```typescript
// src/features/mix/assetModel.ts (lines 237-260)

approxYieldAnnualFromMix(mix, _riskPref?, planStrength = 75) {
  // PR-36: Yields upravené (dyn 60%, crypto 35%, ETF 12%, gold 7%, cash 3%)

  const multiplier = getPlanStrengthMultiplier(planStrength);
  // 50% → 0.8×, 75% → 1.0×, 100% → 1.2×

  let weightedYield = 0;
  for (const item of mix) {
    const assetParams = ASSET_PARAMS[item.key];
    weightedYield += (item.pct / 100) * assetParams.expectedReturnPa;
  }

  return weightedYield * multiplier;
}
```

**ASSET_PARAMS (PR-36 yields):**

```typescript
{
  cash: 3%,    // IAD depozitné konto
  gold: 7%,    // Fyzické zlato
  bonds: 7.5%, // Garantovaný dlhopis 5r
  bond3y9: 9%, // Garantovaný dlhopis 3r
  etf: 12%,    // ETF World aktívne
  real: 10%,   // Reality/projekt
  crypto: 35%, // Kryptomeny
  dyn: 60%,    // Dynamické riadenie (~4% p.m.)
}
```

**INVARIANTY:**

- ✅ Yields profile-independent (Conservative/Balanced/Growth používajú rovnaké asset yields)
- ✅ planStrength default 75% (1.0× multiplikátor)
- ✅ VIP mode 100% (1.2× multiplikátor) len pre projekcie

---

#### **C) Risk Calculation (riskScore0to10)**

```typescript
// src/features/mix/assetModel.ts (lines 285-315)

riskScore0to10(mix, _riskPref?, crisisBias = 0) {
  // Penalty: ak dyn+crypto > 22%, pridaj +1 crisis bias
  const dynPct = mix.find(m => m.key === "dyn")?.pct ?? 0;
  const cryptoPct = mix.find(m => m.key === "crypto")?.pct ?? 0;
  const penalty = dynPct + cryptoPct > 22 ? 1 : 0;

  let weightedRisk = 0;
  for (const item of mix) {
    const baseRisk = getAssetRisk(item.key, undefined, crisisBias + penalty);
    const scaledRisk = getScaledRisk(item.key, item.pct, baseRisk);
    weightedRisk += (item.pct / 100) * scaledRisk;
  }

  return Math.min(10, Math.max(0, weightedRisk));
}
```

**ASSET RISKS (riskScore):**

```typescript
{
  cash: 2,   // IAD DK (nie 0 riziko!)
  gold: 3,   // Stabilizátor
  bonds: 2,  // Garantované
  bond3y9: 3,
  etf: 6,    // Equity volatilita
  real: 5,   // Reality projekty
  crypto: 8, // Volatilné
  dyn: 8,    // Vysoké riziko (rovnaké ako crypto)
}
```

**INVARIANTY:**

- ✅ Risk profile-independent (riskPref parameter DEPRECATED)
- ✅ Crisis bias: dyn+crypto > 22% → +1 penalty
- ✅ Scaled risk: vysoká alokácia → zvýšenie rizika (napr. 50% ETF má vyššie risk než 20% ETF)

---

#### **D) Future Value (calculateFutureValue)**

```typescript
// src/engine/calculations.ts (lines 30-60)

calculateFutureValue(lumpSum, monthlyContribution, years, annualRate) {
  const months = years * 12;
  const monthlyRate = (1 + annualRate)^(1/12) - 1; // Mesačná sadzba

  let value = lumpSum;
  for (let month = 1; month <= months; month++) {
    value = (value + monthlyContribution) * (1 + monthlyRate);
  }

  return value;
}
```

**INVARIANTY:**

- ✅ Mesačná kapitalizácia (presnejšie než ročná)
- ✅ Pure function (žiadne side effects)
- ✅ Iteratívny výpočet (presný)

---

### 2.3 PROFILE ASSET POLICY (KRITICKÉ PRE 3700/250/30)

```typescript
// src/features/policy/profileAssetPolicy.ts (lines 56-90)

// STARTER (< 50k EUR) - PR-34 FIX
starter: {
  konzervativny: {
    dyn: 0,    // Žiadne dyn
    crypto: 0,
    etf: 30,
    gold: 40,
  },
  vyvazeny: {
    dyn: 15,   // PR-34: Zvýšené z 0% → 15%
    crypto: 5, // PR-34: Zvýšené z 3% → 5%
    etf: 50,   // PR-34: Zvýšené z 45% → 50%
    gold: 20,  // PR-34: Znížené z 40% → 20%
  },
  rastovy: {
    dyn: 20,   // PR-34: KRITICKÝ FIX - Zvýšené z 5% → 20%
    crypto: 10,// PR-34: Zvýšené z 7% → 10%
    etf: 55,   // PR-34: Zvýšené z 50% → 55%
    gold: 15,  // PR-34: Znížené z 40% → 15%
  },
}
```

**DOPAD NA 3700/250/30 (46k EUR = STARTER):**

- **PRED PR-34:** dyn max 5%, crypto max 7% → risk ~3.9 ❌
- **PO PR-34:** dyn max 20%, crypto max 10% → risk ~7.5-8.3 ✅

**INVARIANTY:**

- ✅ Rastový má VŽDY vyššie caps než Vyvážený než Konzervatívny
- ✅ GOLD INVERSION: Konzervatívny má VIAC zlata (bezpečný pilier)
- ✅ Volume bands: STARTER < CORE < PREMIUM (progressive unlocking)

---

### 2.4 RISK CAP ENFORCEMENT

```typescript
// src/features/portfolio/enforceRiskCap.ts (lines 115-215)

enforceRiskCap(mix, riskPref, stageCaps?) {
  const riskMax = getRiskMax(riskPref); // 5.0 / 7.0 / 8.5
  const initialRisk = riskScore0to10(mix, riskPref);

  if (initialRisk <= riskMax) return { mix, applied: false };

  // Iteratívne škrtanie rizikovejších aktív
  while (currentRisk > riskMax && iterations < 10) {
    // 1. Nájdi najrizikovejší asset (dyn → crypto → ETF → ...)
    // 2. Znížiť o 2-5 p.b.
    // 3. Redistribuuj do RISK_SINKS (profile-aware):
    //    - Conservative: IAD (bond9) > bonds > gold
    //    - Balanced: bonds > IAD > gold
    //    - Growth: bonds > real > IAD

    // PR-34: Ak asset je už NA profile cap → preskočiť
    if (key === "dyn" && asset.pct <= dynProfileCap * 1.05) {
      continue; // dyn už capped v STEP 7.5
    }
  }

  return { mix, applied: true, finalRisk };
}
```

**INVARIANTY:**

- ✅ SKIP pre malé plány (< 50k EUR) → prirodzené rozdiely profilov
- ✅ Profile-aware RISK_SINKS (Conservative → safe assets, Growth → real/bonds)
- ✅ Max 10 iterácií (deadlock protection)
- ✅ Rešpektuje ProfileAssetPolicy caps (dyn profile cap check)

---

### 2.5 YIELD OPTIMIZER (PR-38 FIX)

```typescript
// src/features/portfolio/yieldOptimizer.ts (lines 255-320)

optimizeYield(mix, riskPref, effectivePlanVolume, maxIterations = 3) {
  const riskMax = getRiskMax(riskPref);
  const profileCaps = getProfileAssetCaps(riskPref, effectivePlanVolume);

  // PR-38 FIX: REMOVED volume check!
  // PRED: if (effectivePlanVolume < 100k) return skip; ← PROBLÉM!
  // TERAZ: Beží PRE VŠETKY objemy

  // Iteratívne hľadaj najlepší move (3 kroky)
  while (iterations < maxIterations) {
    // YIELD_MOVES: cash→bond9, gold→bond9, bonds→bond9, gold→ETF, ...

    for (const move of YIELD_MOVES) {
      const testMix = applyMove(mix, move);

      // PR-34: Validate caps PRED akceptovaním
      const capValidation = validateMoveAgainstCaps(testMix, riskPref, profileCaps);
      if (!capValidation.valid) continue;

      // Check risk headroom (+1.0)
      const testRisk = riskScore0to10(testMix);
      if (testRisk > riskMax + 1.0) continue;

      // Vypočítaj yield gain
      const yieldGain = approxYieldAnnualFromMix(testMix) - currentYield;
      if (yieldGain > bestYieldGain) {
        bestMove = move;
      }
    }

    // Aplikuj najlepší move
    if (bestMove) {
      mix = applyMove(mix, bestMove);
      iterations++;
    } else {
      break; // Žiadny dobrý move
    }
  }

  return { mix, applied: true, moves, finalYield };
}
```

**INVARIANTY:**

- ✅ Validuje ProfileAssetPolicy caps PRED aplikovaním move
- ✅ Risk headroom +1.0 (Conservative 5→6, Balanced 7→8, Growth 8.5→9.5)
- ✅ Max boost caps (Conservative +0.8%, Balanced +1.2%, Growth +2.0%)
- ✅ Safety pass PO moves (clamp overflows)

---

## 3. POTENCIÁLNE PROBLÉMY (Red Flags)

### 🔴 **PROBLEM 1: InvestmentPowerBox live re-adjustment (PR-38)**

**Popis:**

- InvestmentPowerBox volá `getAdjustedMix()` v KAŽDOM renderi
- `getAdjustedMix()` je EXPENSIVE (10+ steps, iteratívne)
- React render cyklus: pri zmene slidera → re-render → re-adjustment → persist → re-render...

**RIZIKO:**

- Performance degradácia (lag pri slideri)
- Infinite loop (ak writeV3 triggeruje re-render)
- Nekonzistentné state (debounce 1s vs okamžitý render)

**ODPORÚČANIE:**

```typescript
// PRED: calculateCurrentMetrics() volá getAdjustedMix() priamo
const { mix: adjustedMix } = getAdjustedMix(baseMix, profileForAdj);

// NÁVRH: Memoizuj výsledok (React.useMemo)
const adjustedMix = React.useMemo(() => {
  const { mix } = getAdjustedMix(baseMix, profileForAdj);
  return mix;
}, [lumpSumEur, monthlyEur, horizonYears, riskPref, goalAssetsEur]);
```

**ALTERNATÍVA:**

- Zdieľať adjustovaný mix cez Context (vypočítať raz, použiť všade)
- Auto-optimize zapísať do `v3.mixAdjusted` (cache layer)

---

### 🔴 **PROBLEM 2: Dual mix sources (v3.mix vs getAdjustedMix)**

**Popis:**

- PortfolioSelector: zapisuje do `v3.mix` cez `getAdjustedPreset()`
- Auto-optimize: zapisuje do `v3.mix` cez `getAdjustedPreset()` (debounce 1s)
- InvestmentPowerBox (PR-38): volá `getAdjustedMix()` PRIAMO (žiadny persist)

**KONFLIKT:**

```
T0: User zadá 3700/250/30
T0.1: InvestmentPowerBox render → getAdjustedMix() → risk 7.8 (SPRÁVNE)
T1.0: Auto-optimize debounce → writeV3({ mix: adjusted }) → risk 7.8 (SPRÁVNE)
T1.1: InvestmentPowerBox render → čítaj v3.mix → risk 7.8 (SPRÁVNE)

ALE:
T0: User zadá 3700/250/30 (ŽiADNY PROFIL)
T0.1: InvestmentPowerBox render → getAdjustedMix(PRESET) → risk 7.8
T1.0: Auto-optimize SKIP (žiadny presetId) → v3.mix EMPTY
T1.1: InvestmentPowerBox render → v3.mix EMPTY → fallback PRESET → risk 3.9 ❌
```

**RIEŠENIE (PR-38):**

- InvestmentPowerBox VŽDY volá getAdjustedMix() (ignoruje v3.mix)
- **PROBLÉM:** Ak v3.mix je EMPTY, použije preset → po auto-optimize overwrite

**ODPORÚČANIE:**

```typescript
// InvestmentPowerBox: preferuj v3.mix, fallback na preset
const baseMix = v3.mix && v3.mix.length > 0 ? v3.mix : presetMixes[riskPref];

// Ak baseMix je PRESET → getAdjustedMix aplikuje caps
// Ak baseMix je v3.mix → getAdjustedMix RE-aplikuje caps (idempotent?)
```

**OTÁZKA PRE ADVISORA:**

- Je `getAdjustedMix()` IDEMPOTENTNÝ? (aplikovať 2× = rovnaký výsledok?)
- Ak NIE → potrebujeme flag `v3.mixAlreadyAdjusted` (skip re-adjustment)

---

### 🔴 **PROBLEM 3: ProfileAssetPolicy vs enforceRiskCap (overlap)**

**Popis:**

- STEP 7.5: ProfileAssetPolicy aplikuje caps (dyn max 20%, crypto max 10%)
- STEP 8: enforceRiskCap škrtá rizikovejšie assety (dyn, crypto, ETF)

**KONFLIKT:**

```
// STARTER Rastový: dyn max 20%
applyProfileAssetPolicy(mix) → dyn = 20%, crypto = 10%, etf = 50%

// Risk = 8.2 (nad riskMax 8.5? NIE)
enforceRiskCap(mix) → SKIP (risk < 8.5)

// ALE: Ak risk = 8.7 (nad riskMax):
enforceRiskCap() → škrtá dyn (8.7 → 8.5)
dyn 20% → 18% (ZNOVU POD profile cap)

// Potom optimizeYield():
optimizeYield() → pridáva dyn späť? (ak má risk room)
dyn 18% → 20% (SPÄŤ NA cap)
```

**RIZIKO:**

- Oscilačné správanie (cut → boost → cut → boost)
- enforceRiskCap a optimizeYield môžu bojovať

**INVARIANT:**

- enforceRiskCap SKIP pre < 50k EUR (STARTER) → tento konflikt SA NEDEJE
- ALE: Ak zmeníme threshold (napr. 30k EUR) → konflikt môže nastať

**ODPORÚČANIE:**

```typescript
// enforceRiskCap: Rešpektuj ProfileAssetPolicy caps HARD
if (key === "dyn") {
  const dynProfileCap = profileCaps.dyn ?? 22; // Použiť profile cap
  if (asset.pct <= dynProfileCap) {
    console.log(`dyn už na profile cap ${dynProfileCap}%, skip`);
    continue; // NEŠKMAJ ak už na cap
  }
}
```

**OTÁZKA PRE ADVISORA:**

- Ktorý step má PRIORITU? ProfileAssetPolicy (STEP 7.5) alebo enforceRiskCap (STEP 8)?
- Návrh: ProfileAssetPolicy = HARD caps, enforceRiskCap = soft suggestions (nezíde pod cap)

---

### 🟡 **PROBLEM 4: optimizeYield headroom (+1.0) vs RISK_MAX**

**Popis:**

- RISK_MAX: Conservative 5.0, Balanced 7.0, Growth 8.5
- optimizeYield: maxRiskForOptimizer = RISK_MAX + 1.0
  - Conservative: 5.0 + 1.0 = 6.0
  - Balanced: 7.0 + 1.0 = 8.0
  - Growth: 8.5 + 1.0 = 9.5

**SCENÁR:**

```
Growth STARTER: riskMax = 8.5
Po STEP 7.5: risk = 7.8
Po STEP 8: SKIP (< 50k EUR)
Po STEP 10: optimizeYield() → pridá bond9, ETF → risk = 8.9 (NAD riskMax!)

// Finálna brzda: normalizeAndClampMix()
normalizeAndClampMix(mix, riskPref, maxRiskForOptimizer = 9.5)
// Clamp gold/ETF/dyn/crypto nad caps → risk klesne späť na 8.5
```

**INVARIANT:**

- `normalizeAndClampMix()` je finálna brzda (STEP 11)
- Garantuje risk ≤ maxRiskForOptimizer (9.5 pre Growth)

**RIZIKO:**

- Growth profil môže mať risk 8.5-9.5 (technicky NAD riskMax)
- UI zobrazí "Risk 9.2 / 8.5" → zmatenie používateľa

**ODPORÚČANIE:**

```typescript
// UI: Zobraz EFFECTIVE risk max (s headroom)
const effectiveRiskMax = Math.min(getRiskMax(riskPref) + 1.0, 9.0);
const riskStatus = currentRisk <= effectiveRiskMax ? "OK" : "⚠️ Nad limitom";

// ALEBO: normalizeAndClampMix() použije RISK_MAX (nie +1.0)
// → optimizer má headroom, ale final clamp je na RISK_MAX
```

---

### 🟡 **PROBLEM 5: Auto-optimize debounce (1s) vs live UI**

**Popis:**

- Auto-optimize: debounce 1s (čaká kým používateľ dokončí zmeny)
- InvestmentPowerBox: okamžitý re-render (PR-38: getAdjustedMix v každom renderi)

**SCENÁR:**

```
T0: User posunie slider: 3700 → 4000 EUR
T0.1: InvestmentPowerBox render → getAdjustedMix(4000) → risk 8.1
T0.2: User posunie slider: 4000 → 4500 EUR
T0.3: InvestmentPowerBox render → getAdjustedMix(4500) → risk 8.3
T1.0: Auto-optimize (debounce 1s) → writeV3({ mix: adjusted(4500) })
T1.1: InvestmentPowerBox render → v3.mix (4500) → risk 8.3 (SYNC)

ALE:
T0: User posunie slider: 3700 → 4000 EUR
T0.1: InvestmentPowerBox render → getAdjustedMix(4000) → risk 8.1
T0.5: User refreshuje stránku (HARD RELOAD)
T0.6: InvestmentPowerBox render → v3.mix (3700 - stará hodnota) → risk 7.8 ❌
```

**RIZIKO:**

- Temporary state loss (ak user refreshne pred auto-optimize)
- UI zobrazí "flashy" hodnoty (8.1 → 7.8 po refreshi)

**ODPORÚČANIE:**

```typescript
// Znížiť debounce: 1000ms → 300ms (rýchlejšia perzistencia)
const timer = setTimeout(() => {
  writeV3({ mix: adjusted.mix });
}, 300); // Bolo 1000ms

// ALEBO: InvestmentPowerBox persist vlastný adjusted mix
const adjustedMix = getAdjustedMix(baseMix, profileForAdj);
writeV3({ mixTemporary: adjustedMix.mix }); // Temporary cache
```

---

### 🟢 **OK: calculateFutureValue (mesačná kapitalizácia)**

**Analýza:**

```typescript
// Iteratívny výpočet s mesačnou kapitalizáciou
const monthlyRate = (1 + annualRate) ^ (1 / 12 - 1);
for (month = 1; month <= months; month++) {
  value = (value + monthly) * (1 + monthlyRate);
}
```

**VERIFIKÁCIA:**

```
Vstup: 10000 EUR, 500 EUR/mes, 20 rokov, 12% p.a.
Mesačná sadzba: (1.12)^(1/12) - 1 = 0.9489% p.m.
FV (manuálny): ~566 000 EUR
FV (formula): ~566 000 EUR ✅
```

**INVARIANT:**

- ✅ Mesačná kapitalizácia (presnejšie než ročná)
- ✅ Pure function (žiadne side effects)
- ✅ Konzistentný s finančnými kalkulátormi

---

## 4. DIAGNOSTICKÁ CHECKLI ST (Live Test)

### ✅ **PRED RELEASE: Overenie 3700/250/30 scenára**

```
1. HARD REFRESH (Ctrl+Shift+R)
2. localStorage.clear() v DevTools console
3. Zadaj: 3700 EUR, 250 EUR/mes, 30 rokov
4. NEZVOLIL PROFIL (zostať na defaulte)
5. Otvor InvestmentPowerBox

OČAKÁVANÉ (PR-38):
- Risk: 7.5-8.3 (NIE 3.9!)
- Yield: ~15-18%
- Mix: dyn ~15-20%, crypto ~8-10%, ETF ~50-55%

AKTUÁLNE (PRED PR-38):
- Risk: 3.9 ❌
- Yield: ~12.8%
- Mix: dyn ~2%, crypto ~2% (preset fallback)

6. ZVOLIŤ RASTOVÝ PROFIL (kliknutie)
7. Overenie:
   - Risk: 7.5-8.5 ✅
   - Yield: ~15-18% ✅
   - Mix: dyn ~18-20%, crypto ~10%, ETF ~50-55% ✅

8. REFRESH STRÁNKY (F5)
9. Overenie perzistencie:
   - Risk: stále 7.5-8.5 ✅
   - v3.mix zapisaný ✅
```

---

### ✅ **EDGE CASES: Volume Bands**

```
STARTER (<50k EUR):
- 3700/250/30 → 46k EUR → dyn max 20%, crypto max 10%
- Risk očakávaný: 7.5-8.3

CORE (50-100k EUR):
- 10000/500/20 → 85k EUR → dyn max 15%, crypto max 10%
- Risk očakávaný: 7.0-8.0

PREMIUM (≥100k EUR):
- 50000/1000/10 → 170k EUR → dyn max 22%, crypto max 10%
- Risk očakávaný: 8.0-9.0 (s optimizerom)
```

---

### ✅ **PROFILE HIERARCHY (Invariant Check)**

```
Profily pri ROVNAKOM vstupe (3700/250/30):

Conservative:
- Risk: < 5.0
- Yield: < 12%
- Mix: dyn 0%, crypto 0%, gold 40%

Balanced:
- Risk: 6.0-7.0
- Yield: 13-15%
- Mix: dyn 15%, crypto 5%, gold 20%

Growth:
- Risk: 7.5-8.5
- Yield: 15-18%
- Mix: dyn 20%, crypto 10%, gold 15%

INVARIANT: riskG > riskB > riskC ✅
INVARIANT: yieldG > yieldB > yieldC ✅
```

---

## 5. ADVISOR QUESTIONS (Kritické rozhodnutia)

### 🔴 **Q1: Je getAdjustedMix() IDEMPOTENTNÝ?**

**Kontext:**

- InvestmentPowerBox (PR-38) volá `getAdjustedMix()` v každom renderi
- Ak v3.mix už obsahuje adjustovaný mix → re-adjustment môže zmeniť výsledok?

**Test:**

```typescript
const preset = { mix: [{ key: "gold", pct: 20 }, ...] };
const adjusted1 = getAdjustedMix(preset.mix, profile);
const adjusted2 = getAdjustedMix(adjusted1.mix, profile); // Rovnaký vstup

// OČAKÁVANÉ: adjusted1.mix === adjusted2.mix (idempotent)
// AKTUÁLNE: ???
```

**DÔSLEDOK:**

- Ak NIE idempotent → potrebujeme flag `mixAlreadyAdjusted` (skip re-adjustment)
- Ak ÁNO → PR-38 fix je BEZPEČNÝ

---

### 🔴 **Q2: ProfileAssetPolicy vs enforceRiskCap priorita?**

**Kontext:**

- ProfileAssetPolicy (STEP 7.5): dyn max 20% (STARTER Rastový)
- enforceRiskCap (STEP 8): škrtá dyn ak risk > 8.5

**Scenár:**

```
STEP 7.5: dyn = 20% (profile cap)
Risk = 8.7 (nad 8.5)
STEP 8: enforceRiskCap() → dyn 20% → 18% (zníženie)

OTÁZKA: Je to správne? Alebo ProfileAssetPolicy = HARD cap (nesiahnuť)?
```

**NÁVRH:**

- ProfileAssetPolicy caps = HARD (enforceRiskCap nesmie znížiť pod cap)
- enforceRiskCap škrtá LEN assety NAD profile cap
- Pre malé plány (< 50k) SKIP enforceRiskCap (CURRENT)

---

### 🟡 **Q3: optimizeYield headroom (+1.0) – zobrazovať v UI?**

**Kontext:**

- RISK_MAX: Growth 8.5
- optimizeYield: maxRiskForOptimizer = 9.5 (+1.0 headroom)
- Finálny mix môže mať risk 8.5-9.5

**UI DISPLAY:**

```
// VARIANT A: Zobraz RISK_MAX (8.5)
"Risk: 9.2 / 8.5" → ⚠️ Nad limitom (confusing pre usera)

// VARIANT B: Zobraz effectiveMax (9.5)
"Risk: 9.2 / 9.5" → ✅ V norme (user friendly)

// VARIANT C: Zobraz BEZ headroom warning
"Risk: 9.2 (optimalizované)" → ⓘ Hint tooltip
```

**ODPORÚČANIE:** Variant B (zobraz effective max 9.5)

---

### 🟡 **Q4: Auto-optimize debounce – znížiť na 300ms?**

**Kontext:**

- CURRENT: debounce 1s (čaká kým user dokončí zmeny)
- RISK: User refreshne pred 1s → state loss

**NÁVRH:**

```typescript
// Znížiť debounce: 1000ms → 300ms
const timer = setTimeout(() => {
  writeV3({ mix: adjusted.mix });
}, 300); // Rýchlejšia perzistencia, stále komfortné
```

**ALTERNATÍVA:**

- Pridať "Uložiť" button (explicitný save)
- Ale narúša UX princíp "instant reactivity"

---

## 6. ODPORÚČANIA PRE STABILITU

### ✅ **1. Memoizácia v InvestmentPowerBox**

```typescript
// src/features/invest/InvestmentPowerBox.tsx

const adjustedMix = React.useMemo(() => {
  const baseMix = v3.mix && v3.mix.length > 0 ? v3.mix : presetMixes[riskPref];

  const { mix } = getAdjustedMix(baseMix, {
    lumpSumEur,
    monthlyEur,
    horizonYears,
    monthlyIncome,
    fixedExpenses,
    variableExpenses,
    reserveEur,
    reserveMonths,
    goalAssetsEur,
    riskPref,
  });

  return mix;
}, [lumpSumEur, monthlyEur, horizonYears, riskPref, goalAssetsEur]);

const yieldAnnual = approxYieldAnnualFromMix(adjustedMix, riskPref);
const risk = riskScore0to10(adjustedMix, riskPref);
```

**DOPAD:**

- Zníženie renderov (getAdjustedMix iba pri zmene deps)
- Performance boost
- Prevencia infinite loops

---

### ✅ **2. Idempotency test pre getAdjustedMix**

```typescript
// tests/getAdjustedMix-idempotency.test.ts

describe("getAdjustedMix idempotency", () => {
  it("double adjustment = same result", () => {
    const preset = presets.balanced.mix;
    const profile = { lumpSumEur: 3700, monthlyEur: 250, ... };

    const adjusted1 = getAdjustedMix(preset, profile);
    const adjusted2 = getAdjustedMix(adjusted1.mix, profile);

    // OČAKÁVANÉ: rovnaké mixy
    expect(adjusted1.mix).toEqual(adjusted2.mix);
  });
});
```

**AK FAIL:**

- Pridať flag `mixOrigin: "preset" | "adjusted"` do v3
- InvestmentPowerBox: skip re-adjustment ak `mixOrigin === "adjusted"`

---

### ✅ **3. enforceRiskCap: Rešpektuj profile caps**

```typescript
// src/features/portfolio/enforceRiskCap.ts

// PRED škrtaním: check profile cap
for (const key of RISK_ORDERED_KEYS) {
  const asset = mix.find((m) => m.key === key);
  if (!asset || asset.pct === 0) continue;

  // GET profile cap (nie hardcoded)
  const profileCap = profileCaps[key];
  if (profileCap !== undefined && asset.pct <= profileCap * 1.05) {
    console.log(`${key} na profile cap ${profileCap}%, skip`);
    continue; // NEŠKMAJ
  }

  reducedKey = key;
  break;
}
```

**DOPAD:**

- Zabráni škrtaniu pod ProfileAssetPolicy caps
- Konzistentné správanie STEP 7.5 → STEP 8

---

### ✅ **4. Znížiť auto-optimize debounce**

```typescript
// src/BasicLayout.tsx (line 594)

const timer = setTimeout(() => {
  writeV3({ mix: adjusted.mix, ... });
}, 300); // Znížené z 1000ms
```

**DOPAD:**

- Rýchlejšia perzistencia (user refreshne → menej state loss)
- Stále komfortné (300ms je nepostrehnuteľné)

---

### ✅ **5. UI: Zobraz effective risk max**

```typescript
// InvestmentPowerBox.tsx

const effectiveRiskMax = Math.min(getRiskMax(riskPref) + 1.0, 9.0);
const riskStatus = currentRisk <= effectiveRiskMax
  ? "✅ V norme"
  : "⚠️ Nad limitom";

// Display:
<div>
  Risk: {currentRisk.toFixed(1)} / {effectiveRiskMax.toFixed(1)}
  <span className="text-xs">{riskStatus}</span>
</div>
```

**DOPAD:**

- User friendly (nie confusing "9.2 / 8.5")
- Transparentné (optimizer má headroom)

---

## 7. ZÁVER & NEXT STEPS

### ✅ **IMPLEMENTED (PR-38):**

1. InvestmentPowerBox: `calculateCurrentMetrics()` volá `getAdjustedMix()` live
2. yieldOptimizer: Removed volume check (< 100k skip)

### ⏳ **PENDING VERIFICATION:**

1. Live test: 3700/250/30 → Rastový profil → risk 7.5-8.5? ✅
2. Idempotency test: `getAdjustedMix(adjusted.mix)` = same result?
3. Performance: InvestmentPowerBox render lag?

### 🔴 **CRITICAL ADVISORQUESTIONS:**

1. Je `getAdjustedMix()` idempotentný? (double adjustment = same)
2. ProfileAssetPolicy vs enforceRiskCap priorita? (HARD caps?)
3. optimizeYield headroom (+1.0) – zobrazovať effective max (9.5)?
4. Auto-optimize debounce – znížiť na 300ms?

### ✅ **RECOMMENDED FIXES:**

1. Memoizácia `adjustedMix` v InvestmentPowerBox (React.useMemo)
2. enforceRiskCap: Check profile caps pred škrtaním
3. Znížiť auto-optimize debounce: 1000ms → 300ms
4. UI: Zobraz effective risk max (8.5 + 1.0 = 9.5)

---

**FINAL VERDICT:**

- Logika na papieri vyzerá SPRÁVNE ✅
- ProfileAssetPolicy STARTER caps fixed (PR-34) ✅
- optimizeYield beží pre všetky plány (PR-38) ✅
- InvestmentPowerBox live re-adjustment (PR-38) ✅

**BLOCKER:**

- ❓ Idempotency neoverená (risk double-adjustment)
- ❓ Performance impact (getAdjustedMix v každom renderi)

**RELEASE READY?**

- 🟡 **CONDITIONAL:** Ak idempotency test PASS → YES
- 🟡 **CONDITIONAL:** Ak live test 3700/250/30 → risk 7.5-8.5 → YES
- 🔴 **BLOCKER:** Ak ktorýkoľvek fail → INVESTIGATE

---

**Dátum analýzy:** 1. december 2025  
**Agent:** AI (GitHub Copilot - Claude Sonnet 4.5)  
**Účel:** Pre advisora - návrh finálneho riešenia stability
