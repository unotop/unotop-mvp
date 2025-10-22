# [Phase-2] Chart legend/PRO grafy

## Kontext

Phase-1 (BASIC režim) používa CSS progress bar v sec4 (Projekcia). PRO režim bude potrebovať:

- Chart legends (legendy pre grafy)
- Recharts alebo iná grafová knižnica
- Rozšírené vizualizácie (line chart, area chart, breakdown)

Aktuálne failujúce testy očakávajú chart legend elements, ktoré neexistujú v BASIC móde.

## Cieľ

Implementovať PRO režim grafy a legendy:

- Projekcia: line chart s osou času (X = roky, Y = € hodnota)
- Mix breakdown: pie chart alebo stacked bar
- Legend: clickable items (toggle visibility)
- A11y: `role="img"`, `aria-label` na grafoch

## Akceptačné kritériá

- [ ] Chart legend testy PASS (konkrétne súbory TBD po audit)
- [ ] PRO režim: prepínač BASIC/PRO aktivuje rozšírené grafy
- [ ] Recharts (alebo ekvivalent) integrované
- [ ] Legendy: clickable, toggle visibility
- [ ] A11y: `role="img"`, `aria-label`, fokus management
- [ ] Responsive: grafy fungujú na mobile aj desktop

## Súbory na úpravu

- `src/LegacyApp.tsx` – conditional rendering pre PRO grafy
- `package.json` – pridať Recharts (alebo Chart.js)
- Nové komponenty:
  - `src/components/ProjectionChart.tsx`
  - `src/components/MixBreakdownChart.tsx`
  - `src/components/ChartLegend.tsx`

## Odhadovaný čas

~5-6 hodín (Recharts setup, 2-3 grafy, legendy, testy)

## Priorita

**Medium** – PRO režim je bonus feature, BASIC je core.

## Závislosti

- Phase-1 merge (sec4 progress bar existuje ako fallback)
- Rozhodnutie: Recharts vs. Chart.js vs. custom SVG

## Dizajn notes

- Dark theme compatible color palette
- Tooltip na hover (zobraz presné hodnoty)
- Animácie: subtle (transition 300ms, nie rušivé)
- Export graf ako PNG? (TBD, nice-to-have)

## Test IDs (doplniť)

- `PROJECTION_CHART`, `MIX_CHART`, `CHART_LEGEND`, `LEGEND_ITEM`
- Pridať do `src/constants/testIds.ts`

---

**Labels:** `enhancement`, `phase-2`, `pro-mode`, `charts`, `a11y`
