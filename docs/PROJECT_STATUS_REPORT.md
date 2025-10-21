# 📊 UNOTOP MVP – Kompletný Status Report (20.10.2025)

## 🎯 Executive Summary

**Verzia:** 0.6.0-beta  
**Branch:** `feat/legacy-basic`  
**Build size:** 169.01 kB (gzipped)  
**Testy:** 17/17 PASS ✅  
**Commits:** 8 major phases (60b8a77 → 968a8f4)

---

## ✅ HOTOVÉ (Phase 1-5)

### **1. UI/UX Framework (Complete)**

- ✅ **Sticky Toolbar** (Phase 1) - Logo, hamburger, BASIC/PRO toggle
- ✅ **Sidebar Navigation** (Phase 3) - 6 section links, IntersectionObserver, smooth scroll, overlay mode
- ✅ **Accordion Headers** (Phase 4) - Chevron icons (▼/▶), aria-controls, smooth collapse
- ✅ **Responsive Layout** (Phase 2, 5) - Independent scrollbars, kompaktný spacing
- ✅ **Dark Theme** - Konzistentný slate-900/950 palette

### **2. Sekcie (Content Structure)**

#### **sec0: Profil klienta** ✅

- Typ klienta (Individual/Family/Firm) - radiobuttons
- Risk preferencia (Konzervatívny/Vyvážený/Rastový) - radiobuttons s risk cap
- Krízový bias (0-3) - range slider
- Layout: 2-column grid (Typ + Risk pref vedľa seba)
- Tlačidlo "💳 Mám úver" - scroll to debts
- **Persist:** `profile.clientType`, `profile.riskPref`, `profile.crisisBias`

#### **sec-debts: Dlhy a hypotéky** ✅

- Accordion collapse (💳 icon)
- Summary chips (počet dlhov, celkové splátky, zostatok)
- Debt table (Názov, Zostatok, Úrok p.a., Splátka, Zostáva)
- Add/Delete operations
- **Persist:** `debts[]` array v v3
- **Pozícia:** Pod sec0 (logicky súvisiace s profilom)

#### **sec1: Cashflow & rezerva** ✅ (BASIC layout)

- Mesačný príjem, Fixné výdavky, Variabilné výdavky
- Súčasná rezerva (EUR), Rezerva (mesiace)
- Mesačný vklad - slider
- **Persist:** `profile.monthlyIncome`, `profile.reserveEur`, `profile.reserveMonths`

#### **sec2: Investičné nastavenia** ✅ (BASIC 4 textboxy)

- Jednorazová investícia (`lumpSumEur`)
- Mesačný vklad (`monthlyVklad`)
- Investičný horizont (`horizonYears`)
- Cieľ majetku (`goalAssetsEur`)
- **Implementácia:** Uncontrolled inputs s debounce ~120ms, blur flush
- **Persist:** `profile.lumpSumEur`, `profile.horizonYears`, `profile.goalAssetsEur`, `v3.monthly`

#### **sec3: Zloženie portfólia** ✅ (BASIC režim)

- **MixPanel component** - 7 asset sliders:
  - Zlato (fyzické), Dynamické riadenie, ETF (svet), Garantovaný dlhopis
  - Hotovosť/rezerva, Krypto, Reality
- **Format:** Celé čísla (`Math.round(pct)%`)
- **Controls:** Range sliders + number inputs
- **Actions:** Dorovnať (normalize), Apply odporúčaný mix
- **Persist:** `mix[]` array v v3
- **Vizuál:** ⚠️ **CHÝBAJÚ IKONKY** pri každom nástroji

#### **sec4: Projekcia** ✅ (Right panel, CSS progress bar)

- **Výpočet:** FV = P0 _ (1+r)^Y + PM _ 12 \* ((1+r)^Y - 1) / r
- **Live reactive:** Na zmeny lump sum, monthly, horizon, goal
- **Vizuál:** CSS progress bar (role="progressbar", aria-\*)
- **Graf:** ⚠️ **CHÝBA** - momentálne len placeholder text/bar

#### **sec5: Metriky & odporúčania** ✅ (Right panel)

- **Risk Gauge (SVG)** - prominentný, size="lg"
- **3 Scorecards:**
  - Riziko (0-10): riskScore(mix) vs. risk cap
  - Výnos/rok (odhad): approxYieldAnnualFromMix(mix)
  - Progres k cieľu: FV vs. goalAssetsEur (%)
- **CTA:** "Max výnos (riziko ≤ cap)" (placeholder)
- ⚠️ **ISSUE:** Gauge meter nereaguje na zmeny v mixe (closure problem)

### **3. Technická infraštruktúra**

#### **Persist Layer (v3.ts)** ✅

- `readV3()` / `writeV3(patch)` - dual key (colon + underscore)
- Typy: `Debt[]`, `MixItem[]`, `Profile`
- Hydration guard (skip first useEffect)
- Backward compatibility (top-level mirrors)

#### **Services & Logic**

- ✅ **mix.service.ts:**
  - `riskScore(mix)` - váhovaný scoring (dyn 0.15, crypto 0.25, etf 0.10)
  - `normalize(mix)` - presne 100%, 2 des. miesta
  - `setGoldTarget(mix, target)` - redistribute proportionally
  - `applyRiskConstrainedMix(mix, cap)` - iterative scaling
- ✅ **useUncontrolledValueInput hook** - debounce, blur flush, clamp
- ✅ **Helper functions:** `approxYieldAnnualFromMix()`, `calculateFutureValue()`

#### **Components**

- ✅ **Toolbar.tsx** - Sticky top, hamburger, BASIC/PRO toggle
- ✅ **Sidebar.tsx** - Fixed overlay, IntersectionObserver, 6 section links
- ✅ **RiskGauge.tsx** - SVG semi-circle gauge, threshold markers
- ✅ **MixPanel.tsx** - 7 asset controllers, normalize CTA
- ✅ **PageLayout.tsx** - 2-column grid (left 8/12, right 4/12 on lg)

#### **A11y (Accessibility)** ✅

- Aria-controls, aria-expanded (accordions)
- Aria-label, role="button", role="dialog"
- Keyboard navigation (Esc close, Enter/Space toggle)
- Focus management (return to trigger)
- Screen reader announcements (RiskGauge polite)

#### **Testing** ✅

- **17/17 PASS** (kritické testy)
  - `persist.roundtrip` (1 test)
  - `invariants.limits` (2 tests)
  - `deeplink.banner` (1 test)
  - `persist.debts.v3` (1 test)
  - `acceptance.mix-cap` (3 tests)
  - `accessibility.ui` (9 tests)
- Test commands: `npm run test`, `npm run test:critical`

---

## ⚠️ ZNÁME PROBLÉMY (Urgent)

### **1. 🔴 KRITICKÉ - Gauge meter nereaguje na zmeny**

**Symptóm:** Ručička Risk Gauge zostáva na rovnakej pozícii aj po zmene mixu  
**Root cause:** `sec5` číta `mix` z `readV3()` v closure IIFE:

```tsx
{
  open5 &&
    (() => {
      const v3Data = readV3();
      const mix: MixItem[] = (v3Data.mix as any) || [];
      // ...
      return <RiskGauge value={riskScore(mix)} />;
    })();
}
```

**Problém:** Closure sa neznovurenderuje keď MixPanel persistuje mix  
**Fix:** Pridať `mixVersion` state alebo `forceUpdate` trigger

**Súbor:** `src/LegacyApp.tsx` lines ~1374-1392  
**Priorita:** 🔴 HIGH (zlá UX, používateľ nevidí efekt zmien)

---

### **2. 🟡 STREDNÉ - Projekcia nemá graf (len CSS bar)**

**Symptóm:** sec4 (Projekcia) zobrazuje len CSS progress bar  
**Chýba:** Line chart s vývojom FV cez čas (rok po roku)  
**Recharts import:** ✅ Už existuje v LegacyApp.tsx (lines 16-24)  
**Data pripravenosť:** ⚠️ Treba generovať `chartData[]` array pre Recharts

**Súbor:** `src/LegacyApp.tsx` lines ~1537-1700  
**Priorita:** 🟡 MEDIUM (vizuálne atraktívnejšie, nie blocking)

---

### **3. 🟡 STREDNÉ - Zloženie portfólia nemá ikonky**

**Symptóm:** MixPanel slidery sú len texty (🏅 Zlato, 📈 Dyn. riadenie atď.)  
**Chýbajú:** Reprezentatívne SVG/emoji ikonky pre každý asset  
**Assets:**

- Zlato → 🪙 (fyzické zlato coin)
- Dyn. riadenie → 📊 (graf s trendami)
- ETF → 🌍 (globe/world)
- Dlhopis → 🏦 (bank/stability)
- Hotovosť → 💵 (dollar bills)
- Krypto → ₿ (bitcoin symbol)
- Reality → 🏠 (house)

**Súbor:** `src/features/mix/MixPanel.tsx` lines ~260-500  
**Priorita:** 🟡 MEDIUM (lepšia UX, nie blocking)

---

### **4. 🟢 NÍZKE - Investičné nastavenia vyzerajú "nudne"**

**Symptóm:** sec2 má len 4 plain textboxy (grid layout)  
**Vylepšenia:**

- Pridať ikonky pred labelmi (💰, 📅, 🎯)
- Tooltips s nápovedou ("Napr. 5000 €")
- Vizuálne oddeliť input groupy (borders, shadows)
- Animated placeholders

**Súbor:** `src/LegacyApp.tsx` lines ~690-780  
**Priorita:** 🟢 LOW (kozmetické, funkčnosť OK)

---

## 📋 TODO LIST (Prioritizované)

### **🔴 HIGH Priority (Blocker pre production)**

1. **Fix Gauge meter reactivity** - Refactor sec5 closure (use state)
2. **Validation errors UI** - Zobrazovať chybové hlášky pri nevalidných vstupoch
3. **Loading states** - Spinner pri save/load operations

### **🟡 MEDIUM Priority (UX improvements)**

4. **Projekcia graf** - Recharts line chart s FV progression
5. **MixPanel ikonky** - Vizuálne ikony pre každý asset
6. **Responsive mobile testing** - Real device testing (iOS, Android)
7. **Share modal functionality** - Email/link generation (zatiaľ placeholder)
8. **Debt amortization preview** - Mini chart v debt table

### **🟢 LOW Priority (Polish)**

9. **Investičné nastavenia styling** - Ikonky, tooltips, spacing
10. **Micro-animations** - Pulse efekty, fade-ins
11. **Empty states** - Lepšie UX keď user nemá žiadne dáta
12. **Dark/Light theme toggle** - Momentálne len dark

---

## 🔧 TECHNICKÝ DLUH (Tech Debt)

### **Code Quality**

- ⚠️ **LegacyApp.tsx je príliš veľký** (2278 lines) - Potrebuje rozdeliť na menšie komponenty
- ⚠️ **Duplicitné výpočty** - `approxYieldAnnualFromMix` a `calculateFutureValue` volaná viackrát
- ⚠️ **Closure anti-patterns** - sec5 IIFE by mala byť samostatný komponent
- ✅ **TypeScript strict mode** - OK
- ✅ **Linting** - Žiadne critical warningy

### **Performance**

- ✅ **Bundle size** - 169.01 kB (dobrá hodnota)
- ⚠️ **Rerenders** - Možné optimalizácie (React.memo, useMemo)
- ⚠️ **localStorage I/O** - Veľa `readV3()` callov (cache?)

### **Testing Coverage**

- ✅ **Critical paths** - 17/17 PASS
- ⚠️ **Edge cases** - Chýbajú testy pre invalid inputs
- ⚠️ **E2E tests** - Žiadne (len unit + integration)

---

## 📦 DEPENDENCIES (package.json)

### **Production**

- `react@19.1.1`, `react-dom@19.1.1`
- `recharts@2.15.0` (charts - používa sa čiastočne)
- `tailwindcss@3.4.17` (styling)

### **Dev/Test**

- `vite@7.1.7` (build tool)
- `vitest@3.0.5` (test runner)
- `@testing-library/react@16.1.0`
- `typescript@5.7.3`

---

## 📐 ARCHITEKTONICKÉ ROZHODNUTIA

### **Persist Strategy**

- **Dual key storage** (colon + underscore) - backward compatibility
- **Partial updates** - writeV3 merguje, neprepisuje celé
- **Type-safe** - TypeScript interfaces pre všetky struktury

### **Component Structure**

- **Monolithic LegacyApp** - Historické, treba refaktorovať
- **Feature modules** - `/features/mix`, `/persist`, `/components`
- **Service layer** - Biznis logika mimo UI (mix.service.ts)

### **State Management**

- **Local React state** - Žiadny Redux/Zustand (simple)
- **localStorage as source of truth** - Persist v3 layer
- **Uncontrolled inputs** - Debounce pattern pre performance

---

## 🚀 DEPLOYMENT STATUS

### **Build**

- ✅ `npm run build` - Success (169.01 kB)
- ✅ `npm run test:critical` - 17/17 PASS
- ⚠️ **Production URL** - TBD (Netlify? Vercel?)

### **Environment**

- ✅ **Dev mode** - `npm run dev` OK
- ⚠️ **Env variables** - Žiadne (hardcoded configs)
- ⚠️ **Error tracking** - Žiadne (Sentry?)

---

## 📊 METRIKY

| Metrika               | Hodnota              | Status         |
| --------------------- | -------------------- | -------------- |
| Bundle size (gzipped) | 169.01 kB            | ✅ OK          |
| Tests passing         | 17/17 (100%)         | ✅ OK          |
| TypeScript errors     | 0                    | ✅ OK          |
| Lint warnings         | Minor (act warnings) | ⚠️ Benign      |
| Lighthouse Score      | TBD                  | ⚠️ Not run     |
| WCAG Compliance       | Partial              | ⚠️ Needs audit |

---

## 🎨 DIZAJN SYSTÉM

### **Colors (Dark Theme)**

- Background: `slate-950` (main), `slate-900` (panels)
- Text: `slate-100` (primary), `slate-400` (secondary)
- Accent: `emerald-600` (primary), `amber-600` (secondary)
- Borders: `white/5`, `white/10` (subtle)

### **Spacing**

- Section gap: `space-y-4` (16px)
- Panel padding: `p-4 md:p-5` (16px/20px responsive)
- Button padding: `px-6 py-3` (accordions)

### **Typography**

- Font: System default (sans-serif)
- Sizes: `text-xs` (12px), `text-sm` (14px), `text-lg` (18px)
- Weights: `font-medium`, `font-semibold`, `font-bold`

### **Roundness**

- Panels: `rounded-2xl` (16px)
- Buttons: `rounded-full` (accordions), `rounded-lg` (CTA)
- Inputs: `rounded` (4px)

---

## 🔐 SECURITY

- ⚠️ **XSS Risk** - LocalStorage nie je šifrovaný (sensitive data?)
- ⚠️ **No authentication** - Projekt je MVP, žiadna autentifikácia
- ⚠️ **No server** - Všetko client-side (dáta v browser)

---

## 📞 KONTAKT & HANDOFF

**Pre AI Advisor:**

- **Repo:** `unotop/unotop-mvp` (GitHub)
- **Branch:** `feat/legacy-basic`
- **Latest commit:** `968a8f4` (Phase 5 complete)
- **Key files:**
  - `src/LegacyApp.tsx` (2278 lines - NEEDS REFACTOR)
  - `src/features/mix/MixPanel.tsx` (666 lines)
  - `src/persist/v3.ts` (persist layer)
  - `src/components/RiskGauge.tsx` (239 lines)

**Kritické issue pre immediate fix:**

```typescript
// src/LegacyApp.tsx line ~1374
// PROBLEM: Closure nereaguje na mix zmeny
{open5 && (() => {
  const v3Data = readV3(); // ❌ Toto sa nevolá pri rerender
  const mix: MixItem[] = (v3Data.mix as any) || [];
  return <RiskGauge value={riskScore(mix)} />
})()}

// FIX: Refactor na komponent alebo use mix state
```

---

## ✅ ACCEPTANCE CRITERIA (Pre production release)

### **Must Have (Blocker)**

- [ ] Fix Gauge meter reactivity
- [ ] Validation errors UI
- [ ] Loading states
- [ ] Mobile responsive testing (real devices)
- [ ] Error boundary (catch React errors)

### **Should Have (Important)**

- [ ] Projekcia graf (Recharts)
- [ ] MixPanel ikonky
- [ ] Share modal functionality
- [ ] Lighthouse score > 90

### **Nice to Have (Polish)**

- [ ] Investičné nastavenia styling
- [ ] Micro-animations
- [ ] Empty states
- [ ] Dark/Light theme toggle

---

## 📝 CHANGELOG (Recent)

### **Phase 5 (968a8f4)** - Layout Cleanup

- Kompaktnejší spacing (space-y-6 → 4)
- Konzistentné paddingy (p-4 md:p-5)
- Right panel obalené do div

### **Phase 4.5 (e372ed9)** - Profil reorganizácia

- Typ klienta + Risk pref 2-column grid
- Krízový bias kratší slider + "Mám úver" button
- Debt section presunutá pod sec0

### **Phase 4 (74b50f0)** - Accordion Headers

- Odstránený step-bar
- Klikateľné headers s chevron ikonami
- Smooth collapse animations

### **Phase 3.5 (98d7109)** - Sidebar UX fixes

- Sidebar overlay refactor
- Odstránené duplicity (Risk pref, Krízový bias)
- Mix percent celé čísla

---

**Report generated:** 2025-10-20 22:42  
**Status:** ✅ MVP FUNCTIONAL (with known issues)  
**Next milestone:** Production-ready release (fix critical issues)
