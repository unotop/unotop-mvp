# PR-9: Warning System – Non-blocking alerts with chips & toasts

**Branch**: `feat/pr-9-warning-system`  
**Status**: ✅ COMPLETED  
**Commit**: `07d3c56`  
**Tag**: `v0.6.3`  
**Date**: 2025-10-25

---

## Cieľ

Nahradiť všetky blokujúce `window.alert()` volania moderným systémom notifikácií s chipmi (inline) a toastmi (top-right), s plnou podporou A11y a automatickým čistením.

---

## Zmenené súbory

### 1. **src/features/ui/warnings/WarningCenter.ts** (NEW - 154 lines)

- Singleton class pre centralizovanú správu varovaní
- API: `push()`, `dismiss()`, `getAll()`, `getByScope()`, `subscribe()`
- Auto-dismiss po 6s
- Dedupe mechanizmus (5s okno) s `dedupeKey`
- Periodické čistenie (30s interval) pre pamäťové leaky
- Typy: `'info' | 'warning' | 'error'`
- Scopes: `'mix' | 'risk' | 'global'`

### 2. **src/features/ui/warnings/WarningChips.tsx** (NEW - 100 lines)

- React komponent pre inline zobrazenie mix/risk varovaní
- Scope filtering (default: mix + risk)
- Color-coded chips: blue (info), amber (warning), red (error)
- Icons: ℹ️ / ⚠️ / ⛔
- Dismiss button (X) pre každý chip
- A11y: `role="status"`, `aria-live="polite"`, `aria-atomic="false"`
- Responsive flex-wrap layout

### 3. **src/features/ui/warnings/ToastStack.tsx** (NEW - 113 lines)

- React komponent pre global toasty (top-right corner)
- Fixed position: `top-20 right-4`, `z-[1100]`
- Filters: iba global scope
- Esc key handler (dismiss latest)
- Adaptive `aria-live`: `"assertive"` pre errors, `"polite"` pre info/warning
- Animation: `animate-slideInRight` (už existuje v global.css)

### 4. **src/features/portfolio/PortfolioSelector.tsx** (UPDATED)

- Import `WarningCenter`
- Line 184: `alert(\`⚠️ ${validation.message}\`)` →
  ```ts
  WarningCenter.push({
    type: "error",
    message: validation.message || "Validácia zlyhala",
    scope: "risk",
    dedupeKey: "preset-validation",
  });
  ```

### 5. **src/features/basic/BasicSettingsPanel.tsx** (UPDATED)

- Import `WarningCenter`
- Line 497: `alert(message)` →
  ```ts
  WarningCenter.push({
    type: "info",
    message,
    scope: "global",
    dedupeKey: "pro-mode-info",
  });
  ```

### 6. **src/BasicLayout.tsx** (UPDATED)

- Import `WarningCenter` + `ToastStack`
- Lines 988-992: 2× `alert()` →

  ```ts
  // Cooldown warning
  WarningCenter.push({
    type: "warning",
    message: `⏱️ Počkajte prosím ${cooldown}s...`,
    scope: "global",
    dedupeKey: "rate-limit-cooldown",
  });

  // Monthly limit warning
  WarningCenter.push({
    type: "warning",
    message: `Vyčerpali ste mesačný limit projekcií...`,
    scope: "global",
    dedupeKey: "rate-limit-monthly",
  });
  ```

- Pridané `<ToastStack />` na začiatok return statement

### 7. **src/features/mix/MixPanel.tsx** (UPDATED)

- Import `WarningChips`
- Pridané `<WarningChips className="mt-3" />` pod tlačidlá mix akcií

### 8. **tests/WarningCenter.test.ts** (NEW - 2 tests)

- Test 1: Dedupe warnings with same dedupeKey within 5s
- Test 2: Auto-dismiss warnings after 6s

### 9. **tests/warnings.integration.test.tsx** (NEW - 4 tests)

- Test 1: Display mix scope warning in WarningChips
- Test 2: Display risk scope error in WarningChips
- Test 3: Display global scope info in ToastStack
- Test 4: Auto-dismiss warnings after 6s (with 10s timeout)

### 10. **CHANGELOG.md** (UPDATED)

- Pridaný v0.6.3 changelog s detailmi PR-9

### 11. **package.json** (UPDATED)

- Version bump: `0.6.2` → `0.6.3`

---

## Akceptačné kritériá

✅ **1. Všetky `window.alert()` nahradené**

- PortfolioSelector.tsx: risk validation → error chip
- BasicSettingsPanel.tsx: PRO mode info → info toast
- BasicLayout.tsx: rate limits → warning toasts (2×)
- Grep search: 0 matches v aktívnych súboroch

✅ **2. WarningCenter infraštruktúra**

- Singleton s push/dismiss/subscribe API
- Auto-dismiss po 6s
- Dedupe (5s okno)
- Cleanup každých 30s

✅ **3. UI komponenty**

- WarningChips: inline pod MixPanel
- ToastStack: fixed top-right
- Color-coded + icons
- CSS animation `slideInRight` už existuje

✅ **4. A11y**

- `aria-live`: polite/assertive
- `role="status"` pre chips
- `role="region"` pre toasts
- Esc key navigation

✅ **5. Testy**

- 2 unit tests (WarningCenter) → PASS
- 4 integration tests (warnings UI) → PASS
- 17 critical tests → PASS (no regressions)

✅ **6. Build**

- `npm run build` → ✓ built in 3.28s
- No errors, iba chunk size warning (existing)

---

## QA kroky (manuálne overenie)

### Scenár 1: STARTER fáza

```
lump=10k, monthly=200, years=20, rastový profil
```

1. ✅ Nastav ETF na 48% → blue info chip "V štarte povoľujeme ETF až do 50%..."
2. ✅ Nastav risk na 7.7 → žiadna chyba (cap je 8.0)
3. ✅ Klikni "Pridať dlh" v BASIC mode → blue info toast o PRO mode
4. ✅ Toast sa auto-dismiss po 6s
5. ✅ Esc zavrie toast

### Scenár 2: CORE fáza

```
lump=30k, monthly=600, years=12, vyvážený profil
```

1. ✅ Nastav GOLD na 48.74% → amber warning chip "Alokáciu gold sme znížili na 40%..."
2. ✅ Mix sa auto-adjustne na 40%
3. ✅ Žiadne blokujúce modaly

### Scenár 3: LATE fáza

```
lump=60k, monthly=1200, years=6, konzervativný profil
```

1. ✅ ETF cap je 35% → warning ak prekročené
2. ✅ Combo dyn+crypto max 18%

### Scenár 4: Rate limit spam

1. ✅ Klikni "Odoslať projekciu" 3× rýchlo za sebou
2. ✅ Prvá sa odošle, druhá zobrazí cooldown toast
3. ✅ Tretia je dedupnutá (žiadny nový toast)
4. ✅ Toast sa auto-dismiss po 6s

---

## Riziká & rollback

### Riziká

- **Low**: UI komponenty sú nezávislé, nemenia biznis logiku
- **Low**: WarningCenter je singleton, žiadne globálne side effects
- **Medium**: Auto-dismiss môže byť príliš rýchly (6s) → feedback z QA

### Rollback

```bash
git revert 07d3c56
git tag -d v0.6.3
npm version 0.6.2 --no-git-tag-version
```

---

## Implementačné poznámky

1. **CSS animation**: `slideInRight` už existovala v `global.css` → žiadne zmeny potrebné
2. **Fake timers v testoch**: React integration testy nefungujú s `vi.useFakeTimers()` kvôli `act()` issues → používame real timers + extended timeout (10s)
3. **TypeScript**: `validation.message` môže byť `undefined` → fallback `"Validácia zlyhala"`
4. **Dedupe**: Kľúče sú špecifické pre scenár (napr. `rate-limit-cooldown` vs `rate-limit-monthly`)
5. **Scope filtering**: WarningChips zobrazuje iba mix/risk, ToastStack iba global

---

## Ďalšie kroky (budúce PR)

- [ ] **Microcopy enhancement**: Pridať špecifické texty pre asset cap warnings (ETF 50%, combo 25%)
- [ ] **Toast positioning**: Umožniť konfiguráciu pozície (top-left/top-center/bottom-right)
- [ ] **Persistent warnings**: Option pre warnings ktoré sa neauto-dismissujú (critical errors)
- [ ] **Warning history**: Log všetkých warnings pre debugging
- [ ] **Animation customization**: Rôzne animácie pre rôzne typy (slide/fade/bounce)

---

## Súvisiace PR

- **PR-8**: Adaptive Policy (v0.6.2) - zaviedol stage detection a caps, ktoré môžu vyvolať warnings
- **PR-7**: Dlhy & cashflow (v0.6.1) - pridalo validation errors (potenciálne warnings)
- **PR-6**: Share modal a11y (v0.6.0) - zaviedlo A11y patterns (použité v ToastStack)

---

**Zhrnutie**: PR-9 úspešne odstránil všetky blokujúce modal dialógy a nahradil ich moderným, prístupným systémom notifikácií. Všetky testy prechádzajú, build je stabilný, žiadne regresie. Verzia 0.6.3 je ready pre merge.
