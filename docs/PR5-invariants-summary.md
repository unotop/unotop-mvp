# PR5 – Invariant Pipeline Refactor Summary

## Overview

We redesigned the portfolio invariant pipeline to be fully manual and transparent. Automatic background corrections on every blur were removed to give users control, while still ensuring a deterministic, reproducible normalization when explicitly applied.

## Core Objectives

- Remove surprise auto-adjustments.
- Provide explicit user actions:
  - **"Upraviť podľa pravidiel"** – apply full invariant pipeline.
  - **"Resetovať hodnoty"** – restore captured baseline (post‑load state after one normalization pass).
- Preserve logical guardrails (gold floor, risk cap on dyn+crypto, sum=100%).
- Support BASIC/PRO mode differences without changing invariant semantics.

## Pipeline Steps (Deterministic Order)

1. Clamp all weights to >= 0.
2. Fair round (if sum drift ≠ 100%).
3. Enforce gold floor via `normalizeAndEnsureGold` (≥10% physical gold) – includes internal fair rounding.
4. Dynamic + Crypto combined cap ≤22% (two-phase: subtract overshoot prioritizing larger component; add excess to bonds or cash fallback; re-round; iterative final trim if still >22%).
5. Final fairRound if sum drifted.
6. Final non-negative clamp.

A `changed` flag + `riskLimited` flag are returned so UI can toast contextually ("upravené podľa pravidiel" / limiter applied).

## Baseline Capture

- After storage load & migration, a single normalization pass runs async (`setTimeout 0`), storing the result as `baselineMix`.
- "Resetovať hodnoty" is disabled until baselineMix is set.
- Baseline never mutates later (unless a future migration strategy version bump). Ensures reproducibility for A/B testing.

## User Actions & Toasts

| Action                             | Result                          | Toasts                                                |
| ---------------------------------- | ------------------------------- | ----------------------------------------------------- |
| Dorovnať                           | Fair round only (sum -> 100)    | "Súčet upravený – ..." or variant                     |
| Upraviť podľa pravidiel            | Full pipeline                   | Generic rules toast; extra limiter toast if triggered |
| Resetovať hodnoty                  | Revert to baselineMix           | "Mix vrátený na základný stav."                       |
| Apply Recommended / Apply Selected | Compute candidate, run pipeline | Same rule/limiter toasts if changes made              |

## BASIC vs PRO Interaction

- BASIC has max ceilings & overshoot CTA to switch; invariants do not clamp to BASIC limits (that responsibility lives in guarded setters / mode switch clamp phase).
- On PRO→BASIC switch: one-time clamp & toast if any values exceed BASIC limits.

## Rationale for Manual Mode

- Increases user trust (no silent weight shifts).
- Simplifies reasoning for test cases (pipeline pure & idempotent on stable input).
- Enables future auditing (we could log before/after states for analytics).

## Testing

Added / updated tests:

- Migration & baseline readiness (reset button waits until enabled).
- Invariants application changes mix as expected for: gold floor, dyn+crypto cap, sum normalization.
- Buttons: apply rules, reset baseline.

## Follow-ups (Potential)

- Expose per-step diff preview before applying (UX enhancement).
- Configurable gold floor & risk cap thresholds (admin / PRO+ mode).
- Telemetry: count how often limiter engages vs user manual adjustments.

---

_Last updated: PR5 implementation (schema v3)._
