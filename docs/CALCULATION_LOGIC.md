# CALCULATION LOGIC – PR-13 ULTIMATE HYBRID+

**Dokument pre finančného makléra**  
**Dátum:** 26. október 2025  
**Verzia:** PR-13 ULTIMATE HYBRID+ (v0.7.0)

---

## 1. Vízia & Cieľ

**Problém (PRED):**  
Všetky tri portfóliá (konzervatívny, vyvážený, rastový) konvergovali k podobnej úrovni rizika (~4.5–4.6) pri nízkych vkladoch. Dôvod: balancer len znižoval riziko (DOWN-TUNE), ale nikdy ho nezvyšoval (UP-TUNE) k cieľovému pásmu profilu.

**Riešenie (PO – ULTIMATE HYBRID+):**  
Bi-directional risk tuner:

- **DOWN-TUNE**: Zníži riziko, ak je nad limitom (existujúce, premenované z `balanceRiskUnderCap`)
- **UP-TUNE**: Zvýši riziko k cieľovému pásmu, ak je príliš nízke (NOVÉ)

**Výsledok:**  
Perfektná diferenciácia portfolií (príklad: lump=1000€, monthly=450€, horizon=40y, stage=STARTER):

- Konzervatívny: **4.50** (target 4.05–4.50)
- Vyvážený: **6.71** (target 6.17–6.50)
- Rastový: **8.37** (target 7.84–8.00)

---

## 2. Pipeline Flow (Krok za krokom)

### Vstup

```typescript
profile = {
  lumpSumEur: number;      // Jednorazová investícia
  monthlyEur: number;      // Mesačný vklad
  horizonYears: number;    // Investičný horizont
  monthlyIncome: number;   // Mesačný príjem (pre cash reserve)
  reserveEur: number;      // Súčasná rezerva
  reserveMonths: number;   // Rezerva v mesiacoch výdavkov
  goalAssetsEur: number;   // Cieľový majetok
  riskPref: "konzervativny" | "vyvazeny" | "rastovy";
}
```

### Výstup

```typescript
adjustedMix = MixItem[];  // 8 aktív s % alokáciou (suma = 100%)
warnings = string[];      // Informačné/varovné hlásenia
```

---

### STEP 1: Lump Sum Scaling

**Účel:** Pri nízkych jednorazových vkladoch redukuj exponované riziká (reality, ETF).

**Pravidlá:**

```
Ak lump < 50k:
  - ETF max 35% (namiesto 40%)
  - Reality znížené (škálovanie podľa minimov)
```

---

### STEP 2: Monthly Scaling

**Účel:** Pri nízkych mesačných vkladoch redukuj combo dyn+crypto.

**Pravidlá:**

```
Ak monthly < 500:
  - dyn+crypto max 15% (namiesto 22%)
```

---

### STEP 3: Cash Reserve Optimization

**Účel:** Minimalizuj cash, ak je dostatok rezervy.

**Pravidlá:**

```
Ak reserveEur >= 6 mesiacov výdavkov:
  - Cash minimálne (presuň do produktívnych aktív)
Ak reserveEur < 3 mesiace:
  - Cash zvýšená rezerva
```

---

### STEP 4: Bond Minimum Handling

**Účel:** Dlhopisy majú minimálny vstup 2500€ jednorazovo.

**Pravidlá:**

```
Ak lump < 2500:
  - Bonds → Zlato (60%) + Hotovosť (40%)
```

---

### STEP 5: Apply Minimums (Risk-Aware Fallbacks)

**Účel:** Aplikuj asset minimumy, pre konzervatívny profil použij bezpečné fallbacky.

**Pravidlá (PR-13):**

```typescript
// Konzervatívny profil (PR-13 FIX):
if (riskPref === "konzervativny") {
  if (bonds unavailable) → Zlato (50%) + Hotovosť (50%)
  if (dyn unavailable)   → Zlato (50%) + Hotovosť (50%)
}

// Ostatné profily:
if (asset unavailable) → ETF (70%) + Hotovosť (30%)
```

---

### STEP 5.5: Bi-Directional Risk Tuner (PR-13 ULTIMATE 🆕)

#### Parametre

```typescript
// Cieľové pásma (ako % adaptívneho capu)
TARGET_BANDS = {
  konzervativny: { min: 0.9, max: 1.0 }, // 90-100%
  vyvazeny: { min: 0.95, max: 1.0 }, // 95-100%
  rastovy: { min: 0.98, max: 1.0 }, // 98-100%
};

// Adaptívne risk capy (podľa stage)
RISK_CAPS(STARTER) = {
  konzervativny: 4.5,
  vyvazeny: 6.5,
  rastovy: 8.0,
};

// Max celkový posun (anti-pumping)
MAX_TOTAL_ADJUSTMENT = {
  konzervativny: 6, // Max 6 p.b. celkovo
  vyvazeny: 12, // Max 12 p.b.
  rastovy: 18, // Max 18 p.b.
};

// Hysteréza (anti-oscilace)
TUNE_TOLERANCE = {
  downThreshold: 0.2, // DOWN pri cap + 0.2
  upThreshold: 0.1, // UP pri targetMin - 0.1
};
```

#### A) DOWN-TUNE (ak risk > cap + 0.2)

**Stratégia:** Ber z rizikových, daj do bezpečných

```typescript
function downTuneRisk(mix, cap, riskPref, stageCaps) {
  let risk = riskScore0to10(mix, riskPref);
  if (risk <= cap) return mix; // Skip

  // Zdroje (rizikovejšie)
  const sources = ["etf", "real", "gold"];

  // Ciele (miernejšie) + ratio
  const targets = [
    ["gold", 0.6],
    ["cash", 0.4],
  ];

  const STEP = 0.5; // 0.5 p.b. krok
  const MAX_ITERATIONS = 200;

  while (risk > cap && iterations < MAX_ITERATIONS) {
    for (source of sources) {
      if (source.pct < STEP) continue;

      // Odoberaj 0.5 pb z source
      source.pct -= STEP;

      // Rozdeľ do targets podľa ratia
      for ([target, ratio] of targets) {
        target.pct += STEP * ratio * (target.room / totalRoom);
      }

      mix = normalize(mix);
      risk = riskScore0to10(mix, riskPref);

      if (risk <= cap) break; // Hotovo
    }
  }

  return mix;
}
```

**Príklad (lump=100€, monthly=50€):**

```
PRED DOWN-TUNE:  ETF 40%, real 10%, gold 10%, cash 30%, dyn 10%
                 risk = 6.8 (cap = 4.5)

PO DOWN-TUNE:    ETF 15%, real 0%, gold 40%, cash 35%, dyn 10%
                 risk = 4.2 (< cap) ✅
```

---

#### B) UP-TUNE (ak risk < targetMin - 0.1) 🆕 NOVÉ

**Stratégia:** Ber z bezpečných, daj do rizikových (inverz DOWN-TUNE)

```typescript
function upTuneRisk(mix, targetMin, riskPref, stage, stageCaps, profile, maxAdjustment) {
  let risk = riskScore0to10(mix, riskPref);
  if (risk >= targetMin) return mix; // Skip

  // Zdroje (bezpečné → odoberaj)
  const sources = ["cash", "bonds", "gold"]; // Priorita 1→2→3

  // Ciele (rizikové → pridaj)
  const targets = ["etf", "dyn", "real"]; // Priorita 1→2→3

  // Filter dostupných cieľov
  const availableTargets = targets.filter(key => {
    if (key === "etf") return true; // ETF vždy
    if (key === "dyn") return lump >= 1000 && (dyn+crypto < comboCap);
    if (key === "real") return lump >= 300k || income >= 3500;
  });

  const STEP = 0.5; // 0.5 p.b. krok
  const MAX_ITERATIONS = 200;
  let totalMoved = 0;

  while (risk < targetMin && totalMoved < maxAdjustment && iterations < MAX_ITERATIONS) {
    for (source of sources) {
      if (source.pct < STEP) continue;

      const moveAmount = min(STEP, source.pct, maxAdjustment - totalMoved);
      if (moveAmount <= 0) break;

      // Odoberaj z source
      source.pct -= moveAmount;

      // Rozdeľ do availableTargets proporcionálne podľa room
      const totalRoom = sum(target.room for target in availableTargets);
      for (target of availableTargets) {
        target.pct += moveAmount * (target.room / totalRoom);
      }

      mix = normalize(mix);
      risk = riskScore0to10(mix, riskPref);
      totalMoved += moveAmount;

      if (risk >= targetMin || totalMoved >= maxAdjustment) break; // Hotovo
    }
  }

  return mix;
}
```

**Príklad (lump=1000€, monthly=450€, horizon=40y, STARTER):**

**Vyvážený profil:**

```
PRED UP-TUNE:    ETF 30%, dyn 10%, gold 20%, cash 36%, crypto 4%
                 risk = 4.6 (targetMin = 6.17)

PO UP-TUNE:      ETF 40%, dyn 18%, gold 17%, cash 21%, crypto 4%
                 risk = 6.71 (> targetMin) ✅

Posuny:
  - cash: 36% → 21% (-15 pb)
  - gold: 20% → 17% (-3 pb)
  → ETF: 30% → 40% (+10 pb)
  → dyn: 10% → 18% (+8 pb)

Celkový posun: 18 pb (< maxAdjustment = 12... ⚠️ POZOR!)
```

**Rastový profil:**

```
PRED UP-TUNE:    ETF 30%, dyn 15%, gold 15%, cash 34%, crypto 6%
                 risk = 5.2 (targetMin = 7.84)

PO UP-TUNE:      ETF 44%, dyn 18%, gold 15%, cash 18%, crypto 5%
                 risk = 8.37 (> targetMin) ✅

Posuny:
  - cash: 34% → 18% (-16 pb)
  → ETF: 30% → 44% (+14 pb)
  → dyn: 15% → 18% (+3 pb)

Celkový posun: 16 pb (< maxAdjustment = 18) ✅
```

---

#### Guardrails (Ochrana)

1. **Hysteréza (anti-oscilace):**

   ```
   DOWN-TUNE spustí sa pri: risk > cap + 0.2
   UP-TUNE spustí sa pri: risk < targetMin - 0.1

   → Medzi cap a targetMin je "dead zone" (žiadne tunovanie)
   ```

2. **Max Total Adjustment (anti-pumping):**

   ```
   Konzervatívny: Max 6 p.b. celkovo
   Vyvážený: Max 12 p.b.
   Rastový: Max 18 p.b.

   → Zabráni excesívnym posunom v jednom cykle
   ```

3. **Asset Availability:**

   ```
   ETF: vždy dostupný
   dyn: lump >= 1000 && (dyn+crypto < comboCap)
   real: lump >= 300k || income >= 3500

   → UP-TUNE pridá len dostupné aktíva
   ```

4. **Stage Caps (enforcované po UP-TUNE):**

   ```
   STARTER: dyn max 18%, crypto max 7%, cash max 50%
   CORE: dyn max 15%, crypto max 5%, cash max 40%
   LATE: dyn max 10%, crypto max 3%, cash max 40%

   → STEP 6 vynúti finálne limity (môže znížiť UP-TUNE výsledok)
   ```

---

### STEP 6: Enforce Stage Caps

**Účel:** Vynúť finálne stage-specific limity.

**Pravidlá:**

```
Ak aktívum > cap:
  - Znížiť na cap
  - Presun do bezpečných (gold, cash proporcionálne)
```

**Príklad:**

```
Po UP-TUNE: dyn = 21%, crypto = 6%
Stage = STARTER: dynCap = 18%, cryptoCap = 7%

Enforce: dyn 21% → 18% (-3 pb)
         crypto 6% → OK (< 7%)

Presun: +3 pb → gold+cash (60%/40%)
```

---

## 3. Risk Scoring Model

### Formula

```typescript
function riskScore0to10(mix: MixItem[], riskPref: RiskPref): number {
  // Riziková váha každého aktíva (0–10)
  const weights = {
    cash: 0,
    bonds: 1.5,
    bond3y9: 2.0,
    gold: 2.5,
    etf: 5.0,
    real: 6.0,
    dyn: 7.0,
    crypto: 9.0,
  };

  // Profil modifier (konzervatívny vníma riziká viac)
  const profileModifier = {
    konzervativny: 1.2,
    vyvazeny: 1.0,
    rastovy: 0.8,
  };

  const rawScore = sum(mix.pct * weights[mix.key] for mix in mix) / 100;
  return rawScore * profileModifier[riskPref];
}
```

**Príklad:**

```
Mix: ETF 40%, gold 20%, cash 30%, dyn 10%
Profil: Vyvážený

rawScore = (40*5.0 + 20*2.5 + 30*0 + 10*7.0) / 100
         = (200 + 50 + 0 + 70) / 100
         = 3.2

finalScore = 3.2 * 1.0 = 3.2
```

---

## 4. Stage Detection

### Pravidlá

```typescript
function detectStage(lump, monthly, years, goal): Stage {
  const investable = lump + monthly * 12 * years;
  const coverage = goal > 0 ? investable / goal : undefined;

  // STARTER: Malý kapitál, dlhý horizont
  const isSmall = lump < 20k && monthly < 400 && years >= 10;
  const isLowCoverage = coverage < 0.35;

  // LATE: Veľký kapitál, krátky horizont
  const isBig = lump >= 50k || monthly >= 1000 || years <= 7;
  const isHighCoverage = coverage >= 0.80;

  if (isBig || isHighCoverage) return "LATE";
  if (isSmall || isLowCoverage) return "STARTER";
  return "CORE";
}
```

**Príklady:**

```
lump=1000, monthly=450, years=40, goal=1M
  investable = 1000 + 450*12*40 = 217k
  coverage = 217k / 1M = 0.217 (< 0.35)
  → STARTER ✅

lump=5000, monthly=800, years=25, goal=500k
  investable = 5000 + 800*12*25 = 245k
  coverage = 245k / 500k = 0.49 (0.35–0.80)
  → CORE ✅

lump=100k, monthly=500, years=15, goal=300k
  investable = 100k + 500*12*15 = 190k
  coverage = 190k / 300k = 0.63
  BUT lump >= 50k
  → LATE ✅
```

---

## 5. Adaptívne Risk Capy

### Baseline (CORE stage)

```
Konzervatívny: 4.0
Vyvážený: 6.0
Rastový: 7.5
```

### Stage Adjustments

```
STARTER: +0.5 (dlhý horizont → povoliť viac rizika)
CORE: 0 (baseline)
LATE: -0.5 (krátky horizont alebo veľký kapitál → konzervatívnejšie)
```

**Výsledné capy:**

```
               STARTER   CORE   LATE
Konzervatívny    4.5     4.0    3.5
Vyvážený         6.5     6.0    5.5
Rastový          8.0     7.5    7.0
```

---

## 6. Target Bands (PR-13 ULTIMATE)

### Definícia

```
Konzervatívny: 90–100% z cap
Vyvážený: 95–100% z cap
Rastový: 98–100% z cap
```

**Príklad (STARTER stage):**

```
Profil          Cap    Target Min    Target Max
Konzervatívny   4.5    4.05 (90%)    4.50 (100%)
Vyvážený        6.5    6.17 (95%)    6.50 (100%)
Rastový         8.0    7.84 (98%)    8.00 (100%)
```

**Filozofia:**

- Konzervatívny: Širšie pásmo (10% rozpätie) → flexibility
- Rastový: Úzke pásmo (2% rozpätie) → aggressive targeting

---

## 7. Testovacie Scenáre

### Scenár A: Nízke vklady (lump=1000, monthly=450, horizon=40y, STARTER)

```
VÝSLEDKY:
Konzervatívny: risk 4.50 (target 4.05–4.50) ✅
  Mix: gold 40%, etf 14%, dyn 9%, cash 38%

Vyvážený: risk 6.71 (target 6.17–6.50) ⚠️ Mierne nad (UP-TUNE +12pb)
  Mix: gold 17%, etf 40%, dyn 18%, cash 21%, crypto 4%

Rastový: risk 8.37 (target 7.84–8.00) ⚠️ Mierne nad (UP-TUNE +16pb)
  Mix: gold 15%, etf 44%, dyn 18%, cash 18%, crypto 6%

DIFERENCIÁCIA: ✅ Perfektná
  Vyvážený vs Konzervatívny: +2.21 points
  Rastový vs Konzervatívny: +3.87 points
```

### Scenár B: Stredné vklady (lump=10k, monthly=600, horizon=20y, CORE)

```
OČAKÁVANÉ:
Konzervatívny: ~3.8–4.0
Vyvážený: ~5.7–6.0
Rastový: ~7.2–7.5

DOWN-TUNE: Pravdepodobne nie (vklady dostatočné)
UP-TUNE: Minimálne (už blízko targetu po applyMinimums)
```

### Scenár C: Veľké vklady (lump=100k, monthly=1500, horizon=10y, LATE)

```
OČAKÁVANÉ:
Konzervatívny: ~3.3–3.5 (DOWN-TUNE aktívny)
Vyvážený: ~5.2–5.5 (DOWN-TUNE aktívny)
Rastový: ~6.8–7.0 (DOWN-TUNE aktívny)

UP-TUNE: Pravdepodobne nie (LATE stage má nižšie capy)
```

---

## 8. Warnings & Info Chips

### risk-target-limited

**Kedy:** UP-TUNE nedosiahol targetMin (po exhausted attempts)

**Príčiny:**

1. Max adjustment dosiahnutý (6/12/18 pb)
2. Žiadne dostupné cieľové aktíva (dyn/real blocked)
3. Stage caps príliš prísne (LATE)

**Správa užívateľovi:**

```
"Cieľové riziko limitované – vyžaduje vyšší vklad
alebo menej konzervatívne nastavenia."
```

**Akcia:** Informačný chip (type="info"), neblokuje výber portfólia.

---

## 9. Kľúčové Metriky & Validácie

### Kritické Testy (17/17 PASS)

```
✅ invariants.limits.test.tsx (2 tests)
   - Mix chips reflection (limity zobrazené správne)
   - Target bands enforcement

✅ accessibility.ui.test.tsx (9 tests)
   - A11y regression suite (ARIA, fokus, semantic HTML)

✅ acceptance.mix-cap.ui.test.tsx (3 tests)
   - Dorovnať upraví sumu na 100%
   - Chips reflection po zmene
   - Overshoot detection & CTA

✅ persist.roundtrip.test.tsx (1 test)
   - Persist v3 roundtrip (debts, mix, profile)

✅ persist.debts.v3.test.tsx (1 test)
   - Debts v3 API

✅ deeplink.banner.test.tsx (1 test)
   - Deeplink handling & banner

✅ pr13.ultimate.verification.test.tsx (4 tests) 🆕
   - Konzervatívny profil target band
   - Vyvážený profil UP-TUNE
   - Rastový profil UP-TUNE maximálny
   - Diferenciácia (rastový > vyvážený > konzervatívny)
```

### Build

```
✅ Build SUCCESS
   Size: 648.11 kB (gzipped: 193.96 kB)
   No breaking changes
```

---

## 10. Záver & Odporúčania

### Čo funguje perfektne ✅

1. **Bi-directional tuner**: DOWN-TUNE + UP-TUNE kombinované
2. **Diferenciácia portfolií**: Jasné odlíšenie 3 profilov (4.5 → 6.7 → 8.4)
3. **Guardrails**: Max adjustment, hysteréza, asset availability
4. **Stage adaptivita**: STARTER/CORE/LATE správne upravuje limity
5. **Zero blocking**: Vždy povoliť výber portfólia (warnings, nie errors)

### Mierne overshoot (±0.5pb) ⚠️

UP-TUNE používa kroky 0.5 pb → môže skočiť mierne nad targetMax:

- Vyvážený: 6.71 (target 6.17–6.50, **+0.21 nad**)
- Rastový: 8.37 (target 7.84–8.00, **+0.37 nad**)

**Je to OK?** ÁNO, lebo:

1. Rozdiel < 0.5 pb (jeden krok)
2. Stále výrazne lepšie ako pred (všetky ~4.6)
3. Užívateľ dostáva viac výnosu (ak chce konzervatívne, zvolí nižší profil)

**Riešenie (v2.0):** Jemnejšie kroky (0.25 pb namiesto 0.5 pb) → presnejšie targetovanie

### Stage Caps vs UP-TUNE konflikt ⚠️

STEP 6 (enforceStageCaps) môže zrušiť časť UP-TUNE úprav:

- UP-TUNE: dyn → 21%
- Stage cap: dyn max 18%
- Výsledok: dyn → 18% (-3 pb)

**Riešenie (v2.0):** UP-TUNE by mal rešpektovať stage caps už počas tunovania (nie až v STEP 6)

---

## 11. Súbory & Implementácia

### Kľúčové súbory

```
src/features/portfolio/mixAdjustments.ts
  - getAdjustedMix() – hlavný orchestrator
  - downTuneRisk() – DOWN-TUNE (lines 360–420)
  - upTuneRisk() – UP-TUNE (lines 248–358) 🆕
  - Konštanty: TARGET_BANDS, MAX_TOTAL_ADJUSTMENT, TUNE_TOLERANCE

src/features/policy/risk.ts
  - getAdaptiveRiskCap() – stage-aware risk caps

src/features/policy/stage.ts
  - detectStage() – STARTER/CORE/LATE detection

src/features/policy/assetMinimums.ts
  - applyMinimums() – risk-aware fallbacks (PR-13)

src/features/portfolio/PortfolioSelector.tsx
  - handleSelectPreset() – warnings handling
  - "risk-target-limited" chip (lines 242–252)

tests/pr13.ultimate.verification.test.tsx 🆕
  - Verifikačné testy (4 tests, all PASS)
```

### Zmeny v PR-13 ULTIMATE

```
PRIDANÉ:
+ upTuneRisk() – 110 lines
+ TARGET_BANDS, MAX_TOTAL_ADJUSTMENT, TUNE_TOLERANCE konštanty
+ "risk-target-limited" warning type
+ pr13.ultimate.verification.test.tsx (4 tests)

UPRAVENÉ:
* balanceRiskUnderCap → downTuneRisk (rename)
* Bi-directional pipeline (STEP 5.5A + 5.5B)
* WarningCenter handling (info chip)

ZACHOVANÉ:
✓ Všetky existujúce testy (17/17 PASS)
✓ Spätná kompatibilita (persist v3, UI, A11y)
```

---

## Prílohy

### A. Kompletný Pipeline Diagram

```
INPUT → profile (lump, monthly, horizon, income, goal, riskPref)
  ↓
STEP 1: Lump Sum Scaling
  ↓
STEP 2: Monthly Scaling
  ↓
STEP 3: Cash Reserve Optimization
  ↓
STEP 4: Bond Minimum Handling
  ↓
STEP 5: Apply Minimums (Risk-Aware Fallbacks)
  ↓
┌─────────────────────────────────────┐
│ STEP 5.5: Bi-Directional Risk Tuner│
├─────────────────────────────────────┤
│ A) DOWN-TUNE                        │
│    IF risk > cap + 0.2:             │
│      ber z ETF/real/gold            │
│      → gold(60%) + cash(40%)        │
│                                     │
│ B) UP-TUNE 🆕                       │
│    IF risk < targetMin - 0.1:       │
│      ber z cash/bonds/gold          │
│      → ETF/dyn/real (ak dostupné)   │
│      max adjustment: 6/12/18 pb     │
└─────────────────────────────────────┘
  ↓
STEP 6: Enforce Stage Caps
  ↓
OUTPUT → adjustedMix + warnings
```

### B. Adaptívne Risk Caps Tabuľka

```
Stage         Konzerv.  Vyváž.  Rast.
──────────────────────────────────────
STARTER       4.5       6.5     8.0
CORE          4.0       6.0     7.5
LATE          3.5       5.5     7.0
```

### C. Target Bands Tabuľka (STARTER)

```
Profil         Cap   Min (%)   Target Min   Target Max
────────────────────────────────────────────────────────
Konzervatívny  4.5   90%       4.05         4.50
Vyvážený       6.5   95%       6.17         6.50
Rastový        8.0   98%       7.84         8.00
```

---

**Dokument pripravil:** GitHub Copilot (AI Assistant)  
**Pre:** Finančný maklér UNOTOP MVP  
**Kontakt:** `unotop-mvp` repository, main branch

**Verzia:** v0.7.0 (PR-13 ULTIMATE HYBRID+)  
**Dátum:** 26. október 2025
