# Risk Model Data Request

We are preparing to calibrate / validate the **current** (non-legacy) risk model. To proceed we need authoritative inputs and threshold definitions.

## 1. Asset Parameter Table (Current Scenario)

For each key in `assets.current` (below), supply:

- `expReturn_pa` (expected arithmetic annual return, % or decimal specify)
- `baseRisk` (unitless risk score component feeding composite risk)
- (Optional) `liquidityScore` (0-1) if part of future constraints
- (Optional) `downsideSeverity` (qualitative A/B/C or numeric) if used in penalties

_Current keys (placeholder – confirm exact ordering):_

```
Zlato (fyzické)
Hotovosť/rezerva
Dlhopis (globál)
Dlhopis (korporát)
Akcie (US)
Akcie (EU)
Akcie (EM)
Dynamické riadenie
Krypto (BTC/ETH)
```

(Adjust if we ultimately collapse / expand any buckets.)

## 2. Thresholds & Penalties

Provide values (or confirm defaults):
| Parameter | Purpose | Current Assumption |
|-----------|---------|--------------------|
| riskBands (0-2,2-4,4-6,6-7.5,7.5-9,9-10) | Gauge segmentation | FINAL |
| legacyRiskThreshold | Flag for warnings in legacy mode | 7.0 |
| currentRiskThreshold | Flag for warnings in current mode | 7.5 |
| dyn+crypto cap | Invariant limiter | 22% (sum weights) |
| goldFloor | Invariant floor | 10% (physical gold bucket) |
| cashHigh basic/current | Warning | 40% legacy / 35% current |

If different penalty curves exist (e.g. nonlinear risk growth near >8), please detail formula or piecewise function.

## 3. Computational Notes Wanted

- Are risk contributions additive (Σ w_i \* baseRisk_i) or nonlinear (e.g. adjusted by correlation matrix)?
- If correlations: need matrix or a simplification rule.
- Any special-case overrides (e.g., minimum residual risk floor, capping one asset)?

## 4. Future Extensions (Optional Feedback)

- Introduce tail-risk factor (VAR/ES proxy) for crypto bucket.
- Adaptive gold floor based on horizon & inflation expectations.
- Mode-specific risk scaling (PRO exposes higher smoothing window?).

## 5. Delivery Format

Preferred: single JSON or CSV + short methodology note; example JSON schema:

```json
{
  "assets": {
    "Zlato (fyzické)": { "expReturn_pa": 0.05, "baseRisk": 2.1 },
    "Hotovosť/rezerva": { "expReturn_pa": 0.01, "baseRisk": 0.2 }
  },
  "thresholds": {
    "currentRiskThreshold": 7.5,
    "legacyRiskThreshold": 7.0,
    "goldFloor": 0.1,
    "dynCryptoCap": 0.22
  }
}
```

---

Please provide or confirm these data so we can finalize calibration and potentially add a short README for the risk module.
