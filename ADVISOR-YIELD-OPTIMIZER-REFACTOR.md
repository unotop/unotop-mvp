# ADVISOR BRIEF: Yield Optimizer Refactor (PR-36 Phase 2)

**Dátum:** 2026-01-08  
**Priorita:** HIGH (P0 – regression po bond13 update)  
**Autor:** Adam (unotop)  
**Status:** HOTFIX aplikovaný (PR-36), full refactor potrebný

---

## 🔴 EXECUTIVE SUMMARY

**Problém:** Po zvýšení bond yield z 9% na 13% appka **nezačala generovať vyššie výnosy**, ale namiesto toho **znížila alokáciu bond13** a **zvýšila zlato**. Optimizer sa **zastavuje predčasne** kvôli arbitrary cap na výnos boost.

**Root cause:** `MAX_BOOST_BY_PROFILE` limit (0.8%/1.2%/2.0% pre C/B/G) bol navrhnutý pre bond 9%, ale pri bond 13% sa vyčerpá **príliš skoro** → optimizer STOP pred dosiahnutím max výnosu.

**Hotfix (PR-36):** Zvýšili sme MAX_BOOST o 80-100% (1.5%/2.0%/3.0%), čo **obnoví pôvodné správanie**.

**Long-term riešenie:** Odstrániť MAX_BOOST caps úplne, použiť **iba risk budget** ako prirodzený limiter.

---

## 📊 REGRESNÁ ANALÝZA

### Test case: 10000 EUR lump sum / 300 EUR monthly / 20 rokov

| Profil            | Metrika    | PRED (bond 9%) | PO (bond 13%, broken)    | OČAKÁVANÉ (bond 13%, fixed) |
| ----------------- | ---------- | -------------- | ------------------------ | --------------------------- |
| **Konzervatívny** | bond %     | 19%            | **18%** ❌ (klesol!)     | **22-25%** ✅               |
|                   | zlato %    | 27%            | **27%** (bez zmeny)      | **23-25%** (menej)          |
|                   | výnos p.a. | 8.5%           | **~8.3%** ❌             | **~9.5-10%** ✅             |
|                   | risk       | 4.2            | 4.0                      | 4.0 (v limite)              |
| **Vyvážený**      | bond %     | 13%            | **17%** ⚠️ (mierne rast) | **19-21%** ✅               |
|                   | výnos p.a. | 14.2%          | **~14.5%** ⚠️            | **~15.5-16%** ✅            |
|                   | risk       | 7.4            | 7.2                      | 7.2 (v limite)              |
| **Rastový**       | bond %     | 10%            | **13%** ⚠️ (mierne rast) | **14-16%** ✅               |
|                   | výnos p.a. | 20.5%          | **~21%** ⚠️              | **~22-23%** ✅              |
|                   | risk       | 8.9            | 8.7                      | 8.7 (v limite)              |

**Kľúčové zistenie:** Appka **nedokáže využiť** zvýšenie bond yield, pretože optimizer je **umelými caps obmedzený**.

---

## 🔍 TECHNICKÁ ANALÝZA

### Súčasný stav (2026-01-08)

#### 1. MAX_BOOST_BY_PROFILE (yieldOptimizer.ts, riadok 78-95)

```typescript
const MAX_BOOST_BY_PROFILE = {
  konzervativny: 0.015, // max +1.5% boost (HOTFIX: ↑ z 0.8%)
  vyvazeny: 0.02, // max +2.0% boost (HOTFIX: ↑ z 1.2%)
  rastovy: 0.03, // max +3.0% boost (HOTFIX: ↑ z 2.0%)
};
```

**Pôvodný účel (PR-31):** Zabrániť Conservative profile dostať vyšší boost ako Growth (hierarchy violation).

**Prečo je to zlé:**

- ❌ **Arbitrary limit** – žiadna ekonomická/matematická podstata
- ❌ **Statický** – nereaguje na zmeny v asset yields
- ❌ **Regresný** – pri zvýšení bond yield sa vyčerpá skôr
- ❌ **Komplikuje reasoning** – výnos by mal byť limitovaný **iba risk cap**, nie boost %

**Konkrétny príklad (Conservative, bond 9%):**

1. Move "cash → bond9" (2 p.b.): +0.25% yield
2. Move "gold → bond9" (2 p.b.): +0.20% yield
3. Move "bonds7.5 → bond9" (2 p.b.): +0.15% yield
4. Move "cash → bonds7.5" (2 p.b.): +0.10% yield
5. **STOP** (total +0.70%, blízko 0.8% cap)

**Konkrétny príklad (Conservative, bond 13%, BROKEN):**

1. Move "cash → bond13" (2 p.b.): +0.35% yield ← **vyšší gain!**
2. Move "gold → bond13" (2 p.b.): +0.30% yield
3. **STOP** (total +0.65%, ale ešte by mal ísť move "bonds7.5 → bond13" +0.20%!)
4. **VÝSLEDOK:** bond13 dostane **menej %** ako bond9 mal predtým!

**Konkrétny príklad (Conservative, bond 13%, HOTFIXED):**

1. Move "cash → bond13" (2 p.b.): +0.35% yield
2. Move "gold → bond13" (2 p.b.): +0.30% yield
3. Move "bonds7.5 → bond13" (2 p.b.): +0.20% yield
4. Move "cash → bonds7.5" (2 p.b.): +0.10% yield
5. Move "gold → etf" (2 p.b.): +0.15% yield
6. **STOP** (total +1.10%, blízko 1.5% cap)
7. **VÝSLEDOK:** bond13 dostane **viac %**, výnos ~9.5-10% ✅

---

#### 2. YIELD_MOVES (yieldOptimizer.ts, riadok 45-56)

```typescript
const YIELD_MOVES: Array<{
  from: MixItem["key"];
  to: MixItem["key"];
  amount: number; // Percentuálne body na presun
  description: string;
}> = [
  // High-impact moves (veľký nárast yield)
  { from: "cash", to: "bond3y9", amount: 2, description: "IAD DK → Bond 13%" },
  { from: "gold", to: "bond3y9", amount: 2, description: "Zlato → Bond 13%" },
  {
    from: "bonds",
    to: "bond3y9",
    amount: 2,
    description: "Bond 7.5% → Bond 13%",
  },

  // Medium-impact moves (stredný nárast yield)
  { from: "cash", to: "bonds", amount: 2, description: "IAD DK → Bond 7.5%" },
  { from: "gold", to: "etf", amount: 2, description: "Zlato → ETF" },
  { from: "cash", to: "etf", amount: 2, description: "IAD DK → ETF" },

  // Conservative moves (malý nárast yield, malé riziko)
  { from: "cash", to: "gold", amount: 2, description: "IAD DK → Zlato" },
];
```

**Problém:**

- ❌ **Hardcoded zoznam** – nereflektuje aktuálne asset yields
- ❌ **Fixed ordering** – pri zmene yields (9% → 13%) by sa malo poradie zmeniť, ale nezmení
- ❌ **Statický amount** – vždy 2 p.b., bez ohľadu na dostupnosť zdroja

**Ideálne správanie:**

- ✅ **Dynamic ordering** – zoraď moves podľa `yield_delta × risk_delta` (greedy heuristic)
- ✅ **Adaptive amounts** – skús najprv 2 p.b., potom 1 p.b., 0.5 p.b. ak zdroj vyčerpaný
- ✅ **Profile-aware** – Conservative preferuje low-risk moves, Growth high-yield moves

---

#### 3. applySafetyPass (yieldOptimizer.ts, riadok 180-245)

```typescript
function applySafetyPass(mix: MixItem[], riskPref: RiskPref, ...): void {
  // STEP 1: Clamp všetky assets ktoré presahujú caps
  for (const item of mix) {
    if (cap !== undefined && item.pct > cap) {
      const overflow = item.pct - cap;
      item.pct = cap;
      totalOverflow += overflow;
    }
  }

  // STEP 2: Redistribute overflow do safety sinks
  const safetySinks =
    riskPref === "konzervativny"
      ? [
          { key: "bond3y9", weight: 0.5 },
          { key: "bonds", weight: 0.3 },
          { key: "gold", weight: 0.2 },
        ]
      : ...;
}
```

**Problém:**

- ⚠️ **Redistribúcia do safety sinks** môže **znížiť bond13 %** ak optimizer nevyčerpal plný potenciál
- ⚠️ **Weights sú fixed** – nezohľadňujú aktuálne yields

**Príklad (Conservative, broken optimizer):**

1. Optimizer STOP pri bond13 = 18% (lebo MAX_BOOST = 0.8%)
2. ETF/dyn presahujú caps (overflow 5 p.b.)
3. Safety pass redistribuuje: bond13 +2.5%, bonds7.5% +1.5%, gold +1%
4. **VÝSLEDOK:** bond13 = 20.5%, ale **mohol byť 24%** ak by optimizer neskončil predčasne!

---

### Flow diagramy

#### Súčasný flow (BROKEN pri bond 13%)

```
START: mix po enforceRiskCap
  ↓
STEP 1: Optimizer hľadá best move (iteruje YIELD_MOVES)
  ↓
STEP 2: Move "cash → bond13" (+0.35% yield)
  totalBoost = 0.35%
  ↓
STEP 3: Move "gold → bond13" (+0.30% yield)
  totalBoost = 0.65%
  ↓
STEP 4: Check MAX_BOOST
  IF totalBoost >= 0.8% → STOP ❌
  ELSE continue
  ↓
RESULT: bond13 dostal len 18% (namiesto 24%)
  Safety pass redistribuoval overflow do zlata
```

#### Ideálny flow (Phase 2 refactor)

```
START: mix po enforceRiskCap
  ↓
STEP 1: Dynamicky vygeneruj YIELD_MOVES z ASSET_PARAMS
  Zoraď podľa: (yield_to - yield_from) × risk_weight
  ↓
STEP 2: Iteratívne aplikuj moves (greedy)
  STOP ak: risk > maxRiskForOptimizer (risk cap + headroom)
  ↓
STEP 3: Profile hierarchy check
  IF C_yield > B_yield OR B_yield > G_yield:
    Clamp C/B yields, redistribute do safe assets
  ↓
RESULT: MAX výnos v rámci risk budgetu
  Safety pass je len fallback (edge cases)
```

---

## ✅ RIEŠENIE (Phase 2 Implementation Plan)

### Variant 1: Odstránenie MAX_BOOST (RECOMMENDED)

**Zmeny:**

1. **Zmaž MAX_BOOST_BY_PROFILE** úplne (riadok 78-95)
2. **Jediný limiter:** `maxRiskForOptimizer = riskMax + 0.5` (už existuje, riadok 307)
3. **Post-optimization check:** `ensureProfileHierarchy()` (už existuje v mixAdjustments.ts)

**Kód (yieldOptimizer.ts):**

```typescript
// REMOVE:
// const MAX_BOOST_BY_PROFILE = { ... };
// const maxBoost = MAX_BOOST_BY_PROFILE[riskPref] ?? 0.012;

// KEEP ONLY:
const maxRiskForOptimizer = riskMax + 0.5; // Headroom pre optimizer

// Main loop:
for (let iterations = 0; iterations < MAX_OPTIMIZER_ITERATIONS; iterations++) {
  const currentRisk = riskScore0to10(mix);

  // SINGLE STOP CONDITION:
  if (currentRisk > maxRiskForOptimizer) {
    console.log(`[YieldOptimizer] STOP: Risk nad limitom`);
    break;
  }

  // NO MAX_BOOST CHECK!

  // ... rest of logic ...
}

// POST-OPTIMIZATION: Ensure hierarchy (v mixAdjustments.ts už existuje)
ensureProfileHierarchy([conservativeMix, balancedMix, growthMix]);
```

**Výhody:**

- ✅ **Prirodzený limit** (risk cap), nie arbitrary %
- ✅ **Maximalizuje výnos** v rámci risk budgetu
- ✅ **Jednoduché** – menej kódu, menej edge cases
- ✅ **Zachováva hierarchiu** cez `ensureProfileHierarchy()`

**Riziká:**

- ⚠️ **Hierarchy violations** – Conservative môže dostať vyšší yield ako Growth (ak má lepší starting mix)
- 🛡️ **Mitigation:** `ensureProfileHierarchy()` post-check (už implementované v PR-30)

**Testovanie:**

- Test case: 10000/300/20 (konzervativny) → yield by mal byť ~9.5-10% (nie 8.5%)
- Test case: 10000/300/20 (rastovy) → yield by mal byť ~22-23% (nie 20.5%)
- Invariant: C_yield ≤ B_yield ≤ G_yield (tolerance ±0.5%)

---

### Variant 2: Dynamic YIELD_MOVES + risk-based MAX_BOOST

**Zmeny:**

1. **Generuj YIELD_MOVES dynamicky** z `ASSET_PARAMS`
2. **MAX_BOOST** naviazaný na risk room: `maxBoost = (riskMax - currentRisk) × 0.5`
3. **Adaptive ordering** – high-yield moves na začiatok

**Kód (yieldOptimizer.ts):**

```typescript
function generateYieldMoves(
  currentMix: MixItem[],
  riskPref: RiskPref
): typeof YIELD_MOVES {
  const moves: typeof YIELD_MOVES = [];

  for (const fromKey of Object.keys(ASSET_PARAMS) as AssetKey[]) {
    for (const toKey of Object.keys(ASSET_PARAMS) as AssetKey[]) {
      if (fromKey === toKey) continue;

      const yieldDelta =
        ASSET_PARAMS[toKey].expectedReturnPa -
        ASSET_PARAMS[fromKey].expectedReturnPa;
      const riskDelta =
        ASSET_PARAMS[toKey].riskScore - ASSET_PARAMS[fromKey].riskScore;

      // Greedy score: prefer high yield delta, low risk delta
      const score = yieldDelta - riskDelta * 0.01; // Risk penalty

      if (score > 0) {
        moves.push({
          from: fromKey,
          to: toKey,
          amount: 2, // Default, can be adaptive
          description: `${ASSET_PARAMS[fromKey].label} → ${ASSET_PARAMS[toKey].label}`,
          score, // For sorting
        });
      }
    }
  }

  // Sort by score DESC (best moves first)
  return moves.sort((a, b) => b.score - a.score);
}

// In optimizeYield():
const YIELD_MOVES = generateYieldMoves(mix, riskPref);

// Dynamic MAX_BOOST based on risk room:
const riskRoom = maxRiskForOptimizer - initialRisk;
const maxBoost = riskRoom * 0.5; // 50% of risk room converted to yield boost
```

**Výhody:**

- ✅ **Adaptívne** – moves sa menia podľa asset yields
- ✅ **Greedy** – najlepšie moves najprv
- ✅ **Risk-aware** – MAX_BOOST naviazaný na risk budget

**Riziká:**

- ⚠️ **Komplexnosť** – viac kódu, viac edge cases
- ⚠️ **Performance** – generovanie moves každý run (cache?)

---

### Variant 3: Kombinovaný (TOP TIER, ale najzložitejší)

**Zmeny:**

1. **Dynamic YIELD_MOVES** (Variant 2)
2. **Odstránenie MAX_BOOST** (Variant 1)
3. **Profile hierarchy check** post-optimization
4. **Adaptive amounts** – skúšaj 2 p.b., potom 1 p.b., 0.5 p.b.

**Implementačný čas:** ~8-12 hodín (complex refactor + testy)

---

## 🎯 ODPORÚČANIE PRE ADVISORA

### Immediate (PR-36 hotfix) ✅ DONE

- [x] Zvýš MAX_BOOST_BY_PROFILE o 80-100%
- [x] Testy: 17/17 PASS
- [x] Build: PASS

### Phase 2 (PR-37, ETA 2-3 dni)

**Preferované riešenie: VARIANT 1** (odstránenie MAX_BOOST)

**Dôvody:**

1. **Najjednoduchšie** – najmenej kódu, najmenej rizík
2. **Ekonomicky správne** – výnos má byť limitovaný iba risk cap
3. **Testovateľné** – existujúce testy by mali prejsť (alebo s minor updates)
4. **Backwards compatible** – `ensureProfileHierarchy()` už existuje

**Implementačné kroky:**

1. Zmaž `MAX_BOOST_BY_PROFILE` (yieldOptimizer.ts, riadok 78-95)
2. Odober `maxBoost` check z main loop (riadok 314-328)
3. Ponechaj iba `maxRiskForOptimizer` check (riadok 332-337)
4. Update unit tests (business.yield-calibration.test.tsx):
   - Remove `maxBoost` assertions
   - Verify optimizer stops at risk limit (not boost limit)
5. Acceptance tests (manual):
   - 10000/300/20 C → yield ~9.5-10%, bond13 ~22-25%
   - 10000/300/20 B → yield ~15.5-16%, bond13 ~19-21%
   - 10000/300/20 G → yield ~22-23%, bond13 ~14-16%
6. Verify hierarchy: C_yield ≤ B_yield ≤ G_yield (ensureProfileHierarchy post-check)

**Rollback plan:**

- Ak Phase 2 zlyhá → revert PR-37, ostať pri hotfixed MAX_BOOST (1.5%/2.0%/3.0%)

---

## 📋 AKCEPTAČNÉ KRITÉRIÁ (Phase 2)

### Funkcionálne

- [ ] Pri bond13 (yield 0.13) optimizer **alokuje viac %** ako pri bond9 (yield 0.09)
- [ ] Conservative 10000/300/20: výnos **≥ 9.5%** (bolo 8.5%), bond13 **≥ 22%** (bolo 19%)
- [ ] Balanced 10000/300/20: výnos **≥ 15.5%** (bolo 14.2%), bond13 **≥ 19%** (bolo 13%)
- [ ] Growth 10000/300/20: výnos **≥ 22%** (bolo 20.5%), bond13 **≥ 14%** (bolo 10%)
- [ ] Risk skoré **≤ riskMax** pre všetky profile (invariant)

### Hierarchia

- [ ] `C_yield ≤ B_yield ≤ G_yield` (tolerance ±0.5%)
- [ ] `C_risk ≤ B_risk ≤ G_risk` (tolerance ±0.5)
- [ ] Ak hierarchy violation → `ensureProfileHierarchy()` opraví

### Regresné testy

- [ ] 17/17 critical tests PASS
- [ ] Build PASS (no errors)
- [ ] Manual QA: 5 testovacích scenárov (STARTER/CORE/ESTABLISHED/PREMIUM/ELITE)

---

## 🧪 TESTOVACÍ PLÁN

### Unit tests (vitest)

```typescript
// tests/business.yield-optimizer-v2.test.tsx
describe("YieldOptimizer v2 (Phase 2 - No MAX_BOOST)", () => {
  it("should maximize yield up to risk limit (not boost limit)", () => {
    const mix = [
      { key: "cash", pct: 20 },
      { key: "gold", pct: 20 },
      { key: "bonds", pct: 20 },
      { key: "bond3y9", pct: 10 },
      { key: "etf", pct: 30 },
    ];

    const result = optimizeYield(mix, "konzervativny", 50000, 5, 4.5);

    // BEFORE: result.finalYield - result.initialYield ≤ 0.008 (MAX_BOOST)
    // AFTER: No boost limit, only risk limit
    expect(result.finalRisk).toBeLessThanOrEqual(4.5 + 0.01); // Risk cap
    expect(result.finalYield).toBeGreaterThan(result.initialYield + 0.008); // Can exceed old boost cap
    expect(result.moves.length).toBeGreaterThan(3); // More moves applied
  });

  it("should prefer bond13 over bond7.5 when both available", () => {
    const mix = [
      { key: "cash", pct: 10 },
      { key: "bonds", pct: 20 }, // bond7.5
      { key: "bond3y9", pct: 10 }, // bond13
      { key: "etf", pct: 60 },
    ];

    const result = optimizeYield(mix, "vyvazeny", 50000, 5, 6.0);

    // bond13 should INCREASE more than bonds7.5
    const bond13Final = result.mix.find((m) => m.key === "bond3y9")!.pct;
    const bonds75Final = result.mix.find((m) => m.key === "bonds")!.pct;

    expect(bond13Final).toBeGreaterThan(10 + 5); // At least +5 p.b.
    expect(bonds75Final).toBeLessThan(20); // Decreased (moved to bond13)
  });
});
```

### Acceptance tests (manual, Netlify preview)

| Scenario | Profile      | Inputs            | Expected Yield | Expected bond13 % | Expected Risk |
| -------- | ------------ | ----------------- | -------------- | ----------------- | ------------- |
| A1       | Conservative | 10k / 300 / 20y   | ≥ 9.5%         | ≥ 22%             | ≤ 4.5         |
| A2       | Balanced     | 10k / 300 / 20y   | ≥ 15.5%        | ≥ 19%             | ≤ 6.5         |
| A3       | Growth       | 10k / 300 / 20y   | ≥ 22%          | ≥ 14%             | ≤ 8.0         |
| B1       | Conservative | 100k / 1000 / 30y | ≥ 10%          | ≥ 24%             | ≤ 4.5         |
| B2       | Growth       | 100k / 1000 / 30y | ≥ 23%          | ≥ 15%             | ≤ 8.5         |

**QA checklist:**

- [ ] Všetky scenáre splnené
- [ ] UI zobrazuje správne % (match mix z console.log)
- [ ] Projekcia graf reflektuje vyšší výnos (FV vyššie)
- [ ] Share modal obsahuje správny mix (bond13 %, nie bond9 %)

---

## 📈 OČAKÁVANÝ DOPAD

### Before (bond 9%, MAX_BOOST 0.8%/1.2%/2.0%)

- Conservative 10k/300/20: **8.5% yield**, bond9 19%
- Balanced 10k/300/20: **14.2% yield**, bond9 13%
- Growth 10k/300/20: **20.5% yield**, bond9 10%

### After Hotfix (bond 13%, MAX_BOOST 1.5%/2.0%/3.0%) ← CURRENT

- Conservative 10k/300/20: **~9.0% yield**, bond13 ~20%
- Balanced 10k/300/20: **~15.0% yield**, bond13 ~17%
- Growth 10k/300/20: **~21.5% yield**, bond13 ~13%

### After Phase 2 (bond 13%, NO MAX_BOOST) ← TARGET

- Conservative 10k/300/20: **9.5-10% yield**, bond13 22-25%
- Balanced 10k/300/20: **15.5-16% yield**, bond13 19-21%
- Growth 10k/300/20: **22-23% yield**, bond13 14-16%

**Zlepšenie:**

- Conservative: **+0.5-1.0 p.p.** yield, **+3-5 p.b.** bond13
- Balanced: **+0.5-1.0 p.p.** yield, **+2-4 p.b.** bond13
- Growth: **+0.5-1.5 p.p.** yield, **+1-3 p.b.** bond13

---

## 🚨 RIZIKÁ & MITIGATION

### Riziko 1: Hierarchy violations (C_yield > B_yield)

**Pravdepodobnosť:** LOW (ensureProfileHierarchy post-check už existuje)  
**Dopad:** MEDIUM (používateľ vidí Conservative s vyšším výnosom ako Growth)  
**Mitigation:**

- Call `ensureProfileHierarchy()` po optimizer (už implementované v PR-30)
- Ak violation → clamp C/B yields, redistribute do safe assets
- Log warning do console pre debugging

### Riziko 2: Risk cap violations (risk > riskMax)

**Pravdepodobnosť:** VERY LOW (optimizer má `maxRiskForOptimizer` check)  
**Dopad:** HIGH (break invariant)  
**Mitigation:**

- Failsafe check po optimizer: `if (risk > riskMax) → enforceRiskCap()`
- Unit test: verify all scenarios stay under riskMax

### Riziko 3: Performance degradation (no boost cap → viac iterácií)

**Pravdepodobnosť:** LOW (MAX_OPTIMIZER_ITERATIONS = 20 limit už existuje)  
**Dopad:** LOW (~10-20ms extra computing time)  
**Mitigation:**

- Keep MAX_OPTIMIZER_ITERATIONS = 20 (hard cap)
- Early stop ak `currentRisk > maxRiskForOptimizer`

### Riziko 4: Broken tests (old assertions on MAX_BOOST)

**Pravdepodobnosť:** MEDIUM (business.yield-calibration.test.tsx má MAX_BOOST checks)  
**Dopad:** LOW (fix assertions)  
**Mitigation:**

- Update test assertions: remove `maxBoost` checks, verify risk limit instead
- Run full test suite (npm run test) pred merge

---

## 📦 DELIVERABLES

### PR-36 (HOTFIX) ✅ DONE

- [x] Zvýšený MAX_BOOST_BY_PROFILE (1.5%/2.0%/3.0%)
- [x] Tests: 17/17 PASS
- [x] Build: PASS
- [x] Ready to merge → main

### PR-37 (Phase 2 Refactor) 🚧 TODO

- [ ] Remove MAX_BOOST_BY_PROFILE (yieldOptimizer.ts)
- [ ] Update unit tests (remove boost assertions)
- [ ] Manual QA (5 test scenarios)
- [ ] Update CHANGELOG.md
- [ ] Advisor review → merge → prod

**ETA:** 2-3 dni (coding 4h, testing 4h, review 1h)

---

## 🔗 SÚVISIACE PR / ISSUES

- **PR-31:** Yield optimizer (zaviedol MAX_BOOST)
- **PR-34:** Gold policy (zaviedol safety pass)
- **PR-36:** bond13 update + hotfix (tento dokument)
- **PR-30:** ensureProfileHierarchy (použijeme v Phase 2)
- **PR-29:** ASSET_PARAMS (single source of truth pre yields)

---

## ✍️ ADVISOR NOTES

**Otázky pre review:**

1. Súhlasíš s VARIANT 1 (remove MAX_BOOST) ako preferovaným riešením?
2. Máme implementovať `ensureProfileHierarchy()` ako hard constraint (clamp) alebo soft warning?
3. Potrebujeme dynamické YIELD_MOVES (Variant 2) alebo statický zoznam stačí?
4. Chceš unit tests pre všetky 3 profile naraz (cross-profile consistency) alebo jednotlivo?

**TODO pred začatím Phase 2:**

- [ ] Advisor approval (tento dokument)
- [ ] Code freeze na iné features (aby sme izolovali zmeny)
- [ ] Backup prod verzie (rollback plan)
- [ ] Netlify preview branch pre QA (branch: `feat/pr-37-remove-max-boost`)

---

**Prepared by:** Adam (unotop)  
**Date:** 2026-01-08  
**Status:** READY FOR REVIEW  
**Next action:** Advisor approval → start PR-37 implementation
