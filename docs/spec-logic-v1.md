# Legacy Logic Specification (spec-logic-v1)

Source snapshot: `src/Stav pred layout.ts` (pre‑modular refactor). This spec freezes the original quantitative logic so we can re‑implement or validate it incrementally without regressions.

---

## 1. Primary User Inputs (state)

| UI Label (SK)                     | Internal Key (legacy) | Domain Meaning                                      | Type / Range           | Default     |
| --------------------------------- | --------------------- | --------------------------------------------------- | ---------------------- | ----------- | ------------ | ------ |
| Mesačný príjem                    | income                | Gross monthly household/individual income           | number ≥ 0             | 1500        |
| Fixné výdavky                     | fixed                 | Fixed monthly expenses                              | number ≥ 0             | 800         |
| Variabilné výdavky                | variable              | Variable monthly expenses                           | number ≥ 0             | 300         |
| Jednorazová investícia            | oneTime               | Initial lump sum invested at t=0                    | number ≥ 0             | 2000        |
| Pravidelná investícia / mes.      | monthlyInvest         | Monthly contribution at period end                  | number ≥ 0             | 200         |
| Horizont (roky)                   | years                 | Investment horizon in years                         | integer ≥1             | 10          |
| Cieľová suma                      | target                | Target future value at horizon                      | number ≥0              | 50000       |
| Cieľ rezervy (mesiace)            | emergencyMonths       | Desired reserve coverage (months of fixed expenses) | integer ≥0             | 6           |
| Súčasná rezerva                   | currentReserve        | Current liquid reserve size                         | number ≥0              | 1500        |
| Scenár výnosov                    | scenario              | Return/risk scenario selector                       | "conservative"         | "base"      | "aggressive" | "base" |
| Portfóliový mix (percent weights) | mix                   | Raw (not guaranteed 100%) allocation map            | Record<string, number> | DEFAULT_MIX |

Derived gating flag:

- `reUnlocked = oneTime >= 300_000 || income >= 3_500` (enables real estate weight editing & recommendation inclusion)

---

## 2. Asset Model (scenario dependent)

For each scenario S ∈ {conservative, base, aggressive}:

```
ETF.expReturn = 0.09 / 0.14 / 0.18  (conservative / base / aggressive)
ETF.risk      = 5 / 5 / 6
Gold.expReturn= 0.07 / 0.095 / 0.11
Gold.risk     = 2 / 2 / 3
Crypto.expReturn = 0.12 / 0.20 / 0.35
Crypto.risk      = 9 / 9 / 9
Dynamic.expReturnMonthly = 0.02 / 0.03 / 0.04  (monthly nominal)
Dynamic.expReturn = annualizeFromMonthly(DYNAMIC_M) = (1 + m)^{12} - 1
Dynamic.risk = 8 / 9 / 9
Bond (Garantovaný 7,5%) expReturn = 0.075  (all) risk = 2
Hotovosť expReturn = 0.0 risk = 2 (special handling in risk formula)
Reality expReturn = 0.075 / 0.087 / 0.095 risk = 4 / 4 / 5
```

Constants:

```
CASH_BASE_RETURN = 0
```

---

## 3. Helper Functions

### 3.1 Future Value with Monthly Contributions

```
fvMonthly(initial, monthly, years, rate):
  r = rate / 12
  n = floor(years * 12)
  if |r| < 1e-9: return initial + monthly * n
  fvLump = initial * (1 + r)^n
  fvAnnuity = monthly * ((1 + r)^n - 1)/r
  return fvLump + fvAnnuity
```

Golden sample:

- initial=0, monthly=100, years=1, rate=0 => 1200
- initial=1000, monthly=0, years=1, rate=0 => 1000

### 3.2 Monthly / Annual Conversion

```
annualizeFromMonthly(m) = (1 + m)^{12} - 1
monthlyFromAnnual(a) = (1 + a)^{1/12} - 1
```

(Used only for Dynamic asset display.)

### 3.3 Clamping

`clamp(v,min,max)` standard bounding.

### 3.4 Percentage & Currency

`pctFmt(x) = (x * 100).toFixed(1) + "%"`
`euro(n) = locale sk-SK currency EUR (0 decimals)`

### 3.5 Fair Rounding to 100 (Largest Remainder)

```
fairRoundTo100(map):
  sum = Σ raw_i (default 0) or 1
  scaled_i = raw_i * (100 / sum)
  floor_i = floor(scaled_i), remainder_i = scaled_i - floor_i
  allocate remaining (100 - Σ floor_i) to largest remainders cyclically
  return integer map summing 100
```

Golden sample:

```
{A:33.3, B:33.3, C:33.4} -> {A:33, B:33, C:34}
```

---

## 4. Recommended Mix Heuristic `computeRecommendedMix(args)`

Initial skeleton:

```
ETF 30, Gold 20, Crypto 15, Dynamic 10, Bond 15, Cash 10
```

Horizon classification:

```
H = short if years <=5
    mid   if 6..14
    long  if >=15
If short:
  ETF 20, Gold 25, Crypto 10, Dynamic 5, Bond 20, Cash 20
If long:
  ETF 40, Gold 15, Crypto 15, Dynamic 15, Bond 10, Cash 5
(mid = keep skeleton)
```

Large lump sum overrides (descending precedence):

```
oneTime >= 1,000,000 => { ETF 32, Gold 22, Crypto 1, Dynamic 3, Bond 37, Cash 5 }
oneTime >=   500,000 => { ETF 38, Gold 20, Crypto 2, Dynamic 5, Bond 30, Cash 5 }
oneTime >=   100,000 => mutate:
   Crypto = min(Crypto, 3)
   Dynamic = min(Dynamic, 7)
   Bond = max(Bond, 25)
   Gold = max(Gold, 15)
```

Monthly invest adjustments:

```
if monthlyInvest < 100:
   Crypto = min(Crypto, 4)
   Dynamic = min(Dynamic, 6)
   Bond = max(Bond, 30)
else if monthlyInvest >= 500:
   Crypto = min(10, Crypto + 2)
   Dynamic = min(12, Dynamic + 2)
```

Missing reserve (>0) defensive tilt:

```
Cash = max(Cash, 10)
Bond = max(Bond, 30)
Crypto = min(Crypto, 5)
Dynamic = min(Dynamic, 6)
```

Real estate unlock:

```
If reUnlocked == true:
  Reality = 10
  donors = [ETF, Bond]; subtract 5 from each (10 / donors.length) but not below 0
```

Hard caps & floors:

```
Gold = max(Gold, 10)
Dynamic = min(Dynamic, 30)
```

Aggressive combined risk limiter (Dynamic + Crypto):

```
riskySum = Dynamic + Crypto
if riskySum > 22:
  over = riskySum - 22
  dynRoom = max(0, Dynamic - 8)
  takeDyn = min(over, dynRoom)
  Dynamic -= takeDyn
  Crypto  -= (over - takeDyn)
```

Filter out assets not in `assetsKeys`, clamp negatives -> 0, and finally `fairRoundTo100`.

Golden sample A (Base horizon mid, no large sums, no reserve issue, not unlocked, monthlyInvest=200):
Result with defaults years=10 (mid), oneTime=2000, monthlyInvest=200:

- Horizon mid => skeleton unchanged
- No lump sum rule triggered
- No monthlyInvest rule (<100? false; >=500? false)
- missingReserve = max(0, 6\*800 - 1500)=3300 >0 so defensive rule applies:
  Cash max(10,10)=10; Bond max(15,30)=30; Crypto min(15,5)=5; Dynamic min(10,6)=6
  Interim: ETF30, Gold20, Crypto5, Dynamic6, Bond30, Cash10
- reUnlocked? (oneTime=2000 <300k, income 1500 <3500) => false
- Gold≥10 ok; Dynamic≤30 ok; riskySum = 6+5=11 ≤22 => no cut
- Already sums 101? (30+20+5+6+30+10=101) fairRoundTo100 => One asset drops by 1 (largest negative remainder). Expected integer mix (one percentage reduced) e.g. ETF29, Gold20, Crypto5, Dynamic6, Bond30, Cash10 (sums 100). Exact distribution depends on remainder ordering; original code would scale and allocate remainders.

Golden sample B (Long horizon, monthlyInvest high 600, oneTime 100k, no missing reserve, unlocked by income 4000):
Steps:

- Start skeleton then long override -> ETF40, Gold15, Crypto15, Dynamic15, Bond10, Cash5
- oneTime>=100k rule: Crypto=min(15,3)=3; Dynamic=min(15,7)=7; Bond=max(10,25)=25; Gold=max(15,15)=15
  => ETF40, Gold15, Crypto3, Dynamic7, Bond25, Cash5
- monthlyInvest>=500: Crypto=min(10,3+2)=5; Dynamic=min(12,7+2)=9
  => ETF40, Gold15, Crypto5, Dynamic9, Bond25, Cash5
- missingReserve = max(0, 6\*fixed - currentReserve) (assume fixed=800, currentReserve large 10000) => 0 (skip)
- reUnlocked true: Reality=10; donors ETF and Bond each -5 => ETF35, Bond20
  => ETF35, Gold15, Crypto5, Dynamic9, Bond20, Cash5, Reality10
- Risky sum = Dynamic9 + Crypto5 = 14 ≤22 (skip)
- Sum = 99 -> fairRoundTo100 adds +1 to largest remainder -> final 100.

Golden sample C (Short horizon <=5, huge lump sum 1,000,000, monthlyInvest small 50, missing reserve present):

- Short override: ETF20, Gold25, Crypto10, Dynamic5, Bond20, Cash20
- Lump sum >=1,000,000 override supersedes: ETF32, Gold22, Crypto1, Dynamic3, Bond37, Cash5
- monthlyInvest <100: Crypto=min(1,4)=1; Dynamic=min(3,6)=3; Bond=max(37,30)=37
- missingReserve >0: Cash=max(5,10)=10; Bond=max(37,30)=37; Crypto=min(1,5)=1; Dynamic=min(3,6)=3
- reUnlocked? oneTime≥300k true => Reality10, donors ETF & Bond each -5 -> ETF27, Bond32
  Now: ETF27, Gold22, Crypto1, Dynamic3, Bond32, Cash10, Reality10
- Gold≥10 ok, Dynamic≤30 ok, riskySum=3+1=4 ≤22
- Sum=105 -> fairRoundTo100 => subtract 5 via largest remainders to 100.

---

## 5. Risk Model (Legacy)

Inputs: `normMix` (weights normalized to sum=1), `assets` (risk, expReturn).
Constants:

```
OVERWEIGHT_START = 0.2
ALPHA_OVERWEIGHT = 0.5
GAMMA_HHI        = 1.0
```

Algorithm:

```
sorted = entries sorted by weight desc
wMax    = max weight
top2Sum = sum of top 2 weights
For each asset (k,w):
  base = assets[k].risk (default 5)
  if k == Cash: baseWithCash = 2 + 6 * clamp(w,0,1) else baseWithCash = base
  over = max(0, w - 0.2) / 0.8
  eff = baseWithCash * (1 + 0.5 * over)
  weighted += w * eff
  HHI += w^2
concPenalty = 10 * 1.0 * max(0, HHI - 0.22)
Dynamic surcharge (piecewise on dynW = weight of Dynamic):
  if 0.2 ≤ w < 0.3: dynExtra = 10*(w - 0.2)
  else if 0.3 ≤ w < 0.4: dynExtra = 1 + 10*(w - 0.3)
  else if 0.4 ≤ w < 0.5: dynExtra = 2 + 20*(w - 0.4)
  else if w ≥ 0.5: dynExtra = 4 + 30*(w - 0.5)
raw = weighted + concPenalty + dynExtra
score10 = min(11, raw)  (note: allows raw slightly above 10 before clamp for %)
pct = clamp( (min(raw,10)/10) * 100, 0, 100 )
Return { score10, pct, raw, hhi:HHI, wMax, top2Sum }
```

Golden sample Risk (Base scenario, mix 30/20/15/10/15/10):
Weights: ETF .30, Gold .20, Crypto .15, Dynamic .10, Bond .15, Cash .10
Per-asset contributions:

```
ETF: base=5, over=(0.30-0.2)/0.8=0.125 → eff=5*(1+0.5*0.125)=5.3125 contrib=1.59375
Gold: base=2, over=0 → eff=2 contrib=0.4
Crypto: base=9 eff=9 contrib=1.35
Dynamic: base=9 eff=9 contrib=0.9 (dynW<0.2 so no dynExtra later)
Bond: base=2 eff=2 contrib=0.3
Cash: baseWithCash=2+6*0.10=2.6 over=0 eff=2.6 contrib=0.26
weighted sum=4.80375
HHI = .30²+.20²+.15²+.10²+.15²+.10² = 0.195 (<0.22 so concPenalty=0)
dynExtra=0 (dynW=0.10)
raw=4.80375
score10=4.80375
pct=(min(4.80375,10)/10)*100=48.0375%
```

High Dynamic surcharge example (dynW=0.35):

```
dynW in [0.3,0.4): dynExtra = 1 + 10*(0.35-0.3)=1 + 0.5 = 1.5
```

Flags derived from risk & weights:

```
RISK_THRESHOLD = 7
riskExceeded = raw > 7
riskHardBlock = raw >= 10
cashPct = weight of Cash
cashExceeded = cashPct > 0.4
highConcentration = (wMax >= 0.7) OR (top2Sum >= 0.85)
```

---

## 6. Derived Financial Metrics

```
savings      = max(0, income - fixed - variable)
savingsRate  = income > 0 ? savings / income : 0
missingReserve = max(0, emergencyMonths * fixed - currentReserve)
reUnlocked = (oneTime >= 300_000) OR (income >= 3_500)
mixTotal = Σ mix[k]
normMix[k] = (mix[k] || 0) / (mixTotal || 1)
portfolioExpReturn = Σ normMix[k] * assets[k].expReturn
fv = fvMonthly({ initial: oneTime, monthly: monthlyInvest, years, rate: portfolioExpReturn })
goalProgress = target > 0 ? fv / target : 0
rr = (portfolioExpReturn * 100) / min(10, risk.raw)
rrBand:
  rr>=3   => ("Výborné", #22c55e)
  rr>=2   => ("Dobré",   #84cc16)
  rr>=1.3 => ("Neutrálne", #f59e0b)
  else       ("Slabé",   #ef4444)
Top holdings list = top 3 weights from normMix (desc)
```

Progress/Savings bar colors use linear hue interpolation 0→120 by normalized ratio.

---

## 7. Portfolio Normalization Utility (UI Action "Dorovnať do 100%")

Steps:

1. Build `base` = max(0, mix[k]) for all asset keys present.
2. `next = fairRoundTo100(base)` (ensures integer sum = 100).
3. Enforce minimum Gold 10%:
   - If gold < 10: set Gold=10; compute deficit `need` = 10 - oldGold.
   - Distribute `need` proportionally across other assets with weight>0 (first pass) by `take ≈ (assetWeight/othersTotal)*need` (rounded via `Math.round`).
   - If residual remains, second pass linear draining `min(weight, remainingNeed)`.
4. Update state with adjusted map.

Golden sample (gold at 5% in 6-asset 100% total): After normalization ensures gold=10% and others reduced proportionally.

---

## 8. Actions & Side Effects

| Action Label                | Trigger | Sequence / Side Effects                                                                                                                   |
| --------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Dorovnať do 100%            | Button  | Run normalization utility (above), set mix state.                                                                                         |
| Vyvážené (UNOTOP)           | Button  | Set mix to base balanced preset (30/20/15/10/15/10 [+Reality 0]); does NOT auto-normalize (already 100). Hides rec preview.               |
| Odporúčané nastavenie       | Button  | computeRecommendedMix(args) -> setRecMix -> setShowRec(true) (preview only, user must click "Použiť" inside preview to apply).            |
| Nájsť maximum (MVP)         | Button  | Enumerate portfolios (step default 5%) via `findBestPortfolio`; apply bestMix immediately if found (setMix, hide recommendation preview). |
| Resetovať hodnoty           | Button  | Confirm dialog -> restore all inputs to defaults & clear recommendation state.                                                            |
| Použiť (inside rec preview) | Button  | setMix(recMix), hide preview.                                                                                                             |

State persistence loaded/saved under key `unotop_iwa_state` (legacy) containing: income, fixed, variable, oneTime, monthlyInvest, years, target, emergencyMonths, currentReserve, mix, scenario.

---

## 9. Optimizer (Legacy `findBestPortfolio`)

Parameters: { assets, step=5, reUnlocked }
Process:

1. Derive canonical keys by fuzzy matching (dynamic/gold/reality/hotov...).
2. Ordered allocation list: [Bond, ETF, Gold, Dynamic, Crypto, Reality, Cash] filtered to existing assets.
3. Depth-first enumeration with increments of `step` from 0..100 for each asset except last (cash) which fills remainder `rest = 100 - assignedSum`.
4. Constraints enforced at leaf:
   - If !reUnlocked ⇒ Reality weight forced 0.
   - Gold >= 10.
   - Dynamic <= 30.
5. Scoring function:

```
score(mix) = (expectedReturn(mix_norm) * 100) / min(10, risk.raw)
expectedReturn = Σ w_norm * asset.expReturn
risk.raw via computeRisk(normMix)
```

6. Track best score & mix; return { bestMix (rounded by fairRoundTo100), bestScore }.

Golden sample (illustrative): step=50 with assets [Bond, ETF, Gold, Dynamic, Crypto, Cash] — enumerate coarse grid; ensures chosen mix satisfies gold/dynamic constraints. (Exact numeric sample will be added in tests based on deterministic run.)

---

## 10. Warning / Advisory Conditions

| Condition               | Predicate                       | Message Purpose                             |
| ----------------------- | ------------------------------- | ------------------------------------------- |
| riskHardBlock           | risk.raw >= 10                  | Hard stop; user must adjust mix.            |
| riskExceeded            | risk.raw > 7                    | Soft advisory to reduce risk.               |
| dynamic > 30%           | normMix[Dynamic] > 0.30         | Advisory on dynamic overweight.             |
| cashExceeded            | cashPct > 0.40                  | Advisory on excessive cash.                 |
| highConcentration       | wMax >= 0.70 OR top2Sum >= 0.85 | Advisory on concentration risk.             |
| gold low                | goldPct < 0.10                  | Advisory to raise gold (strategic reserve). |
| monthlyInvest > savings | monthlyInvest > savings         | Advisory negative free cash flow.           |
| missingReserve > 0      | missingReserve > 0              | Suggest building emergency fund first.      |
| goalProgress < 1        | goalProgress < 1                | Suggest adjustments to meet target.         |
| goalProgress >=1        | goalProgress >=1                | Congratulatory message.                     |

---

## 11. Module Mapping (Future Refactor Targets)

| Legacy Responsibility                              | New / Existing Module Target                                                                                                |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| fvMonthly, annualizeFromMonthly, monthlyFromAnnual | `domain/finance.ts` (already partly present)                                                                                |
| fairRoundTo100                                     | `domain/finance.ts` (exists)                                                                                                |
| clamp, pctFmt, euro                                | `utils/number.ts` (exists)                                                                                                  |
| Asset scenarios / getAssetsByScenario              | `domain/assets.ts` (exists; differs numerically from legacy – note divergence)                                              |
| computeRecommendedMix heuristic                    | `domain/recommendation.ts` (current version DIFFERENT; need parity decision)                                                |
| computeRisk (legacy penalization model)            | Candidate: new `domain/risk-legacy.ts` or adapt existing `risk.ts` (current model simpler; must choose which spec to honor) |
| findBestPortfolio (enumeration + constraints)      | `domain/optimizer.ts` (exists; scoring & constraints differ slightly)                                                       |
| Normalization (gold min distribution)              | Utility function near mix management (new `utils/portfolio.ts` candidate)                                                   |
| Advisory flag derivations                          | Part of portfolio engine hook (`usePortfolioEngine`) planned                                                                |

Differences to reconcile later:

- Current modular `risk.ts` uses different penalty terms (overweight >35%, concentration threshold 0.18, dynamic+crypto joint), while legacy risk uses piecewise dynamic surcharge + overweight start 20% + conc threshold 0.22.
- Recommendation heuristic parameters differ (e.g., legacy dynamic+crypto riskySum cap 22%).
- Asset base returns/risks numbers differ (must decide canonical set for MVP consistency).

---

## 12. Golden Scenario Summary Table

| Scenario                                                 | Key Inputs                                                                                               | Notable Flags                 | Result Highlights                                                             |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------- |
| A (Mid, missing reserve)                                 | years=10, income=1500, fixed=800, variable=300, oneTime=2000, monthlyInvest=200, currentReserve=1500     | missingReserve>0              | Defensive adj: Bond≈30, Crypto≤5, Dynamic≤6, Cash≥10                          |
| B (Long, large one-time, high monthly, unlocked)         | years=18, income=4000, fixed=1500, variable=800, oneTime=100000, monthlyInvest=600, currentReserve=20000 | reUnlocked, no missingReserve | Adds Reality10, adjusts donors, high growth with capped riskySum              |
| C (Short, huge lump sum, small monthly, missing reserve) | years=5, income=2500, fixed=1200, variable=800, oneTime=1_000_000, monthlyInvest=50, currentReserve=0    | reUnlocked, missingReserve>0  | Ultra defensive override (Bond heavy, Crypto/Dynamic minimized, adds Reality) |

Exact post-round mixes retained in narrative of Section 4.

---

## 13. Test Coverage Plan (Derived from Spec)

(To be implemented later, listed for traceability.)

- fvMonthly edge (zero rate lumpsum & annuity) + positive rate > simple sum.
- fairRoundTo100 sum == 100 & deterministic distribution (stable sort assumption).
- Recommendation: horizon transitions (5→6, 14→15), lump sum thresholds (100k, 500k, 1M), monthlyInvest boundaries (99→100, 499→500), missingReserve trigger, reUnlocked donor subtraction, riskySum reduction logic.
- Risk model: overweight activation at 20%, concentration penalty just below/above 0.22 HHI, dynamic surcharge breakpoint coverage (0.19,0.2,0.29,0.3,0.39,0.4,0.49,0.5).
- Normalization: gold uplift distribution (proportional then residual), integer sum 100.
- Optimizer: constraints respected (gold>=10, dynamic<=30, reality gating), monotonic improvement vs baseline random candidate, reproducibility at given step.
- Advisory flags: each predicate exact threshold test.

---

## 14. Open Decisions / Alignment Tasks

1. Choose canonical risk model (legacy vs new). If legacy retained, migrate formulas to modular `riskLegacy()` & refactor tests accordingly.
2. Harmonize asset return/risk table – pick values or maintain dual (legacy vs current) with scenario tag.
3. Decide whether recommendation heuristic merges with current simpler version or stays as advanced profile.
4. Confirm scoring function uniformity between optimizer versions (legacy divides by min(10, raw) \* 100 factor; current `optimizer.ts` uses score = er / risk). Need consistent dimension.
5. Persist key name migration (`unotop_iwa_state` vs `unotop:v1`) with versioning to avoid user data loss.

---

## 15. Traceability Matrix

| Spec Section     | Future Module/Test Tag                         |
| ---------------- | ---------------------------------------------- |
| 3.1 FV           | finance.fvMonthly tests.fv                     |
| 4 Recommendation | recommendation.heuristic tests.rec.\*          |
| 5 Risk           | risk.legacy tests.risk.\*                      |
| 7 Normalization  | portfolio.normalizeMix tests.normalize.goldMin |
| 8 Actions        | ui.actions._ integration.apply._               |
| 9 Optimizer      | optimizer.enumeration tests.optimizer.\*       |
| 10 Warnings      | engine.flags._ tests.flags._                   |

---

## 16. Integrity Notes

- All percentage weights in risk & expected return computations operate on normalized fractions (0..1) even though UI shows integer %.
- Piecewise dynamic surcharge is intentionally non-linear to accelerate penalty after 40% dynamic allocation; keep exact breakpoints when porting.
- Gold minimum is enforced both in normalization utility and as constraint in optimizer / recommendation.
- Recommendation uses sequential overrides; order matters (e.g., large lump sum override replaces entire structure before subsequent adjustments). Tests must assert order-dependent outcomes.

---

End of spec-logic-v1.
