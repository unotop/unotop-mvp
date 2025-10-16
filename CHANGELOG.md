# Changelog

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
