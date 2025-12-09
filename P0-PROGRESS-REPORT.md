# P0 Progress Report – Idempotency Issue Discovered

## Aktuálny stav (01.12.2025 14:41)

✅ **HOTOVO (P0.1)**: `computePortfolioFromInputs()` engine vytvorený  
✅ **HOTOVO (P0.2)**: Idempotency test vytvorený  
❌ **KRITICKÝ BUG OBJAVENÝ**: `getAdjustedMix()` **NIE JE** idempotentný

---

## Čo sa stalo

Vytvoril som kompletný idempotency test (11 testov: 3 scenáre × 3 profily + 2 edge cases).

**Všetkých 11 testov FAILED** - potvrdenie advisor hypotézy.

### Príklad (rastovy + Core 10k/500/20):

**FIRST PASS (getAdjustedMix(preset, profile)):**

```json
{
  "bonds": 4.08,
  "dyn": 22.0,
  "etf": 58.84,
  "gold": 11.7,
  "cash": 1.19,
  "crypto": 1.75,
  "real": 0.44
}
```

**SECOND PASS (getAdjustedMix(firstPass.mix, profile)):**

```json
{
  "bonds": 5.59, // ↑ +1.51%
  "dyn": 21.73, // ↓ -0.27%
  "etf": 58.88, // ↑ +0.04%
  "gold": 11.86, // ↑ +0.16%
  "cash": 0, // ↓ -1.19%
  "crypto": 1.59, // ↓ -0.16%
  "real": 0.35 // ↓ -0.09%
}
```

**Rozdiel:** Mix sa **MENÍ** pri opakovanom volaní! Najväčšie zmeny v bonds (+1.51%) a cash (-1.19%).

### Príklad 2 (rastovy + Premium 50k/1000/15):

**FIRST PASS:**

```json
{
  "bonds": 3.68,
  "dyn": 22.0,
  "etf": 62.24,
  "gold": 9.72,
  "cash": 0.44,
  "crypto": 1.69,
  "real": 0.23
}
```

**SECOND PASS:**

```json
{
  "bonds": 2.47, // ↓ -1.21%
  "dyn": 21.95, // ↓ -0.05%
  "etf": 64.01, // ↑ +1.77%
  "gold": 9.99, // ↑ +0.27%
  "cash": 0, // ↓ -0.44%
  "crypto": 1.46, // ↓ -0.23%
  "real": 0.12 // ↓ -0.11%
}
```

**Najväčšie zmeny:** ETF (+1.77%), bonds (-1.21%), cash (-0.44%).

---

## Root cause hypotéza

Problém je pravdepodobne v **STEP ordering conflicts** v `mixAdjustments.ts`:

1. **STEP 7 applyCashCap**: Zníži cash ak > limit → realokuje do gold/ETF
2. **STEP 7.5 applyProfileAssetPolicy**: Caps dyn/crypto/bond9
3. **STEP 8 enforceRiskCap**: Ak risk > max → iteratívne znižuje dyn/crypto → realokuje do bonds/cash
4. **STEP 10 optimizeYield**: Ak je risk room → zvyšuje dyn/crypto → realokuje z bonds/cash

**Konflikt:** Opakované volanie robí:

- 1. pass: cash → gold/ETF (STEP 7) → risk cap cuts dyn → bonds up (STEP 8)
- 2. pass: už upravený mix → iné starting point → **INÉ ROZDELENIE**

---

## Dopad na production

**3700/250/30 rastový scenár:**

- InvestmentPowerBox volá `getAdjustedMix()` v **KAŽDOM RENDERI**
- Ak nie je idempotentný → **mix oscilluje** pri re-renderoch
- Risk/yield metriky **skáču** bez dôvodu
- Používateľ vidí **nestabilné čísla**

**Auto-optimize debounce 1s:**

- Auto-optimize počká 1s → zapíše do `v3.mix`
- Ale InvestmentPowerBox už počítal 10× medzitým
- Výsledok: **Dual source of truth** s rôznymi hodnotami

---

## Riešenie (potrebujem advisor rozhodnutie)

### Možnosť A: Fix idempotency v `getAdjustedMix` (HARD)

**Approach:** Prepísať step ordering tak, aby:

- STEP 7/7.5/8/10 **nemali konflikty**
- Každý step robí **deterministické zmeny**
- Normalize len raz na konci

**Odhadovaný čas:** 6-8 hodín (research + fix + regression testing)

**Riziko:** Môže rozbiť existujúce scenáre (musím mať full test matrix PRED začatím)

---

### Možnosť B: Obchádzka – memoization na UI level (QUICK)

**Approach:**

- `computePortfolioFromInputs()` cachuje výsledok podľa inputs hash
- Ak sú inputs rovnaké → return cached mix (bez re-calculation)
- InvestmentPowerBox používa `React.useMemo` s deps na inputs

**Odhadovaný čas:** 2-3 hodiny

**Výhoda:** Neriešime core problém, ale skryjeme symptóm

**Nevýhoda:** Idempotency bug ostáva → budúce použitie `getAdjustedMix` mimo cache môže stále oscillovať

---

### Možnosť C: Hybrid – Quick fix + proper fix v P1

**Phase 1 (teraz, 2h):**

- Memoization v `computePortfolioFromInputs`
- Freeze test matrix (export current behavior ako baseline)
- Ship P0 s warning "idempotency fix pending"

**Phase 2 (P1, 6-8h):**

- Prepísať `mixAdjustments` step ordering
- Property-based tests (random inputs → check idempotency)
- Regression guard (compare s frozen baseline)

**Výhoda:** Rýchly release + systematický fix neskôr

---

## Otázky pre advisora

### Q1: Ktorú možnosť zvoliť?

- **A**: Fix idempotency teraz (6-8h, riziko regresií)
- **B**: Memoization obchádzka (2-3h, core bug ostáva)
- **C**: Hybrid (2h teraz, 6-8h neskôr)

**Moje odporúčanie:** **C (Hybrid)** – ship quick fix, proper fix v P1 s full test coverage.

---

### Q2: Ak ideme na A (fix idempotency), ktorý step má prioritu?

Konfliktné steps:

- **STEP 7**: `applyCashCap` (cash max limit)
- **STEP 7.5**: `applyProfileAssetPolicy` (dyn/crypto/bond9 caps)
- **STEP 8**: `enforceRiskCap` (risk > max → cuts dyn)
- **STEP 10**: `optimizeYield` (risk room → adds dyn)

**Navrhovaný order priority:**

1. **HIGHEST**: `enforceRiskCap` (hard safety limit)
2. **HIGH**: `applyProfileAssetPolicy` (profile logic)
3. **MEDIUM**: `applyCashCap` (practical limit)
4. **LOW**: `optimizeYield` (nice-to-have boost)

**Zmysel:**

- Ak risk > max → **VŽDY** znížiť (bezpečnosť)
- Ak profil má caps → **VŽDY** rešpektovať (logika)
- Ak cash > limit → aplikovať iba ak neporušuje vyššie priority
- Yield boost → aplikovať iba ak nič nevadí

**Súhlasíš?**

---

### Q3: Test matrix freeze – ktoré scenáre?

**Návrh (15 scenárov):**

**STARTER band (<50k):**

- 0/300/30 (konzervativny, vyvazeny, rastovy)
- 5k/200/25 (konzervativny, vyvazeny, rastovy)

**CORE band (50k-100k):**

- 10k/500/20 (konzervativny, vyvazeny, rastovy)
- 30k/300/15 (konzervativny, vyvazeny, rastovy)

**PREMIUM band (≥100k):**

- 50k/1000/15 (konzervativny, vyvazeny, rastovy)
- 100k/2000/10 (konzervativny, vyvazeny, rastovy)

**Edge cases:**

- 0/0/0 (empty plan)
- 500k/0/10 (pure lump sum)
- 0/5000/30 (pure monthly, high)

**Total:** 18 testov (15 matrix + 3 edge)

**Súhlasíš s týmto scope?**

---

### Q4: Kedy ship P0?

**Ak Možnosť A (fix idempotency teraz):**

- Potrebujem 6-8h + regression testing
- Ship: **zajtra popoludní** (02.12.2025 ~16:00)

**Ak Možnosť B (memoization):**

- Potrebujem 2-3h
- Ship: **dnes večer** (01.12.2025 ~18:00)

**Ak Možnosť C (hybrid):**

- Quick fix: 2-3h (ship dnes večer)
- Proper fix: P1 (schedule na 03.12.2025)

**Preferencia?**

---

## Next steps (čakám na odpovede)

1. **Advisor decision**: A / B / C?
2. **Step priority**: Súhlas s enforceRiskCap > ProfilePolicy > CashCap > Optimizer?
3. **Test matrix**: Súhlas s 18 scenármi?
4. **Ship timeline**: Dnes / zajtra / neskôr?

Po odpovediach pokračujem s implementáciou podľa zvolenej cesty.

---

## Súbory vytvorené

✅ `src/features/portfolio/portfolioEngine.ts` (348 lines)  
✅ `tests/portfolio-engine-idempotency.test.tsx` (117 lines)  
✅ `tests/portfolio-engine-risk-bands.test.tsx` (158 lines)  
✅ `P0-PROGRESS-REPORT.md` (tento report)

---

**Timestamp:** 01.12.2025 14:41  
**Status:** ⏸️ WAITING FOR ADVISOR DECISION (Q1-Q4)
