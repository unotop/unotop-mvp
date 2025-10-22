# UNOTOP MVP – Implementation Report (Phase: Profile + Mix CTAs + Risk Gauge)

**Date:** 2025-10-20  
**Branch:** feat/legacy-basic (preparing feat/legacy-parity-s1-s3)  
**Status:** ✅ **COMPLETE** – All tests PASS, build SUCCESS

---

## 🎯 Implementation Summary

### ✅ sec0: Profil klienta (NEW)

Nový blok nad sec1 (Cashflow) s 3 nastaveniami:

**Typ klienta (radio group):**

- Jednotlivec
- Rodina
- Firma

**Preferencia rizika (radio group):**

- Konzervatívny (risk cap 4.0)
- Vyvážený (risk cap 6.0)
- Rastový (risk cap 7.5)

**Krízový bias (slider 0-3):**

- Horizontálny slider s live hodnotu vpravo
- Persist do `profile.crisisBias`

**Persist:**

- `profile.clientType`: 'individual' | 'family' | 'firm'
- `profile.riskPref`: 'konzervativny' | 'vyvazeny' | 'rastovy'
- `profile.crisisBias`: 0 | 1 | 2 | 3
- Mirror to top-level: `riskPref` a `crisisBias` (back-compat)

**Risk cap mapping:**

```typescript
konzervativny → 4.0
vyvazeny → 6.0
rastovy → 7.5
```

---

### ✅ sec3: MixPanel sumár + CTA + chips (UPGRADED)

**Sumár mixu (colored badge):**

- "Súčet mixu: X%"
- Farba podľa driftu:
  - ✅ Zelená: |sum−100| < 0.01 (dorovnané)
  - 🟡 Žltá: 0.01 ≤ |sum−100| ≤ 1 (malý drift)
  - 🔴 Červená: |sum−100| > 1 (veľký drift)

**CTA tlačidlá (už existovali, teraz potvrdené):**

- "Dorovnať" → `normalize(mix)`
- "Max výnos (riziko ≤ cap)" → `applyRiskConstrainedMix(mix, cap)`
- "Optimalizuj" (placeholder)
- "Aplikovať odporúčaný mix portfólia"

**Chips (viditeľné, emoji + text):**

- 🟡 "Zlato dorovnané" (gold ≥ 12%)
- 🚦 "Dyn+Krypto obmedzené" (dyn+crypto > 22)
- ✅ "Súčet dorovnaný" (|sum−100| < 0.01)
- ⚠️ "Nad limit rizika" (riskScore > cap)
- `aria-live="polite"` na chips wrapper

---

### ✅ sec5: SVG Risk Gauge + Live metriky (UPGRADED)

**SVG Gauge (otometer):**

- Colored arcs: 0-4 green, 4-7 yellow, 7-10 red
- Pointer rotácia podľa `riskScore(mix)`
- Hodnota uprostred (X.Y formát)
- A11y: `role="meter"`, `aria-valuemin/max/now`, `aria-label`
- Test IDs: `data-testid="risk-gauge"`, `data-testid="risk-value"`

**Live metriky (3 scorecards):**

- **Riziko (0–10):** `riskScore(mix)` / `cap` + ⚠️ ak > cap
- **Výnos/rok (odhad):** `approxYieldAnnualFromMix(mix)` (%)
- **Progres k cieľu:** `calculateFutureValue(lumpSum, monthly, yield, horizon)` / goal (%)

**Live reaktivita:**

- Risk cap sa prepočíta pri zmene `riskPref` (z sec0)
- Metriky sa prepočítajú pri zmene `mix`, `lumpSumEur`, `monthlyVklad`, `horizonYears`, `goalAssetsEur`
- Žiadne auto-updates – iba na user action (slider, input blur, button click)

---

## 📊 Test Results

### ✅ Critical tests: 17/17 PASS (Duration: 5.44s)

| Test suite                             | Status            | Time   |
| -------------------------------------- | ----------------- | ------ |
| `tests/invariants.limits.test.tsx`     | ✅ PASS (2 tests) | 529ms  |
| `tests/accessibility.ui.test.tsx`      | ✅ PASS (9 tests) | 1739ms |
| `tests/acceptance.mix-cap.ui.test.tsx` | ✅ PASS (3 tests) | 1851ms |
| `tests/persist.roundtrip.test.tsx`     | ✅ PASS (1 test)  | 2552ms |
| `tests/persist.debts.v3.test.tsx`      | ✅ PASS (1 test)  | 563ms  |
| `tests/deeplink.banner.test.tsx`       | ✅ PASS (1 test)  | 345ms  |

**Notes:**

- Žiadne nové regresy
- Existujúce warnings (`act(...)`) sú známe a nesúvisia s touto implementáciou
- Všetky A11y testy (9) prechádzajú

---

### ✅ Build: SUCCESS (925ms)

```bash
vite v7.1.7 building for production...
✓ 36 modules transformed.
dist/index.html                   0.86 kB │ gzip:  0.47 kB
dist/assets/index-DWnUPmmY.css    0.51 kB │ gzip:  0.32 kB
dist/assets/index-dELg_BnA.js   228.66 kB │ gzip: 69.48 kB
✓ built in 925ms
```

**No TypeScript errors**

---

## 📁 Changed Files

| File                            | Changes                                                     | LOC Δ |
| ------------------------------- | ----------------------------------------------------------- | ----- |
| `src/persist/v3.ts`             | Added `clientType` to Profile type                          | +1    |
| `src/LegacyApp.tsx`             | Added sec0 (Profil klienta), RiskGauge import, live metrics | +150  |
| `src/features/mix/MixPanel.tsx` | Colored sumár mixu badge, aria-live on chips                | +10   |
| `src/components/RiskGauge.tsx`  | Already existed (no changes)                                | 0     |

**Total:** 3 files edited, ~161 LOC added

---

## ♿ Accessibility Compliance

✅ **WCAG 2.1 Level AA:**

- sec0: Radio groups with `fieldset`, `legend`, proper labels
- sec0: Crisis bias slider with `aria-label`
- Chips: `aria-live="polite"` wrapper
- RiskGauge: `role="meter"`, `aria-valuemin/max/now`, `aria-label`
- Sumár mixu: Color not sole indicator (text + emoji backup)

---

## 🎨 Visual Changes

### Layout parity s Netlify referencou:

**Left stack (sec0 → sec1 → sec2 → sec3):**

- ✅ sec0 (Profil klienta) – nad Cashflow
- ✅ sec1 (Cashflow & rezerva) – bez zmeny
- ✅ sec2 (Investičné nastavenia) – už hotové
- ✅ sec3 (Zloženie portfólia) – sumár mixu + CTA + chips

**Right sticky panel:**

- ✅ sec5 (Metriky) – SVG gauge + 3 scorecards + CTA
- ✅ sec4 (Projekcia) – CSS progress bar (bez zmeny)

**Styling:**

- Dark theme (slate-900/slate-800 palette)
- Sumár mixu: dynamické farby (emerald/amber/red)
- Chips: emoji + text (viditeľné, nie sr-only)
- Gauge: colored arcs (green/yellow/red), pointer, center value

---

## 🚫 Čo NEROBÍME (zámerne)

### BEZ auto-normalizácie

- Ručné zásahy v mixe nenormalizujú okamžite
- Zobraz chip "Súčet X %" (ak drift)
- CTA "Dorovnať" to vyrieši manuálne
- **Dôvod:** Používateľ má kontrolu nad každou zmenou

### BEZ crisisBias v riskScore (Phase 1)

- `riskScore(mix)` nepoužíva crisisBias parameter
- Crízový bias sa ukladá do persist, ale zatiaľ nie v kalkulácii
- **Dôvod:** Jednoduchosť, Phase-2 scope

---

## 🔄 Migration Notes

**Späť kompatibilné:**

- Stará data (bez `clientType`, `crisisBias`) fungujú s defaultmi
- `riskPref` má fallback na 'vyvazeny'
- `crisisBias` má fallback na 0
- Žiadne breaking changes v persist v3 strukture

**Top-level mirrors (tests očakávajú):**

- `riskPref` → `profile.riskPref` (obojsmerné)
- `crisisBias` → `profile.crisisBias` (obojsmerné)

---

## ✅ Akceptačné kritériá

- [x] sec0 (Profil klienta) renderuje s 3 radio groups + slider
- [x] sec0 persist do profile.clientType/riskPref/crisisBias
- [x] Risk cap mapping (konzervativny=4.0, vyvazeny=6.0, rastovy=7.5) funguje
- [x] Sumár mixu má farbu podľa driftu (zelená/žltá/červená)
- [x] Chips majú emoji + text + aria-live="polite"
- [x] SVG Gauge renderuje s colored arcs + pointer + center value
- [x] RiskGauge má role="meter" + aria ARIA attributes
- [x] Live metriky reagujú na zmenu riskPref (cap sa prepočíta)
- [x] 17/17 critical tests PASS
- [x] Build SUCCESS (925ms, no TS errors)
- [x] Žiadne nové A11y regresy

---

## 🚀 Next Steps (Phase-2)

**Debt UI (rozšírené):**

- Expanded debt management v BASIC režime
- Tabuľka + KPI lišta + reason line

**Chart legend/PRO grafy:**

- Recharts integrácia
- PRO režim visualizations

**Polish spacing/typografia:**

- UI refinement podľa banking-grade štandardov

**Export/Import:**

- Configuration export/import functionality

---

## 📸 Screenshots (TODO pred PR)

**Požiadavka:**

- Screenshot A: Left stack (sec0 → sec1 → sec2 → sec3)
- Screenshot B: Right panel (SVG gauge + 3 scorecards)

---

## 🎉 Zhrnutie

**Implementované:**

- ✅ sec0 (Profil klienta) – 3 radio groups + crisis bias slider
- ✅ MixPanel sumár mixu – colored badge podľa driftu
- ✅ Chips – emoji + text + aria-live
- ✅ SVG Risk Gauge – colored arcs + pointer + A11y meter
- ✅ Live metriky – risk/yield/progres s prepojením na sec0/sec2

**Testing:**

- ✅ 17/17 critical tests PASS (5.44s)
- ✅ Build SUCCESS (925ms)
- ✅ No TypeScript errors
- ✅ No new A11y regressions

**Visual parity:**

- ✅ Layout zodpovedá Netlify referencii
- ✅ Dark theme + colored badges
- ✅ Gauge otometer feel

**Ready for PR! 🚀**

---

_Generated: 2025-10-20 15:25 UTC_  
_Branch: feat/legacy-basic → feat/legacy-parity-s1-s3_  
_Implementor: GitHub Copilot (CS)_
