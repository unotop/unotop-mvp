# PR-31 KRITICKÝ PROBLÉM: Conservative > Growth pre 500 EUR/m

## Zhrnutie

**CONFIRMED:** Conservative profil má **vyšší yield** ako Growth pre mesačný vklad **500 EUR** (bez lump sum).

```
500 EUR/mesiac, 0 EUR vstup, 21 rokov:
  Conservative: 7.86% p.a. ❌
  Growth:       7.54% p.a. ❌

ROZDIEL: Conservative o +0.32% VYŠŠÍ ako Growth!
```

## Test Results (všetky monthly amounts)

| Monthly     | Conservative | Growth    | Status                                        |
| ----------- | ------------ | --------- | --------------------------------------------- |
| 150 EUR     | ?            | ?         | ✅ PASS (qa-profile-hierarchy: 6.18% < 7.05%) |
| 300 EUR     | ?            | ?         | ✅ PASS                                       |
| **500 EUR** | **7.86%**    | **7.54%** | **❌ FAIL**                                   |
| 800 EUR     | 7.54%        | 9.65%     | ✅ PASS                                       |
| 1000 EUR    | 7.54%        | 9.65%     | ✅ PASS                                       |

## Root Cause Analysis

### Yield Optimizer Delta (příčina)

**Conservative 500 EUR/m:**

```
[YieldOptimizer] START: Risk 4.31 / 5.0, Yield 6.49%, Room 0.69
[YieldOptimizer] Move 1: IAD DK → Bond 9% (+0.35% yield, risk 4.36)
[YieldOptimizer] Move 2: IAD DK → Bond 9% (+0.35% yield, risk 4.41)
[YieldOptimizer] Move 3: IAD DK → Bond 9% (+0.35% yield, risk 4.46)
[YieldOptimizer] DONE: Yield 6.49% → 7.86% (+1.37%), Risk 4.31 → 4.46
```

**Growth 500 EUR/m:**

```
[YieldOptimizer] START: Risk 6.68 / 8.5, Yield 7.22%, Room 1.82
[YieldOptimizer] Move 1: IAD DK → Bond 9% (+0.35% yield, risk 6.73)
[YieldOptimizer] Move 2: Zlato → Bond 9% (+0.20% yield, risk 6.63)
[YieldOptimizer] Move 3: Zlato → Bond 9% (+0.20% yield, risk 5.93)
[YieldOptimizer] DONE: Yield 7.22% → 7.54% (+0.32%), Risk 6.68 → 5.93
```

**Porovnanie:**

- Conservative: **+1.37%** boost (3× IAD DK → Bond9 @ 0.35% each)
- Growth: **+0.32%** boost (1× IAD DK @ 0.35% + 2× Zlato @ 0.20%)

**Problém:** Conservative má NIŽŠÍ východziu yield (6.49%), ale dostane VYŠŠÍ boost (1.37%), čo ho posunie NAD Growth!

### Prečo Conservative dostal väčší boost?

1. **Risk Room**: Conservative mal 0.69 room, Growth 1.82 → oba mali dosť priestoru
2. **Move Quality**: Conservative 3× "IAD DK → Bond9" @ 0.35% (high-yield move)
3. **Growth Move Degradation**: Po 1. move musel Growth prejsť na "Zlato → Bond9" @ 0.20% (nižší yield)

**Hypotéza:**

- Conservative mix má viac IAD DK (bonds), takže optimizer má viac "high-yield" moves
- Growth mix má menej IAD DK, takže optimizer rýchlo vyčerpá top moves a musí použiť horší (Zlato)

### Profile Asset Policy (pre 500 EUR = 126k EUR volume)

**Conservative PREMIUM (126k EUR):**

```
[ProfileAssetPolicy] PREMIUM boost: dyn 0.0% → 5% (adding 5.0% from cash/bonds)
[ProfileAssetPolicy] etf: 35.0% → 20.0% (cap enforced, overflow 15.0%)
[ProfileAssetPolicy] cash: 22.5% → 20.0% (cap enforced, overflow 2.5%)
[ProfileAssetPolicy] Redistributing 17.5% overflow to: gold, bonds, bond3y9, cash
  → bonds +14.0%
  → bond3y9 +3.5%
```

**Growth PREMIUM (126k EUR):**

```
[ProfileAssetPolicy] PREMIUM boost: dyn 0.0% → 12% (adding 12.0% from cash/bonds)
```

**Rozdiel:**

- Conservative: ETF capped na 20%, overflow (+17.5%) išiel do bonds/bond9 → viac "fuel" pre optimizer
- Growth: Žiadne capy, dyn boost z bonds → menej bonds na optimization

## Dlhodobé implikácie (prečo to je vážne)

1. **Porušenie základného princípu**: Conservative NESMIE mať vyšší yield ako Growth
2. **Dôvera klientov**: Ak klient vidí Conservative 7.86% vs Growth 7.54%, stratí dôveru v logiku
3. **Test coverage gap**: qa-profile-hierarchy testuje len 150 EUR (37.8k volume), qa-pr31-premium len 207k volume
   - **500 EUR (126k volume) nie je pokrytý žiadnym testom** ← preto sme to nenašli

## Navrhované riešenia

### Riešenie 1: Cap yield optimizer boost (najrýchlejšie)

```typescript
// yieldOptimizer.ts
const MAX_BOOST_BY_PROFILE = {
  konzervativny: 0.008, // max +0.8% boost
  vyvazeny: 0.01, // max +1.0% boost
  rastovy: 0.015, // max +1.5% boost
};

// V runYieldOptimizer():
const maxBoost = MAX_BOOST_BY_PROFILE[riskPref] ?? 0.012;
if (yieldGain >= maxBoost) {
  console.log(`[YieldOptimizer] Max boost ${maxBoost} reached, stopping`);
  break;
}
```

**Pros:** Jednoduché, rýchle, zaručí hierarchiu
**Cons:** Neriešim root cause (Conservative má viac bonds po profile policy)

### Riešenie 2: Adjust profile asset policy (fundamentálne)

```typescript
// profileAssetPolicy.ts - Conservative PREMIUM
maxCaps: {
  bond3y9: 20, // znížiť z 25%
  bonds: 30,   // znížiť z 100%
  etf: 20,     // OK
  // ...
}
```

**Pros:** Rieši root cause (Conservative bude mať menej bonds → menej optimizer fuel)
**Cons:** Komplexnejšie, musím retestovať všetky scenáre

### Riešenie 3: Yield optimizer move priority (sofistikované)

```typescript
// Pred každým move: skontroluj, či výsledok zachováva hierarchiu
const projectedYield = currentYield + yieldGain;
const otherProfilesMaxYield = getMaxYieldForLowerProfiles(riskPref);
if (projectedYield > otherProfilesMaxYield + TOLERANCE) {
  console.log(`[YieldOptimizer] Move would break hierarchy, skipping`);
  continue;
}
```

**Pros:** Najrobustnejšie, zaručí hierarchiu vždy
**Cons:** Potrebujem yield pre všetky profily naraz (expensive)

## Odporúčanie

**Immediate fix (Phase 1):**

- ✅ Riešenie 1: Cap yield optimizer boost (1 hodina práce)
- ✅ Pridať test pre 500 EUR/m (qa-profile-hierarchy-500.test.tsx)

**Long-term fix (Phase 2):**

- ⏳ Riešenie 2: Review profile asset policy caps (Conservative bonds limits)
- ⏳ Pridať tests pre viac volume bands (50k, 100k, 150k, 200k, 250k)

## Test Case (pre Phase 1)

```typescript
// tests/qa-profile-hierarchy-500.test.tsx
it("500 EUR/m: Growth yield >= Conservative yield", () => {
  const profile = {
    lumpSumEur: 0,
    monthlyEur: 500,
    horizonYears: 21,
    // ... (rest of profile)
  };

  const mixC = getAdjustedMix(presetC.mix, {
    ...profile,
    riskPref: "konzervativny",
  });
  const mixG = getAdjustedMix(presetG.mix, { ...profile, riskPref: "rastovy" });

  const yieldC = approxYieldAnnualFromMix(mixC.mix) * 100;
  const yieldG = approxYieldAnnualFromMix(mixG.mix) * 100;

  expect(yieldG).toBeGreaterThanOrEqual(yieldC - 0.1); // tolerance 0.1%
});
```

## Akčný plán

1. **IMMEDIATE (dnes):**
   - [ ] Implementovať MAX_BOOST_BY_PROFILE cap
   - [ ] Pridať test pre 500 EUR/m
   - [ ] Re-run všetky testy (11 + 1 nový)
   - [ ] Commit + push

2. **SHORT-TERM (zajtra):**
   - [ ] Review Conservative PREMIUM bonds caps (20% bond9, 30% bonds?)
   - [ ] Tests pre 300, 500, 700, 900 EUR/m (CORE band coverage)

3. **LONG-TERM (budúci týždeň):**
   - [ ] Refactor yieldOptimizer: cross-profile hierarchy check
   - [ ] Full regression suite (10 scenarios × 3 profiles = 30 tests)

## Záver

**USER BOL V PRÁVE.** Conservative skutočne má vyšší yield ako Growth pre **500 EUR/mesiac** (126k EUR volume).

**Príčina:** Yield optimizer dal Conservative +1.37% boost vs Growth +0.32%, čo Conservative posunulo nad Growth.

**Fix:** Cap optimizer boost podľa profilu (Conservative max +0.8%, Growth max +1.5%).

---

**Test command:**

```bash
npm test -- debug-yields
```

**Expected after fix:**

```
500 EUR/m: Conservative 7.00% < Growth 7.54% ✅
```
