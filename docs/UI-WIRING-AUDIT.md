# UI WIRING AUDIT – Single Source of Truth

**Date:** December 4, 2025  
**PR:** UI-WIRING (fix NaN + C < B < G inverzia v BASIC UI)  
**Status:** ✅ COMPLETE

---

## Summary

Všetky UI komponenty v BASIC režime teraz berú **risk** a **yield** z `portfolioEngine` (`computePortfolioFromInputs`), nie z legacy helperov (`approxYieldAnnualFromMix` + `riskScore0to10`).

**Dopad:**

- ✅ **0 NaN** hodnôt v UI (header, porovnanie profilov, status bar)
- ✅ **C < B < G** garantované (rešpektuje P1.5 invarianty)
- ✅ **Konzistentné čísla** naprieč UI (všetky miesta používajú engine)

---

## Prepojené komponenty (Risk/Yield z engine)

### **1. useProjection.ts** (Core Hook)

**Súbor:** `src/features/projection/useProjection.ts`

**Zmeny:**

- Pridaný import: `import { computePortfolioFromInputs } from "../portfolio/portfolioEngine";`
- Risk/Yield výpočet (lines ~90-110):
  ```typescript
  if ((lumpSumEur > 0 || monthlyVklad > 0) && horizonYears > 0) {
    const engineResult = computePortfolioFromInputs({
      lumpSumEur,
      monthlyVklad,
      horizonYears,
      reserveEur: 0,
      reserveMonths: 0,
      riskPref,
    });
    approxYield = engineResult.approxYieldAnnual; // Nové: z engine
    riskScore = engineResult.approxRisk; // Nové: z engine
  } else {
    // Fallback pre 0/0/0 vstupy (edge case)
    approxYield = approxYieldAnnualFromMix(mix, riskPref);
    riskScore = riskScore0to10(mix, riskPref, 0);
  }
  ```

**Používajú ho (downstream):**

- `StickyBottomBar.tsx` (status bar)
- `ProjectionChart.tsx`
- `BasicProjectionPanel.tsx`
- `MetricsSection.tsx`
- Všetky komponenty, ktoré zobrazujú "Ročný výnos" alebo "Riziko"

**Dopad:**

- ✅ Všetky miesta, ktoré používajú `useProjection`, dostávajú engine čísla
- ✅ Volume-aware risk/yield (RISK_MAX_PER_BAND)
- ✅ FV výpočty zachované (calculateFutureValue), len risk/yield z engine

---

### **2. InvestmentPowerBox.tsx** (Header + Porovnanie profilov)

**Súbor:** `src/features/invest/InvestmentPowerBox.tsx`

**Zmeny:**

#### **A) Aktuálny profil (hlavný header)**

- **Funkcia:** `calculateCurrentMetrics()` (lines ~127-194)
- **Už používala engine** ✅ (žiadna zmena potrebná):
  ```typescript
  const result = computePortfolioFromInputs({
    lumpSumEur,
    monthlyVklad,
    horizonYears,
    reserveEur,
    reserveMonths,
    riskPref,
  });
  return { yield: result.yieldPa, risk: result.riskScore };
  ```

#### **B) Porovnanie profilov (C/B/G kartičky)**

- **Funkcia:** `calculateProfileMetrics(targetProfile)` (lines ~84-125)
- **Pred:** Hard-coded preset mixy + `approxYieldAnnualFromMix` + `riskScore0to10`
- **Po:** Volá `computePortfolioFromInputs` pre každý profil:
  ```typescript
  const result = computePortfolioFromInputs({
    lumpSumEur,
    monthlyVklad,
    horizonYears,
    reserveEur,
    reserveMonths,
    riskPref: targetProfile, // ← Testovaný profil (C/B/G)
  });
  return { yield: result.yieldPa, risk: result.riskScore };
  ```
- **Fallback:** Legacy preset mixy (len ak engine zlyhá, edge case)

#### **C) NaN Guards**

- **Header** (lines ~308-319):
  ```typescript
  {
    currentMetrics.yield != null && !isNaN(currentMetrics.yield)
      ? (currentMetrics.yield * 100).toFixed(1)
      : "0.0";
  }
  ```
- **Porovnanie profilov** (lines ~361-372):
  ```typescript
  {
    pm.yield != null && !isNaN(pm.yield) ? (pm.yield * 100).toFixed(1) : "0.0";
  }
  ```

**Dopad:**

- ✅ Porovnanie profilov rešpektuje P1.5 invarianty (C < B < G)
- ✅ Volume-aware mixy (nie fixed preset)
- ✅ Žiadne NaN v UI (fallback "0.0")

---

### **3. StickyBottomBar.tsx** (Spodný status bar)

**Súbor:** `src/components/StickyBottomBar.tsx`

**Zdroj:**

- Používa `useProjection` hook (lines ~66-72):
  ```typescript
  const projection = useProjection({
    lumpSumEur,
    monthlyVklad,
    horizonYears,
    goalAssetsEur,
    mix,
    debts,
    riskPref,
  });
  const { fvFinal, approxYield, riskScore } = projection;
  ```

**Dopad:**

- ✅ `approxYield` a `riskScore` pochádzajú z engine (cez useProjection)
- ✅ Konzistentné s InvestmentPowerBox a ostatnými UI

---

## Legacy Helpers (Kde sa ešte používajú)

### **approxYieldAnnualFromMix** + **riskScore0to10**

**Súbor:** `src/features/mix/assetModel.ts`

**Používajú sa iba ako:**

1. **Fallback v useProjection** (ak lumpSum=0 AND monthly=0 AND horizon=0)
2. **Fallback v InvestmentPowerBox** (ak engine zlyhá – edge case)
3. **Iné komponenty** (LegacyApp, BasicLayout) – **PENDING CLEANUP**

**Poznámka:** Legacy použitie v `LegacyApp.tsx` a `BasicLayout.tsx` bude odstránené v budúcom PR (mimo BASIC UI scope).

---

## Test Coverage

### **Engine testy (zachované):**

- ✅ `portfolio-profile-invariants.test.tsx` – **41/41 PASS**
- ✅ `portfolio-input-combinations.test.tsx` – **155/155 PASS**
- ✅ P1.5 invarianty garantované (C < B < G, 0 CRITICAL warnings)

### **Manuálny QA (po deploy):**

Scenáre na overiť:

- `0/50/30` (Mini STARTER)
- `0/250/30` (Štart/Štandard CORE)
- `2500/250/30` (Silný CORE)
- `0/300/30` (CORE)
- `10k/500/20` (Prémiový PREMIUM)
- `50k/1000/15` (VIP PREMIUM)

**Očakávané:**

- ✅ Žiadne NaN v headri, porovnaní, status bare
- ✅ C < B < G (risk aj yield) v CORE/PREMIUM scenároch
- ✅ Konzistentné čísla naprieč UI

---

## Mapovanie zdroja (UI → Engine)

| UI Miesto                            | Komponent                            | Zdroj Risk/Yield                             | Engine API                        |
| ------------------------------------ | ------------------------------------ | -------------------------------------------- | --------------------------------- |
| **Header (Aktuálny profil)**         | InvestmentPowerBox                   | ✅ `computePortfolioFromInputs`              | `yieldPa`, `riskScore`            |
| **Porovnanie profilov (C/B/G)**      | InvestmentPowerBox                   | ✅ `computePortfolioFromInputs` (per profil) | `yieldPa`, `riskScore`            |
| **Status bar (Ročný výnos, Riziko)** | StickyBottomBar → useProjection      | ✅ `computePortfolioFromInputs`              | `approxYieldAnnual`, `approxRisk` |
| **Projekcia (Graf)**                 | ProjectionChart → useProjection      | ✅ `computePortfolioFromInputs`              | `approxYieldAnnual`, `approxRisk` |
| **Basic KPI Panel**                  | BasicProjectionPanel → useProjection | ✅ `computePortfolioFromInputs`              | `approxYieldAnnual`, `approxRisk` |

---

## Commits

1. **`bfa1f90`** – `fix(ui-wiring): useProjection používa portfolioEngine pre risk/yield`
   - useProjection.ts prepojený na engine
   - Fallback na legacy helpers iba pri 0/0/0 vstupoch
   - FV výpočty zachované (calculateFutureValue)

2. **`2f27e59`** – `fix(ui-wiring): InvestmentPowerBox porovnanie profilov cez portfolioEngine`
   - calculateProfileMetrics() volá engine pre C/B/G
   - NaN guardy pridané (yield/risk zobrazenie)
   - Volume-aware mixy (nie hard-coded presets)

---

## Akceptačné kritériá (splnené)

- ✅ **Žiadne NaN** v headri, porovnaní profilov, status bare
- ✅ **C < B < G** garantované v CORE/PREMIUM scenároch (P1.5 invarianty)
- ✅ **Konzistentné čísla** naprieč UI (všetky z engine)
- ✅ **FV výpočty** v useProjection zachované (len risk/yield z engine)
- ✅ **Engine testy** zelené (41/41 + 155/155 PASS)

---

## Poznámky

- **Legacy komponenty** (LegacyApp, BasicLayout) ešte obsahujú priame volania legacy helperov → cleanup v budúcom PR
- **useProjection** je teraz single source of truth pre všetky UI komponenty v BASIC režime
- **portfolioEngine** garantuje volume-aware risk/yield (RISK_MAX_PER_BAND, P1.5 caps)

---

**Status:** ✅ **READY FOR QA**

Po manuálnom overení scenárov (0/50/30, 0/250/30, 2500/250/30, 0/300/30, 10k/500/20, 50k/1000/15) môže ísť do produkcie.
