# Analýza projekčného enginu a identifikované problémy

**Dátum:** 13. november 2025  
**Účel:** Detailná analýza výpočtov, identifikácia chýb a návrh riešení pre advisora

---

## 🔴 KRITICKÉ PROBLÉMY (vyžadujú opravu)

### 1. **Krivka dlhov začína na 0 namiesto na skutočnej sume dlhu**

**Stav:**

- V grafe sa zobrazuje krivka "Dlhy (zostatok)" ktorá má začínať na celkovej sume dlhov a klesať k nule
- Používateľ hlási: "krivka dlhov stále začína na 0"

**Analýza kódu:**

```typescript
// engine.ts, riadok 93-97
const t0TotalDebt = debtStates.reduce((sum, s) => sum + s.balance, 0);
series.push({
  month: 0,
  investValue: V,
  totalDebtBalance: t0TotalDebt,  // ✅ SPRÁVNE - suma všetkých dlhov
  ...
});
```

```typescript
// ProjectionChart.tsx, riadok 125-130
const chartData = React.useMemo(() => {
  return result.series
    .filter((_, idx) => idx % 12 === 0 || idx === result.series.length - 1)
    .map((p) => ({
      year: monthsToYears(p.month),
      investície: Math.round(p.investValue),
      dlhy: Math.round(p.totalDebtBalance),  // ✅ SPRÁVNE - zobrazuje balance
      ...
    }));
}, [result.series]);
```

**Možné príčiny:**

1. ❌ Nie sú zadané žiadne dlhy (`debts` pole je prázdne alebo má `principal: 0`)
2. ❌ `monthsLeft` nie je nastavené → default 360 mesiacov → anuita je malá → dlh sa nespláca
3. ❌ Graf sa renderuje PRED načítaním dlhov z persist
4. ❌ Debt UI nepersistuje dlhy správne do `writeV3({ debts })`

**Odporúčanie pre advisora:**

- Skontrolujte či sa v localStorage skutočne ukladajú dlhy
- V DevTools konzole spustiť: `JSON.parse(localStorage.getItem("unotop:v3")).debts`
- Ak je výsledok `[]` alebo `undefined` → problém je v persiste, NIE vo výpočte

---

### 2. **Graf používa len investičný horizont, ignoruje horizont splácania dlhov**

**Stav:**

- Graf zobrazuje len prvých X rokov podľa `investParams.horizonYears` (napr. 10 rokov)
- Ak má hypotéka 30 rokov, graf sa stiahne len na 10 rokov → zvyšných 20 rokov dlhu nie je vidieť

**Aktuálna logika:**

```typescript
// ProjectionChart.tsx, riadok 69
const horizonMonths = Math.max(1, Math.round(horizonYears * 12));

// engine.ts, riadok 100-101
for (let t = 1; t <= horizonMonths; t++) {
  // Simulácia len do horizonMonths
}
```

**Problém:**

- `horizonMonths` je fixne nastavený na `investParams.horizonYears * 12`
- Engine **NEPOZNÁ** skutočnú dĺžku splácania dlhov

**Navrhované riešenie:**

```typescript
// 1. Vypočítaj maximálny horizont zo VŠETKÝCH dlhov
const maxDebtHorizon =
  debts.length > 0 ? Math.max(...debts.map((d) => d.monthsLeft || 360)) : 0;

// 2. Použij VÄČŠÍ horizont (investičný vs. dlhový)
const effectiveHorizonMonths = Math.max(horizonYears * 12, maxDebtHorizon);

// 3. Simuluj až po skutočné vyplatenie posledného dlhu
for (let t = 1; t <= effectiveHorizonMonths; t++) {
  // ...
}
```

**Odporúčanie pre advisora:**

- Graf by mal automaticky predlžiť X-ovú os na najdlhší horizont (investície vs. dlhy)
- Príklad: Investície 10r, Hypotéka 30r → graf zobrazí 30 rokov

---

### 3. **Prelom (crossover) sa nezobrazuje pri jednorazovej investícii**

**Stav:**

- Používateľ hlási: "Krivka prelomu na grafe sa zobrazuje len v prípade že nie je nastavená jednorazová investícia"

**Aktuálna logika crossover:**

```typescript
// engine.ts, riadok 153-159
let crossoverMonth: number | null = null;
for (const p of series) {
  if (p.investValue >= p.totalDebtBalance && p.totalDebtBalance > 0) {
    crossoverMonth = p.month;
    break;
  }
}
```

**Analýza:**

- Podmienka: `investValue >= totalDebtBalance && totalDebtBalance > 0`
- Ak `lumpSumEur = 50000` a `totalDebt = 30000` → už v mesiaci 0 je `investValue > totalDebt`
- Crossover sa **detekuje správne**, ale môže byť v mesiaci 0

**Možný problém v zobrazení:**

```typescript
// ProjectionChart.tsx, riadok 169
{crossoverYear !== null && (
  <div className="p-3 rounded-lg bg-emerald-900/20 ...">
    ✅ Bod prelomu dosiahnutý
  </div>
)}
```

**Testovací scenár:**

- `lumpSumEur = 0`, `monthlyVklad = 500`, `debts = 20000` → crossover v mesiaci X ✅
- `lumpSumEur = 50000`, `monthlyVklad = 0`, `debts = 20000` → crossover v mesiaci 0 ✅

**Odporúčanie pre advisora:**

- Skontrolujte či sa crossover zobrazuje správne aj pri lumpSum > debts
- Ak nie, problém je v **UI renderingu**, NIE vo výpočte
- Pridať console.log do `ProjectionChart.tsx` pred `return`:
  ```typescript
  console.log("Crossover debug:", {
    crossoverMonth: result.crossoverMonth,
    crossoverYear,
    lumpSumEur,
    totalDebt: debts.reduce((s, d) => s + d.principal, 0),
  });
  ```

---

### 4. **Onboarding tour sa spúšťa po GDPR kliknutí a po Reset**

**Problémy:**

1. ❌ Po kliknutí na "Zásady ochrany súkromia" v Intro sa onboarding spustí hneď (prekrýva GDPR modal)
2. ❌ Po kliknutí na "Reset" v toolbar sa onboarding spustí znovu

**Aktuálna logika (po dnešnej oprave):**

```typescript
// BasicLayout.tsx, riadok 115-125
const checkWelcome = () => {
  const welcomeSeen = localStorage.getItem("unotop:welcome-seen");
  const tourCompleted = completedSteps.length === 5;

  // PR-10 Fix: GDPR link v Intro nesmie spustiť tour
  const skipTour = sessionStorage.getItem("unotop_skipTourAfterIntro");
  if (skipTour) {
    sessionStorage.removeItem("unotop_skipTourAfterIntro");
    return; // ✅ Zabráni spusteniu
  }

  if (welcomeSeen && !tourCompleted && !tourOpen && !hasStarted) {
    // Spusti tour po 2.5s
  }
};
```

**Problém č.1:** GDPR modal má nižší z-index než onboarding

- **Riešenie A:** Zvýšiť z-index PrivacyModal na `z-[9999]` (rovnaký ako WelcomeModal)
- **Riešenie B:** Nechať Intro otvorený počas GDPR → GDPR renderovať NAD intro

**Problém č.2:** Reset vymaže `localStorage` → tour sa spustí znovu

- `handleReset()` volá `localStorage.clear()` → vymaže aj `welcome-seen` flag
- **Riešenie:** Reset nesmie vymazať onboarding flags:

```typescript
const handleReset = () => {
  // Zachovaj onboarding stav
  const welcomeSeen = localStorage.getItem("unotop:welcome-seen");
  const tourSteps = localStorage.getItem("unotop:tour-completed-steps");

  localStorage.clear();

  // Obnov onboarding flags
  if (welcomeSeen) localStorage.setItem("unotop:welcome-seen", welcomeSeen);
  if (tourSteps) localStorage.setItem("unotop:tour-completed-steps", tourSteps);

  location.reload();
};
```

---

### 5. **Chýba UI na úpravu existujúcich dlhov a pridanie mimoriadnej splátky**

**Stav:**

- Po pridaní dlhu užívateľ nemôže:
  1. Upraviť dlh (zmeniť principal, úrok, splátku)
  2. Pridať/upraviť mimoriadnu splátku

**Aktuálne UI:**

- Debt form má len "Pridať dlh"
- Po pridaní sa dlh zobrazí v tabuľke s tlačidlom "Zmazať"
- **Žiadne tlačidlo "Upraviť"**

**Bankový predpis - maximálna mimoriadna splátka:**

- Max. 20% zostatkovej istiny **ročne**
- Prepočet na mesačnú splátku: `maxMonthlyExtra = (principal * 0.20) / 12`

**Príklad:**

- Principal: 100 000 €
- Max ročná extra: 20 000 €
- Max mesačná extra: **1 667 €/mes**

**Navrhované UI:**

1. Tlačidlo "Upraviť" pri každom dlhu v tabuľke
2. Edit modal:
   - Polia: Principal, Úrok p.a., Mesačná splátka, Zostáva mesiacov
   - **Slider/input:** Mimoriadna splátka (0 - max 20% ročne)
   - Zobrazenie: "Max. 1 667 €/mes (20% z istiny ročne)"
3. Persist do `debt.extraMonthly`

---

## ✅ VÝPOČTOVÉ VZORCE (pre advisora)

### A. **Mesačná anuita (Fixed Payment)**

**Vzorec:**

```
M = P × r / (1 - (1 + r)^(-n))

kde:
  P = principal (istina v €)
  r = mesačná úroková sadzba (konvertovaná z p.a.)
  n = počet mesiacov (termMonths)
```

**Konverzia ročnej sadzby na mesačnú (compound interest):**

```
r_monthly = (1 + r_annual)^(1/12) - 1

Príklad:
  r_annual = 0.04 (4% p.a.)
  r_monthly = (1.04)^(1/12) - 1 = 0.003274 (0.3274% mesačne)
```

**Príklad výpočtu:**

```
Principal: 100 000 €
Úrok p.a.: 4%
Splatnosť: 360 mesiacov (30 rokov)

r = (1.04)^(1/12) - 1 = 0.003274
M = 100000 × 0.003274 / (1 - 1.04^(-30))
M = 327.4 / (1 - 0.30832)
M = 327.4 / 0.69168
M ≈ 477.42 €/mes
```

**Implementácia v kóde:**

```typescript
// engine.ts, riadok 15-25
function calculateAnnuity(
  principal: number,
  monthlyRate: number,
  termMonths: number
): number {
  if (termMonths <= 0 || principal <= 0) return 0;
  if (monthlyRate === 0) return principal / termMonths;
  const denominator = 1 - Math.pow(1 + monthlyRate, -termMonths);
  return (principal * monthlyRate) / denominator;
}
```

---

### B. **Amortizácia dlhu (mesačne)**

**Algoritmus:**

```
Pre každý mesiac t:
1. Úrok = balance × r
2. Istina = M - Úrok + Extra
3. Nový zostatok = max(0, balance - Istina)
```

**Príklad (prvé 3 mesiace):**

```
t=0:  Balance = 100 000 €

t=1:
  Úrok = 100 000 × 0.003274 = 327.40 €
  Istina = 477.42 - 327.40 = 150.02 €
  Balance = 100 000 - 150.02 = 99 849.98 €

t=2:
  Úrok = 99 849.98 × 0.003274 = 326.91 €
  Istina = 477.42 - 326.91 = 150.51 €
  Balance = 99 849.98 - 150.51 = 99 699.47 €

t=3:
  Úrok = 99 699.47 × 0.003274 = 326.42 €
  Istina = 477.42 - 326.42 = 151.00 €
  Balance = 99 699.47 - 151.00 = 99 548.47 €
```

**Implementácia v kóde:**

```typescript
// engine.ts, riadok 107-127
for (const s of debtStates) {
  if (s.balance <= 0) continue;

  const extraOnce = s.oneOffMap.get(t) ?? 0;
  const extraRecur =
    s.recurring && t >= s.recurring.startMonth ? s.recurring.amount : 0;

  const interest = s.balance * s.r;
  let principalPart = s.M - interest + extraRecur + extraOnce;

  if (principalPart < 0) principalPart = 0;

  const newBalance = Math.max(0, s.balance - principalPart);
  s.balance = newBalance;
}
```

---

### C. **Mimoriadne splátky**

**Typy:**

1. **Jednorazová** (one-off): napr. 5000 € v mesiaci 12
2. **Opakovaná** (recurring): napr. +200 €/mes od mesiaca 1

**Efekt na amortizáciu:**

```
Istina (s extra) = M - Úrok + Extra_recurring + Extra_once
Balance_new = Balance_old - Istina
```

**Príklad s extra 200 €/mes:**

```
t=1 (bez extra):
  Istina = 477.42 - 327.40 = 150.02 €

t=1 (s extra 200 €):
  Istina = 477.42 - 327.40 + 200 = 350.02 €
  Balance = 100 000 - 350.02 = 99 649.98 €

  → O 200 € rýchlejšie splácanie
```

**Bankový limit (20% ročne):**

```
Max ročná extra = Principal × 0.20
Max mesačná extra = (Principal × 0.20) / 12

Príklad (100k €):
  Max ročne: 20 000 €
  Max mesačne: 1 667 €
```

---

### D. **Investičný rast (compound interest)**

**Vzorec:**

```
V_t = (V_{t-1} + monthly) × (1 + r_inv)

kde:
  V_t = hodnota v mesiaci t
  monthly = mesačný vklad
  r_inv = mesačná výnosová sadzba
```

**Konverzia ročného výnosu na mesačný:**

```
r_inv_monthly = (1 + r_annual)^(1/12) - 1

Príklad (6% p.a.):
  r_inv = (1.06)^(1/12) - 1 = 0.004868 (0.4868% mesačne)
```

**Príklad výpočtu (prvé 3 mesiace):**

```
Jednorazová investícia: 10 000 €
Mesačný vklad: 500 €
Ročný výnos: 6% p.a.
r_inv = 0.004868

t=0:  V = 10 000 €

t=1:
  V = (10 000 + 500) × 1.004868 = 10 551.11 €

t=2:
  V = (10 551.11 + 500) × 1.004868 = 11 104.93 €

t=3:
  V = (11 104.93 + 500) × 1.004868 = 11 661.47 €
```

**Implementácia v kóde:**

```typescript
// engine.ts, riadok 64-66
const rInv =
  invest.annualYieldPct > 0
    ? Math.pow(1 + invest.annualYieldPct / 100, 1 / 12) - 1
    : 0;

// engine.ts, riadok 102
V = (V + invest.monthly) * (1 + rInv);
```

---

### E. **Crossover (prelom) detekcia**

**Definícia:**

- Prvý mesiac, kde **investície >= dlhy**

**Algoritmus:**

```
Pre každý mesiac t v series:
  if investValue >= totalDebtBalance AND totalDebtBalance > 0:
    crossoverMonth = t
    break
```

**Edge cases:**

1. **Lump sum > debts:** Crossover v mesiaci 0
2. **Žiadne dlhy:** Crossover = null (neexistuje)
3. **Investície nikdy nedosiahnu dlhy:** Crossover = null

**Príklad:**

```
Scenár A (postupný crossover):
  Lump: 0 €, Monthly: 500 €, Debts: 20 000 €

  t=0:   Inv = 0,     Debt = 20000  (no crossover)
  t=12:  Inv = 6307,  Debt = 18200  (no crossover)
  t=24:  Inv = 13040, Debt = 16300  (no crossover)
  t=36:  Inv = 20220, Debt = 14250  ✅ CROSSOVER

  → crossoverMonth = 36 (3 roky)

Scenár B (okamžitý crossover):
  Lump: 50000 €, Monthly: 0 €, Debts: 30000 €

  t=0:   Inv = 50000, Debt = 30000  ✅ CROSSOVER

  → crossoverMonth = 0
```

**Implementácia v kóde:**

```typescript
// engine.ts, riadok 153-159
let crossoverMonth: number | null = null;
for (const p of series) {
  if (p.investValue >= p.totalDebtBalance && p.totalDebtBalance > 0) {
    crossoverMonth = p.month;
    break;
  }
}
```

---

## 🔍 VERIFIKÁCIA VÝPOČTOV

### Test Case 1: Základná hypotéka

**Vstupy:**

```
Principal: 150 000 €
Úrok p.a.: 3.5%
Splatnosť: 300 mesiacov (25 rokov)
Extra splátka: 0 €
```

**Očakávaný výstup:**

```
r_monthly = (1.035)^(1/12) - 1 = 0.002871 (0.2871%)
Anuita M = 150000 × 0.002871 / (1 - 1.035^(-25))
         = 430.65 / (1 - 0.41727)
         = 430.65 / 0.58273
         = 739.04 €/mes
```

**Verifikácia v kóde:**

```typescript
const debt: DebtInput = {
  id: "test-1",
  kind: "mortgage",
  principal: 150000,
  annualRate: 3.5,
  termMonths: 300,
};

const r = Math.pow(1.035, 1 / 12) - 1; // 0.002871
const M = calculateAnnuity(150000, r, 300);
console.log("Anuita:", M); // Expected: 739.04 €
```

---

### Test Case 2: Spotrebný úver s extra splátkou

**Vstupy:**

```
Principal: 10 000 €
Úrok p.a.: 8%
Splatnosť: 60 mesiacov (5 rokov)
Extra splátka: 100 €/mes (od mesiaca 1)
```

**Očakávaný výstup:**

```
r_monthly = (1.08)^(1/12) - 1 = 0.006434 (0.6434%)
Anuita M = 10000 × 0.006434 / (1 - 1.08^(-5))
         = 64.34 / (1 - 0.68058)
         = 64.34 / 0.31942
         = 201.41 €/mes

S extra 100 €/mes:
  Celková splátka = 201.41 + 100 = 301.41 €/mes
  Rýchlejšie splatenie (približne 40 mesiacov namiesto 60)
```

---

### Test Case 3: Investície s compoundingom

**Vstupy:**

```
Lump sum: 5 000 €
Mesačný vklad: 300 €
Ročný výnos: 7% p.a.
Horizont: 120 mesiacov (10 rokov)
```

**Očakávaný výstup (približný):**

```
r_inv = (1.07)^(1/12) - 1 = 0.005654 (0.5654%)

t=0:    V = 5 000 €
t=12:   V ≈ 9 000 €
t=60:   V ≈ 30 000 €
t=120:  V ≈ 57 000 €

(Presný výpočet vyžaduje iteráciu všetkých 120 mesiacov)
```

---

## 📋 ODPORÚČANIA PRE ADVISORA

### Bezodkladné kontroly:

1. **Debt persist test:**

   ```javascript
   // V DevTools konzole:
   const v3 = JSON.parse(localStorage.getItem("unotop:v3"));
   console.log("Dlhy v persist:", v3.debts);
   // Očakávaný výstup: [{ id, name, principal, ratePa, monthly, monthsLeft }]
   ```

2. **Crossover test:**
   - Zadať: Lump 50k €, Dlhy 30k € → Crossover by mal byť v mesiaci 0
   - Zadať: Lump 0 €, Monthly 500 €, Dlhy 20k € → Crossover cca mesiac 36-40

3. **Debt curve test:**
   - Zadať hypotéku: 100k €, 4% p.a., 360 mes.
   - Graf by mal začínať na 100k € a klesať
   - Ak začína na 0 → problém v UI renderingu (nie vo výpočte)

### Dlhodobé úpravy:

1. ✅ Pridať UI na úpravu dlhov
2. ✅ Mimoriadne splátky s bankovým limitom (20% ročne)
3. ✅ Dynamický horizont grafu (max z investícií a dlhov)
4. ✅ Fix onboarding tour po Reset a GDPR
5. ✅ Vymazanie profilu pri zmene nastavení (už opravené)

---

**Poznámka:** Všetky vzorce používajú **compound interest** (nie simple interest), čo je bežný štandard v bankovníctve.
