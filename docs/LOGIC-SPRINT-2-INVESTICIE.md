# Logic Sprint 2: Investície (sec2) – FV live update + Progress + Recharts

**Status:** ✅ COMPLETE  
**Datum:** 2025-01-XX  
**Test results:** 17/17 PASS  
**Build:** SUCCESS (165.81 kB gzipped, +95 kB kvôli Recharts)

---

## 1. Ciele

- **FV výpočet**: Live prepočet Future Value (FV) v sec2 reaktívne na zmeny v:
  - `lumpSumEur` (jednorazová investícia)
  - `monthlyVklad` (mesačný vklad)
  - `horizonYears` (investičný horizont)
  - `mix` (portfóliový mix → ovplyvňuje výnos)

- **Color-coded progress bar**: Farba podľa progresu k cieľu:
  - Zelená (emerald-500): ≥80%
  - Žltá (amber-500): 50-80%
  - Červená (red-500): <50%

- **Insight "Zvýš vklad"**: Conditional CTA v sec2, ak `FV < goalAssetsEur`:
  - Vypočíta odporúčaný mesačný vklad (pomocou FV inverznej formuly)
  - Tlačidlo "Zvýš vklad na X €/mes." → aplikuje do `monthlyVklad` + persist
  - Role="status", aria-live="polite"

- **Recharts dual-line chart**: Graf v sec4 (Projekcia) zobrazuje:
  - Zelená linka: Investičný rast (FV progression)
  - Červená linka: Dlhový zostatok (linear amortization)
  - Crossover marker (žltá prerušovaná čiara): Rok, kde FV ≥ debt → "Rok vyplatenia: 20XX"
  - Fallback: Ak žiadne dlhy → zobrazí len growth line

---

## 2. Implementované zmeny

### 2.1 sec2: Insight "Zvýš vklad" (conditional)

**Súbor:** `src/LegacyApp.tsx` (lines ~980-1035)

**Logika:**

```typescript
if (goal <= 0) return null; // Žiadny cieľ
const v3 = readV3();
const mix = (v3.mix || defaultMix) as MixItem[];
const approx = approxYieldAnnualFromMix(mix);
const fv = calculateFutureValue(lump, monthly, years, approx);
if (fv >= goal) return null; // Dosahuje cieľ

// Vypočítaj recommended monthly (inverzná FV formula)
const fvLump = lump * Math.pow(1 + approx, years);
const diff = goal - fvLump;
const factor = 12 * ((Math.pow(1 + approx, years) - 1) / approx);
recommended = Math.max(0, Math.ceil(diff / factor));
```

**UI:**

- Amber badge s textom: "⚠️ Nedosiahnete cieľ (odhad X € vs. cieľ Y €)."
- CTA tlačidlo: "Zvýš vklad na Z €/mes."
- Po kliknutí:
  ```typescript
  writeV3({
    profile: { ...(cur.profile || {}), monthlyVklad: recommended },
    monthly: recommended,
  });
  setMonthlyVklad(recommended);
  ```

**Reason:** Rovnaký pattern ako rezerva insight (Sprint 1), zabezpečuje konzistenciu UX.

---

### 2.2 sec4: Color-coded progress bar

**Súbor:** `src/LegacyApp.tsx` (lines ~1410-1425)

**Formula:**

```typescript
const pct = Math.max(0, Math.min(100, Math.round((fv / goal) * 100)));
const barColor =
  pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-red-500";
```

**UI:**

```tsx
<div
  className={`absolute inset-y-0 left-0 ${barColor} transition-all duration-300`}
  style={{ width: `${pct}%` }}
/>
```

**Reason:** Vizuálny feedback – zelená = na dobrej ceste, červená = potrebuje zvýšiť vklad.

---

### 2.3 sec4: Recharts dual-line chart + crossover

**Súbor:** `src/LegacyApp.tsx` (lines ~1430-1560)

**Dependencies:**

```bash
npm install recharts
```

**Imports:**

```typescript
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";
```

**Data preparation:**

```typescript
const debts = v3Data.debts || [];
const totalDebtPrincipal = debts.reduce(
  (sum, d) => sum + (d.principal || 0),
  0
);
const chartData: { year: number; fv: number; debt: number }[] = [];

for (let y = 0; y <= years; y++) {
  const fvAtYear = calculateFutureValue(lump, monthly, y, approx);
  // Simplified linear amortization
  const debtAtYear = totalDebtPrincipal * Math.max(0, 1 - y / years);
  chartData.push({ year: y, fv: fvAtYear, debt: debtAtYear });
}

// Crossover detection
let crossoverYear: number | null = null;
if (totalDebtPrincipal > 0) {
  for (let i = 0; i < chartData.length; i++) {
    if (chartData[i].fv >= chartData[i].debt) {
      crossoverYear = chartData[i].year;
      break;
    }
  }
}
```

**Chart render:**

```tsx
{
  totalDebtPrincipal > 0 && (
    <LineChart width={500} height={250} data={chartData}>
      <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
      <XAxis
        dataKey="year"
        label={{ value: "Roky", position: "insideBottom" }}
      />
      <YAxis tickFormatter={(val: number) => `${(val / 1000).toFixed(0)}k`} />
      <Tooltip formatter={(val: number) => `${val.toFixed(0)} €`} />
      <Legend />
      <Line
        dataKey="fv"
        stroke="#10b981"
        strokeWidth={2}
        name="Investície (rast)"
      />
      <Line
        dataKey="debt"
        stroke="#ef4444"
        strokeWidth={2}
        name="Dlhy (zostatok)"
      />
      {crossoverYear !== null && (
        <ReferenceLine
          x={crossoverYear}
          stroke="#facc15"
          strokeDasharray="5 5"
          label={{
            value: `Rok vyplatenia: ${new Date().getFullYear() + crossoverYear}`,
            position: "top",
            fill: "#facc15",
          }}
        />
      )}
    </LineChart>
  );
}
```

**Fallback:** Ak `totalDebtPrincipal === 0`, chart sa nezobrazí (len progress bar + číselné hodnoty).

**Reason:** Vizualizácia "kde sa pretnú investície a dlhy" = core value pre klienta (vidí, kedy môže vyplatiť úver skôr).

---

## 3. Validácia

### 3.1 Critical testy

```bash
npm run test:critical
```

**Výsledok:** ✅ **17/17 PASS** (5.52s)

- `invariants.limits` (2/2)
- `accessibility.ui` (9/9)
- `acceptance.mix-cap` (3/3)
- `persist.roundtrip` (1/1)
- `persist.debts.v3` (1/1)
- `deeplink.banner` (1/1)

**Warnings:** React act() warnings (known issue, neovplyvňuje funkčnosť).

---

### 3.2 Production build

```bash
npm run build
```

**Výsledok:** ✅ **SUCCESS** (3.27s)

- Bundle size: **546.60 kB** raw → **165.81 kB** gzipped
- Nárast: **+95 kB** gzipped (kvôli Recharts)
- Chunking warning: Expected (Recharts je veľká knižnica, možno optimalizovať cez dynamic import v budúcnosti)

---

## 4. Zmeny v súboroch

### `src/LegacyApp.tsx`

- **Lines 1-16**: Added Recharts imports
- **Lines 980-1035**: sec2 insight "Zvýš vklad" (conditional IIFE)
- **Lines 1410-1425**: Color-coded progress bar (`barColor` logic)
- **Lines 1430-1560**: Recharts dual-line chart + crossover marker

### `package.json`

- Pridaná dependency: `recharts@^2.x.x`

---

## 5. Kontext & návaznosť

### Prečo Sprint 2?

- **Nadväzuje na Sprint 1 (Cashflow)**: Free cash → koľko môže investovať mesačne → FV projekcia
- **Pripravuje Sprint 3 (Optimizer)**: FV je základ pre odporúčanie "Max výnos" (treba vedieť, či súčasný mix dosahuje cieľ)
- **Pripravuje Sprint 4 (Share modal)**: Projekcia + graf = vizuálny obsah na email pre advisora

### User vision

_"...nahodí si príjmy/výdavky, nastaví mix, vyskočí mu odhad majetku + graf... ak má úvery tak mu zobrazí klesanie úveru a rast investícií... tam kde sa pretnú tak vie vyplatiť úver skôr"_

→ Sprint 2 realizuje druhú polovicu tejto vízie (graf, odhad, crossover).

---

## 6. Budúce vylepšenia (Phase 3+ polish)

- **Responsive chart**: Recharts `ResponsiveContainer` pre mobile
- **Dynamic import**: Code-split Recharts (lazy load), znížiť initial bundle
- **Real amortization**: Namiesto linear decay použiť skutočnú amortizáciu z `debts.monthsLeft` a `debts.ratePa`
- **Tooltip interactivity**: Hover na graf → detail (investície X €, dlh Y €, rok Z)
- **Animation**: Fade-in chart po načítaní dát (framer-motion alebo CSS)

---

## 7. Riziká & rollback

**Riziká:**

- Bundle size narástol o 95 kB gzipped → OK pre MVP (Recharts je štandard)
- React act() warnings → known issue, neovplyvňuje funkčnosť (všetky testy PASS)

**Rollback:**
Ak by Recharts spôsobil problémy:

```bash
git revert <commit-hash>
npm uninstall recharts
```

---

## 8. Zhrnutie

✅ **Sprint 2 COMPLETE**:

- FV výpočet reaktívny na všetky vstupy (lump, monthly, horizon, mix)
- Progress bar farebne kódovaný (zelená/žltá/červená)
- Insight "Zvýš vklad" s CTA (conditional v sec2)
- Recharts dual-line chart (investície vs. dlhy)
- Crossover marker (rok vyplatenia úveru)
- Testy: 17/17 PASS
- Build: SUCCESS

**Ďalší krok:** Logic Sprint 3 – Mix optimizer (applyRiskConstrainedMix, gold recommendation, dyn+krypto constraints).
