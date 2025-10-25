# Changelog

## v0.6.3 (2025-10-25)

**PR-9: Warning System – Non-blocking alerts with chips & toasts**

- **Removed window.alert()**: All 3 blocking modal alerts replaced with WarningCenter system
- **WarningCenter infrastructure**:
  - Singleton pattern with push/dismiss/subscribe API
  - Auto-dismiss after 6s for all warnings
  - Dedupe mechanism (5s window) to prevent spam
  - Periodic cleanup (30s) to prevent memory leaks
- **UI components**:
  - `WarningChips`: Inline display under MixPanel for mix/risk scope warnings
  - `ToastStack`: Top-right fixed toasts for global scope messages
  - Color-coded: blue (info), amber (warning), red (error)
  - Icons: ℹ️ / ⚠️ / ⛔
- **Accessibility**:
  - `aria-live`: polite for chips, assertive for error toasts
  - `role="status"` for status updates
  - Keyboard navigation: Esc dismisses latest toast
- **Integration**:
  - Risk validation errors (PortfolioSelector) → red error chips
  - PRO mode info (BasicSettingsPanel) → blue info toasts
  - Rate limit warnings (BasicLayout) → amber warning toasts with dedupe
- **Tests**: 2 unit tests (WarningCenter), 4 integration tests (warnings), 17 critical tests PASS
- **Resolves**: Blocking alert modals removed, improved UX with non-intrusive notifications

## v0.6.2 (2025-10-25)

**PR-8: Adaptive Policy – stage-aware caps & adaptive risk limits**

- **Stage detection**: 3-tier classification (STARTER/CORE/LATE) based on capital, contributions, horizon, goal coverage
- **Adaptive risk caps**: Baseline ±0.5 (STARTER: +0.5, CORE: baseline, LATE: -0.5)
- **Stage-aware asset caps**:
  - STARTER: ETF 50%, dyn +3 p.b., combo dyn+crypto 25%
  - CORE: ETF 40%, dyn 15%, combo 22% (baseline)
  - LATE: ETF 35%, dyn -5 p.b., combo 18%
- **Enforcement & redistribution**: `enforceStageCaps()` with bucket ordering (bonds/gold/ETF/cash)
- **Integration**: `mixAdjustments.ts`, `PortfolioSelector.tsx`, `BasicProjectionPanel.tsx`, `MetricsSection.tsx`
- **Tests**: 40 policy unit tests (stage/risk/caps), 17 critical tests PASS
- **Resolves**: ETF 43.96% error in growth phase, risk 7.7 > 7.5 warning in STARTER, GOLD 48.74% auto-redistribution

## v0.6.0-beta (2025-10-12)

- fix: keep full app state on refresh (unotop_v1 + flush)
  - Jednotná perzistencia `unotop_v1` (profil, cashflow, mix, toggles, debts, debtVsInvest, UI sekcie, graf ON/OFF).
  - Migrácia zo `unotop:v3` → transform + uloženie do `unotop_v1`.
  - Debounce ~200 ms + flush pri `beforeunload` – posledné zmeny sa nestratia.
  - Reset čistí `unotop_v1` aj `unotop:v3` a urobí reload.
  - Testy: roundtrip persist + rozšírený reset test.

## v0.5.1-rc (2025-10-11)

- PR‑9 drobnosti + guardy:
  - Fix: Zloženie portfólia opäť viditeľné; 6 sliderov a súčet = 100 % po načítaní.
  - UI: Poradie vpravo: Metriky & odporúčania → Projekcia (Graf toggle ostáva v hlavičke Projekcie).
  - UX: Silnejšie zvýraznenie vybraného návrhu (hrubší rám + ✅) + inline CTA „Použiť vybraný mix“ priamo pod náhľadom.
  - Stabilita: Reality (komerčné) sa zobrazujú s hodnotou 0 % (BASIC aj PRO).
  - Guard testy: poradie sekcií vpravo, jedinečný „Ako počítame riziko?“, prítomnosť slidera „ETF (svet – aktívne)“, toggle Graf, BASIC onboarding len raz za reláciu, auto‑scroll/focus po výbere mixu.

# Changelog

## v0.5.0 (2025-10-11)

- PR-5: Invarianty a status chips – konzistentné vlajky, idempotentné notifikácie.
- PR-6: Share modal a11y (fokus na otvorenie, ESC), dialógové prvky, live oblasti.
- PR-7: Dlhy & cashflow – tabuľka s a11y, CRUD, validácie, KPI „Mesačné splátky spolu“, verdikt s dôvodom, persist v3 + deep-link.
- PR-8: Audit „Current vs Legacy“ – skript a aktualizácia tabuľky v `docs/spec-current-v1.md`; link „Ako počítame riziko?“ s modálom; banner po načítaní zo #state=.

Pozn.: Current risk model je stále BETA.
