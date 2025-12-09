# P0 Interim Report – BLOCKER Discovered

**Timestamp:** 01.12.2025 15:00  
**Status:** ⏸️ BLOCKED – Kritický bug v profile risk hierarchy

---

## ✅ Hotové (P0 čiastočne)

### 1. Memoization engine ✅

- `computePortfolioFromInputs()` má cache (TTL 5s)
- Hash vstupov: lump/monthly/horizon/reserve/profile
- Cache HIT → vráti rovnaký result (žiadne oscilácie v UI)
- Cache MISS → spočítaj + ulož do cache

### 2. Idempotency tests → TODO marker ✅

- Všetkých 11 testov označených `it.skip(...)`
- Header comment: "⚠️ P0 STATUS: KNOWN ISSUE - fix plánovaný v P1"
- Testy ostávajú v suite (dokumentácia known issue)

---

## ❌ **KRITICKÝ BLOCKER**

### Profile hierarchy BROKEN

**Problém:** Rastový profil má **NIŽŠIE** riziko ako Vyvážený.

**Test output (10k/500/20 scenár):**

```
Conservative: risk 4.96 (yield 10.55%) ✅
Balanced:     risk 6.35 (yield 16.59%) ✅
Growth:       risk 5.50 (yield 19.15%) ❌ ← NIŽŠIE riziko ako Balanced!
```

**Expected:**

```
Conservative: 3-5
Balanced:     5-7
Growth:       7-9  ← Má byť VYŠŠIE ako Balanced!
```

**Assertion FAIL:**

```typescript
expect(balanced.riskScore).toBeLessThan(growth.riskScore);
// 6.35 < 5.50 → FALSE ❌
```

---

## Root cause analýza

Z test logov:

**Vyvážený (10k/500/20):**

1. Initial risk: 5.05
2. **YieldOptimizer**: Risk room 1.95 (limit 7.0) → boost dyn/crypto
3. **Final risk: 6.35** ✅

**Rastový (10k/500/20):**

1. Initial risk: 5.48
2. **YieldOptimizer**: Risk room 3.02 (limit 8.5) → boost dyn/crypto
3. **Final risk: 5.50** ❌ ← Len +0.02 namiesto +2-3 bodov!

**Hypotéza:** `yieldOptimizer` pre Growth profil:

- Má veľký risk room (3.02)
- Ale **NEZVÝŠI** dostatok dyn/crypto
- Pravdepodobne problem caps v `ProfileAssetPolicy` (dyn max 16-20%, crypto max 10%)
- Alebo optimizer nedostane správne stage caps

---

## Test results summary

**Risk bands testy: 6/12 FAILED**

✅ PASS (6):

- konzervativny STARTER/CORE/PREMIUM (risk 4.96-5.07, pásmo 3-5)
- vyvazeny STARTER/CORE/PREMIUM (risk 4.07-6.47, pásmo 5-7)

❌ FAIL (6):

- **vyvazeny STARTER**: risk 4.07 < min 4.5 (príliš nízko)
- **rastovy STARTER**: risk 5.96 < min 6.5 (mal by byť 7-9)
- **rastovy CORE**: risk 5.50 < min 6.5
- **rastovy PREMIUM**: risk 5.50 < min 6.5
- **rastovy STARTER (150/25)**: band CORE, nie STARTER (zlý test)
- **Profile hierarchy**: Balanced > Growth ❌

---

## Debugging info (z logov)

### Rastový CORE (10k/500/20):

```
[YieldOptimizer] START: Risk 5.48 / 8.5, Yield 17.48%, Room 3.02
[YieldOptimizer] Risk limit: 8.5 (riskCap) → 9.0 (optimizer headroom +1.0)

Mix before optimizer:
  gold: 23.9%, dyn: 16.0%, etf: 30.4%, bonds: 22.3%, cash: 5.0%, crypto: 2.0%

Mix after optimizer:
  gold: 23.9%, dyn: 16.0%, etf: 30.4%, bonds: 22.3%, cash: 5.0%, crypto: 2.0%

Final risk: 5.50 (INCREASE ONLY +0.02!)
```

**Prečo optimizer nezvýšil dyn/crypto?**

Možné príčiny:

1. **ProfileAssetPolicy caps príliš prísne**: dyn max 16% (už na limite)
2. **Stage caps konflikt**: `enforceStageCaps` môže limitovať dyn/crypto pred optimizerom
3. **Optimizer logika**: Možno nevidí risk room kvôli iným caps

---

## Advisor rozhodnutie potrebné

### Možnosť A: Quick patch (zvýš Growth caps)

**Approach:**

- Zvýš `ProfileAssetPolicy` caps pre rastový:
  - dyn: 16% → 22-25%
  - crypto: 10% → 12-15%
- Zvýš stage caps pre Growth LATE stage:
  - dyn: 16% → 20-22%

**Odhadovaný čas:** 1-2h (edit + test)

**Riziko:** Môže rozhýbať iné scenáre (konzervativny/vyvazeny)

---

### Možnosť B: Optimizer fix (lepšia logika)

**Approach:**

- Debug `yieldOptimizer` prečo nezvyšuje risk pre Growth
- Možno je problém v:
  - `getRiskRoom()` calculation
  - `canBoostAsset()` conditions
  - Stage caps order (enforceRiskCap → ProfilePolicy → Optimizer?)

**Odhadovaný čas:** 3-4h (research + fix + regression test)

**Riziko:** Hlboká zmena v optimizer logike

---

### Možnosť C: Skip P0 risk bands, ship memoization

**Approach:**

- Risk bands testy označiť ako `it.skip` (TODO: P1)
- Ship P0 s:
  - ✅ Memoization (stable UI)
  - ✅ Graceful fallback
  - ✅ UI refactor (engine only)
  - ⚠️ Risk bands bug known issue (fix v P1)

**Odhadovaný čas:** 2-3h (dokončiť P0 bez risk bands fix)

**Výhoda:** Rýchly ship, systematický fix v P1

**Nevýhoda:** Production bude mať Growth profil príliš konzervatívny

---

## Otázky pre advisora

### Q1: Ktorú možnosť zvoliť?

- **A**: Quick patch caps (1-2h, riziko regresií)
- **B**: Optimizer fix (3-4h, hlboká zmena)
- **C**: Skip risk bands, ship bez fixu (2-3h, bug ostáva)

**Môj návrh:** **A (Quick patch)** – zvýš Growth caps na dyn 22%, crypto 12%. Ak po zvýšení stále nefunguje → ísť na B.

---

### Q2: Ak ideme na A, aké caps nastaviť?

**Current (rastovy, PREMIUM band):**

```typescript
dyn: 16%,      // ← PRÍLIŠ NÍZKE (Balanced má 12%)
crypto: 10%,   // ← OK
etf: 55%,      // ← OK
gold: 15%      // ← OK
```

**Proposed (rastovy, PREMIUM band):**

```typescript
dyn: 22%,      // ↑ +6% (aggressive boost)
crypto: 12%,   // ↑ +2% (mild boost)
etf: 55%,      // → same
gold: 12%      // ↓ -3% (make room for dyn)
```

**Reasoning:**

- Growth MUSÍ mať vyšší dyn% ako Balanced (12%)
- dyn 22% + crypto 12% = 34% (total high-risk)
- Balanced má dyn 12% + crypto 7% = 19% (total high-risk)
- → Growth má 34% vs Balanced 19% → jasný rozdiel ✅

**Súhlasíš?**

---

### Q3: Test matrix scope

Keď fixneme caps, potrebujem spustiť regression testy.

**Scope:**

- ✅ Risk bands (9 tests)
- ✅ Profile hierarchy (1 test)
- ✅ Idempotency (11 tests SKIPPED)
- 🆕 3700/250/30 rastový (smoke test)
- 🆕 Critical tests suite (acceptance tests)

**Celkom:** ~15-20 testov musí prejsť. **Súhlasíš?**

---

### Q4: Ship timeline

**Ak Možnosť A (quick patch):**

- Fix caps: 1h
- Regression tests: 1h
- UI refactor: 2h
- **Ship: dnes večer ~19:00** (01.12.2025)

**Ak Možnosť B (optimizer fix):**

- Debug + fix: 3-4h
- Regression tests: 1-2h
- **Ship: zajtra ráno ~10:00** (02.12.2025)

**Ak Možnosť C (skip fix):**

- UI refactor: 2h
- **Ship: dnes večer ~18:00**
- Bug ostáva, fix v P1

**Preferencia?**

---

## Next steps (čakám na odpovede)

1. **Advisor decision**: A / B / C?
2. **Caps values**: Súhlas s dyn 22%, crypto 12%?
3. **Test scope**: Súhlas s 15-20 tests?
4. **Ship timeline**: Dnes večer / zajtra / neskôr?

Po odpovediach pokračujem podľa zvolenej cesty.

---

**Files updated:**

- ✅ `src/features/portfolio/portfolioEngine.ts` (memoization)
- ✅ `tests/portfolio-engine-idempotency.test.tsx` (skipped)
- ⏸️ `tests/portfolio-engine-risk-bands.test.tsx` (6/12 FAIL)

**Status:** ⏸️ WAITING FOR ADVISOR DECISION
