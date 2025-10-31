# 🔍 PR-4 Phase 1 — Detailný snapshot pre advisora

**Dátum:** 2025-10-30  
**Dev server:** http://localhost:5174/  
**Build:** 665.15 kB  
**Status:** HOTFIX COMMITTED (unlockMix + debts refresh)

---

## 🎯 ČO BY SI MAL VIDIEŤ (step-by-step checklist)

### ✅ **KROK 1: Otvor aplikáciu**

```
URL: http://localhost:5174/
```

---

### ✅ **KROK 2: Profil klienta (prvý krok)**

**Kde:** Ľavá strana, hore — tlačidlá "Jednotlivec" / "Rodina" / "Firma"

**Test:**

1. Vyber "Jednotlivec" (default)
2. **Očakávaný výsledok:** Tlačidlo zvýraznené modrou

---

### ✅ **KROK 3: Cashflow (prvý panel)**

**Kde:** Ľavá strana, pod profilom

**Polia:**

- Mesačný príjem: `3000` €
- Fixné výdavky: `1500` €
- Variabilné výdavky: `800` €
- **Voľné prostriedky:** `700 €/mes` (auto-výpočet, zelený box)

---

### ✅ **KROK 4: MixLocked chip (Task 1)**

**Test:**

1. Scrollni dole → "Portfolio Selection" panel
2. Klikni na **"Vyvážené"** preset
3. **Očakávaný výsledok:**
   - Chip "🔒 Portfólio zamknuté" sa zobrazí (pravá strana, nad grafom mixu)
   - Button "Zmeniť mix"

**Kde hľadať chip:**

```
Pravá strana obrazovky
→ Hneď NAD grafom "Zloženie portfólia"
→ Chip: "🔒 Portfólio zamknuté" | [Zmeniť mix]
```

**Ak NEVIDÍŠ:**

- Skontroluj či si klikol na preset (Konzerv/Vyváž/Rast)
- Alebo skús posunúť slider v mixe → chip sa zobrazí

---

### ✅ **KROK 5: Goal slider (Task 2)**

**Kde:** Pravá strana, "Investičné nastavenia" panel

**Test:**

1. Nájdi pole "Cieľ majetku" (amber box s ikonou ⭐)
2. Pod inputom je **slider** (5,000 - 1,000,000 €)
3. Ťahaj slider doprava
4. **Očakávaný výsledok:**
   - Input hodnota sa mení synchronne
   - Krok: 500 € (napr. 5000 → 5500 → 6000...)

**Presná lokácia:**

```
Pravá strana (Investičné nastavenia)
→ Jednorazová investícia
→ Mesačný vklad
→ Investičný horizont (roky)
→ ⭐ Cieľ majetku ← TU JE SLIDER
```

---

### ✅ **KROK 6: Pridať dlh (Task 4)**

**Kde:** Ľavá strana, Cashflow panel

**Test:**

1. Nájdi button **"💳 Pridať dlh alebo hypotéku"** (pod Variabilné výdavky)
2. Klikni
3. **Očakávaný výsledok:** Modal sa otvorí

**Modal fields:**

- Typ dlhu: [Spotrebiteľský] / [Hypotéka] ← klikni Hypotéka
- Výška úveru (€): `100000`
- Úrok p.a. (%): `3`
- Splatnosť (roky): `25`
- Mimoriadna mesačná splátka (€): nechaj prázdne

4. Klikni **"Pridať dlh"**
5. **Očakávaný výsledok:**
   - Modal sa zatvorí
   - **KPI bar sa zobrazí** (nad Voľné prostriedky):
     ```
     Dlhy: 1 | Splátky: ~474 €
     ```

**Presná lokácia KPI bar:**

```
Ľavá strana, Cashflow panel
→ Variabilné výdavky slider
→ [Pridať dlh alebo hypotéku] button
→ KPI bar: "Dlhy: 1 | Splátky: XXX €" ← TU
→ Voľné prostriedky (zelený box)
```

---

### ✅ **KROK 7: DebtVsInvestmentChart (Task 8)**

**Kde:** Pravá strana, BasicProjectionPanel → POD risk gauge

**Test:**

1. Po pridaní dlhu (Krok 6)
2. Scrollni pravú stranu dole
3. Nájdi **Risk Gauge** (10 zelených čiarok s číslom "X.X/Y.Y")
4. **POD ním** by mal byť **chart**

**Očakávaný výsledok:**

```
┌─────────────────────────────────────┐
│ Investícia vs. Dlh                  │
│ 🎯 Priesečník v roku 15 — invest... │
│                                     │
│  [GRAF]                             │
│  🟢 Zelená čiara = Investícia       │
│  🔴 Červená čiara = Dlh             │
│  🟡 Žltá prerušovaná = Rok 15       │
└─────────────────────────────────────┘
```

**Ak NEVIDÍŠ:**

- Skontroluj či si pridал dlh (Krok 6)
- Refresh stránku (F5)
- Skontroluj konzolu (F12) → chyby?

---

### ✅ **KROK 8: DirtyChangesChip (Task 5)**

**Kde:** Pravá strana, NAD projekciou (hneď pod toolbar)

**Test:**

1. Zmeň **"Jednorazová investícia"** z `0` na `10000`
2. **Očakávaný výsledok:**
   - Chip sa zobrazí: "⏳ Zmeny čakajú na prepočítanie"
   - Button: "Prepočítať projekciu"

3. Klikni **"Prepočítať projekciu"**
4. **Očakávaný výsledok:**
   - Chip zmizne
   - Graf sa aktualizuje
   - **Mix sa prepočíta** (21.4% → nové hodnoty)
   - "Konečná hodnota" sa zmení

**Presná lokácia:**

```
Pravá strana
→ [Toolbar s BASIC/PRO prepínačom]
→ ⏳ Zmeny čakajú... | [Prepočítať] ← TU
→ [Projekcia panel s grafom]
```

---

### ✅ **KROK 9: Cash alerts SKRYTÉ (Task 3)**

**Kde:** BasicProjectionPanel (pravá strana)

**Test:**

1. Scrollni pravú stranu
2. Hľadaj **oranžové/žlté hlášky** typu:
   - "Máte príliš veľa hotovosti..."
   - "Zvážte optimalizáciu..."

3. **Očakávaný výsledok:**
   - V BASIC režime **NEVIDÍŠ** tieto hlášky
   - (V PRO by sa zobrazovali)

---

## 🐛 HOTFIX (commitnuté dnes):

### **Problém 1:** CTA "Prepočítať projekciu" neunlockovala mix

**Symptóm:** Po kliknutí na CTA ostali fixné hodnoty 21.4%, 16.2%, 11%  
**Fix:** Pridaný `unlockMix()` do `DirtyChangesChip.handleRecompute()`  
**File:** `src/features/ui/DirtyChangesChip.tsx`

```typescript
const handleRecompute = () => {
  saveSnapshot();
  unlockMix(); // ← NOVÉ: Unlock aby PR-17.D effect mohol prepočítať
  setDirty(false);
  onRecompute();
};
```

### **Problém 2:** DebtVsInvestmentChart sa nezobrazoval

**Symptóm:** Po pridaní dlhu chart nebol visible  
**Fix:** Pridaný useEffect na sledovanie `seed.debts.length`  
**File:** `src/BasicLayout.tsx`

```typescript
// Refresh projekciu pri zmene dlhov
React.useEffect(() => {
  const v3 = readV3();
  const debtsCount = (v3.debts || []).length;
  setProjectionRefresh((p) => p + 1);
}, [(seed.debts || []).length]);
```

---

## 📊 TECHNICKÉ DETAILY (pre debugging)

### **Persist v3 struktura:**

```typescript
{
  debts: [
    {
      id: "debt-1730319600000",
      name: "Hypotéka",
      principal: 100000,
      ratePa: 3, // percent
      monthly: 474.21, // base + extra
      monthsLeft: 300, // 25 rokov * 12
      remaining: 100000,
      extraMonthly: 0
    }
  ],
  mix: [
    { key: "gold", pct: 13 },
    { key: "etf", pct: 32 },
    // ... (normalizované na 100%)
  ],
  mixLocked: true, // Po výbere profilu alebo manuálnom ťahu
  profile: {
    monthlyIncome: 3000,
    fixedExp: 1500,
    varExp: 800,
    lumpSumEur: 10000,
    horizonYears: 10,
    goalAssetsEur: 50000,
    clientType: "individual",
    riskPref: "vyvazeny"
  }
}
```

### **Projekcia snapshot (Task 5):**

```typescript
// localStorage: "unotop:projectionSnapshot"
{
  lumpSumEur: 10000,
  monthlyVklad: 200,
  horizonYears: 10,
  goalAssetsEur: 50000,
  timestamp: 1730319600000
}
```

**Logika:**

- Pri zmene inputov → `isDirty()` vráti `true` → chip sa zobrazí
- Po kliknutí CTA → `saveSnapshot()` → `unlockMix()` → refresh

---

## 🧪 TEST SCENÁRE (pre kompletné testovanie)

### **Scenár A: Základný flow**

1. Otvor app → vyber Jednotlivec
2. Cashflow: 3000/1500/800 → Voľné: 700 €/mes
3. Vyber "Vyvážené" → chip "🔒 Portfólio zamknuté"
4. Goal slider: posun na 50,000 €
5. Jednorazová investícia: 10,000 €
6. Chip "Zmeny čakajú..." → klikni "Prepočítať"
7. **Výsledok:** Graf updated, mix prepočítaný

### **Scenár B: Debt flow**

1. Klikni "Pridať dlh"
2. Hypotéka 100,000 €, 3%, 25 rokov
3. Klikni "Pridať dlh"
4. **Výsledok:**
   - KPI bar: "Dlhy: 1 | Splátky: 474 €"
   - Chart sa zobrazí POD risk gauge

### **Scenár C: Mix lock/unlock**

1. Vyber "Vyvážené" → locked
2. Klikni "Zmeniť mix"
3. Posun Gold slider
4. **Výsledok:** Mix unlocked, slider funguje
5. Po ťahu → mix locked znova

---

## 📁 SÚBORY (pre review)

### **Nové súbory (7):**

1. `src/features/mix/mix-lock.ts` — lockMix(), unlockMix(), isMixLocked()
2. `src/features/mix/MixLockChip.tsx` — Chip "🔒 Portfólio zamknuté"
3. `src/features/debts/AddDebtModal.tsx` — Modal na pridanie dlhu
4. `src/features/overview/projectionSnapshot.ts` — Snapshot mechanizmus
5. `src/features/ui/DirtyChangesChip.tsx` — Chip + CTA "Prepočítať"
6. `src/features/projection/DebtVsInvestmentChart.tsx` — Recharts chart
7. `PR-4-IMPLEMENTATION-REPORT.md` — Detailná dokumentácia

### **Upravené súbory (6):**

1. `src/persist/v3.ts` — Added `mixLocked?: boolean`
2. `src/features/portfolio/PortfolioSelector.tsx` — lockMix() po preset
3. `src/features/mix/MixPanel.tsx` — lockMix() po slider, render chip
4. `src/BasicLayout.tsx` — mixLocked check, DirtyChangesChip, debts useEffect
5. `src/features/basic/BasicSettingsPanel.tsx` — Goal slider, debt button, KPI bar
6. `src/features/overview/BasicProjectionPanel.tsx` — Snapshot, mode prop, DebtChart

---

## 🔧 DEBUGGING TIPY

### **Ak NEVIDÍŠ mixLocked chip:**

```javascript
// Otvor konzolu (F12) a skontroluj:
localStorage.getItem("unotop:v3");
// Hľadaj: "mixLocked": true
```

### **Ak NEVIDÍŠ goal slider:**

```
Pravá strana → Investičné nastavenia
→ Scroll dole k poli "Cieľ majetku"
→ POD inputom by mal byť slider (amber box)
```

### **Ak NEVIDÍŠ debt KPI bar:**

```javascript
// Konzola:
JSON.parse(localStorage.getItem("unotop:v3")).debts;
// Expected: [{ id: "debt-...", name: "Hypotéka", ... }]
```

### **Ak NEVIDÍŠ DebtVsInvestmentChart:**

```
1. Pridaj dlh (Krok 6)
2. Refresh stránku (F5)
3. Scroll pravú stranu → POD risk gauge (10 zelených čiarok)
4. Ak stále nič → otvor konzolu, hľadaj errors
```

### **Ak CTA "Prepočítať" nestále nefunguje:**

```javascript
// Konzola (po kliknutí CTA):
localStorage.getItem("unotop:projectionSnapshot");
// Expected: timestamp by sa mal zmeniť

JSON.parse(localStorage.getItem("unotop:v3")).mixLocked;
// Expected: false (po CTA by mal byť unlocked)
```

---

## 📸 SCREENSHOTS (kde ich nájsť)

### **MixLocked chip (Task 1):**

```
Location: Pravá strana, nad grafom mixu
Visual: Chip s ikonou 🔒, text "Portfólio zamknuté"
Button: "Zmeniť mix" (sivý, hover: modrý)
```

### **Goal slider (Task 2):**

```
Location: Pravá strana, Investičné nastavenia panel
Visual: Amber box, ikona ⭐, label "Cieľ majetku"
Slider: Pod inputom, range 5k-1M, step 500
```

### **Debt KPI bar (Task 4):**

```
Location: Ľavá strana, Cashflow panel (pod button "Pridať dlh")
Visual: Sivý box, text "Dlhy: 1 | Splátky: XXX €"
Colors: Splátky = amber (výrazná)
```

### **DirtyChangesChip (Task 5):**

```
Location: Pravá strana, NAD projekciou (pod toolbar)
Visual: Amber box, ikona ⏳, button "Prepočítať projekciu"
State: Zobrazí sa len pri dirty state
```

### **DebtVsInvestmentChart (Task 8):**

```
Location: Pravá strana, POD risk gauge (10 zelených čiarok)
Visual: Recharts graf, 2 lines (zelená/červená), žltá dashed line
Label: "Investícia vs. Dlh" + "🎯 Priesečník v roku X"
```

---

## 🚀 NEXT STEPS (pre teba)

1. **Otestuj všetkých 9 krokov vyššie** (http://localhost:5174/)
2. **Screenshoty:** Urob screenshot každej feature (ak chceš)
3. **Feedback:** Napíš mi:
   - Čo VIDÍŠ ✅
   - Čo NEVIDÍŠ ❌
   - Čo funguje inak ako očakávaš 🤔

4. **Potom rozhodneme:**
   - Push na GitHub? 🚀
   - Ďalšie fixy? 🔧
   - PR-5 (contact validation)? 📝

---

## 📞 KONTAKT PRE BUGS

Ak niečo nefunguje:

1. Otvor konzolu (F12) → skopíruj errory
2. Urob screenshot problému
3. Napíš mi presne čo si robil (kroky)
4. Poviem ti fix

---

**Status:** ✅ HOTFIX COMMITTED, DEV SERVER RUNNING  
**URL:** http://localhost:5174/  
**Build:** 665.15 kB  
**Tests:** 17/17 PASS

**Čakám na tvoj feedback!** 😊
