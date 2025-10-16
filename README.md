# UNOTOP Planner (v0.5.0)

Jednoduchý plánovač mixu aktív s dvoma modelmi rizika (Legacy/Current), invariantmi, optimalizátorom a modulom „Dlhy“.

## How-to

- Spustiť testy: `npm run test`
- Dev server: `npm run dev`
- Build: `npm run build`

## Špecifikácie a dokumentácia

- Current risk model: `docs/spec-current-v1.md` (vrátane auditu vs. Legacy)
- Zhrnutie invariantov: `docs/PR5-invariants-summary.md`

## Kľúčové funkcionality

- Persistencia v3 + deep-link `#state=`
- A11y: dialogy, tabuľky, live oblasti
- Dlhy: tabuľka s CRUD, KPI „Mesačné splátky spolu“, porovnanie splácať vs. investovať (−2 p.b. rezerva)

## Poznámky

- Current risk model je BETA (pozri badge v UI)
