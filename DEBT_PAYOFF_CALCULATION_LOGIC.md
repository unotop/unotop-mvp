# Logika výpočtu vyplatenia dlhu - Pre Advisora

**Dátum:** 14.11.2025  
**Problém:** Vyplatenie úveru ukazuje nesprávny rok (napr. 2054 namiesto očakávaného)

---

## 1. Vstupné dáta (z EditDebtModal)

Keď používateľ pridá/upraví dlh, uloží sa:

```typescript
const savedDebt: Debt = {
  id: "uuid-123",
  type: "mortgage" | "consumer",
  name: "Hypotéka Byt",
  principal: 150000, // Výška istiny v €
  ratePa: 3.5, // Úrok p.a. v % (napr. 3.5%)
  monthly: 673.57, // Mesačná splátka (vypočítaná anuitná)
  monthsLeft: 360, // Zostávajúci čas v mesiacoch (roky * 12)
  extraMonthly: 0, // Extra mesačná splátka (voliteľné)
};
```

### Výpočet mesačnej splátky (anuitná):

```typescript
const yearsNum = parseFloat(years); // Napr. 30
const monthsLeft = Math.round(yearsNum * 12); // = 360

const monthlyRate = rateNum / 100 / 12; // 3.5 / 100 / 12 = 0.002917
const monthly =
  (principalNum * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -monthsLeft));

// Pre 150k €, 3.5%, 30 rokov → monthly ≈ 673.57 €
```

---

## 2. Výpočet amortizácie (scheduleWithExtra)

**Súbor:** `src/features/debt/amortization.ts`

```typescript
export function scheduleWithExtra(
  principal: number, // 150000
  annualRate: number, // 0.035 (už prevedené z %)
  termMonths: number, // 360
  extraMonthly: number // 0
): AmortizationSchedule {
  const monthlyRate = annualRate / 12; // 0.002917
  const basePayment = annuityPayment(principal, annualRate, termMonths);

  // Vypočítaj plán S extra
  const extraSchedule = calculateSchedule(
    principal,
    monthlyRate,
    basePayment,
    termMonths,
    extraMonthly
  );

  return {
    balances: extraSchedule.balances, // [150000, 149763, 149524, ...]
    payoffMonth: extraSchedule.payoffMonth, // 360 (index posledného mesiaca)
    totalInterest: extraSchedule.totalInterest,
    monthsSaved: 0,
    interestSaved: 0,
  };
}
```

### Helper: calculateSchedule

```typescript
function calculateSchedule(
  principal: number,
  monthlyRate: number,
  basePayment: number,
  maxMonths: number,
  extraMonthly: number
): { balances: number[]; payoffMonth: number; totalInterest: number } {
  const balances: number[] = [];
  let balance = principal;
  let totalInterest = 0;
  let month = 0;

  balances.push(balance); // Month 0 = starting balance (150000)

  while (balance > 0.01 && month < maxMonths * 2) {
    month++;

    // Úrok za tento mesiac
    const interestPayment = balance * monthlyRate;
    totalInterest += interestPayment;

    // Celková splátka = base + extra
    const totalPayment = basePayment + extraMonthly;

    // Istina = total payment - úrok
    let principalPayment = totalPayment - interestPayment;

    // Posledná splátka: nezaplatíme viac než zostatok
    if (principalPayment >= balance) {
      principalPayment = balance;
      balance = 0;
    } else {
      balance -= principalPayment;
    }

    balances.push(balance);
  }

  return {
    balances, // [150000, 149763, ..., 0]
    payoffMonth: month, // 360 (presný mesiac kedy balance = 0)
    totalInterest, // Celkový zaplatený úrok
  };
}
```

**Výstup pre 150k €, 3.5%, 30 rokov:**

- `payoffMonth = 360` (30 rokov = 360 mesiacov)
- `balances[360] = 0` (dlh splatený)

---

## 3. Použitie v projekcii (useProjection)

**Súbor:** `src/features/projection/useProjection.ts`

```typescript
let debtPayoffMonth: number | null = null;

debts.forEach((debt) => {
  const termMonths = debt.monthsLeft || 0; // 360

  const schedule = scheduleWithExtra(
    debt.principal, // 150000
    debt.ratePa / 100, // 0.035
    termMonths, // 360
    debt.extraMonthly || 0 // 0
  );

  // DEBUG výpis (v konzole):
  console.log("🔍 DEBUG debt calculation:", {
    debtName: debt.name, // "Hypotéka Byt"
    principal: debt.principal, // 150000
    ratePa: debt.ratePa, // 3.5
    monthsLeft: termMonths, // 360
    extraMonthly: debt.extraMonthly || 0, // 0
    payoffMonth: schedule.payoffMonth, // 360
    payoffYears: (schedule.payoffMonth / 12).toFixed(1), // "30.0"
  });

  // Track najneskorší payoff
  if (debtPayoffMonth === null || schedule.payoffMonth > debtPayoffMonth) {
    debtPayoffMonth = schedule.payoffMonth; // 360
  }
});
```

**Výsledok:** `debtPayoffMonth = 360` mesiacov

---

## 4. Formátovanie dátumu (DebtSummaryCard)

**Súbor:** `src/features/debt/DebtSummaryCard.tsx`

```typescript
const formatPayoffDate = (month: number | null): string => {
  if (!month) return "—";

  const now = new Date(); // Dnešný dátum: 2025-11-14

  // Pridaj `month` mesiacov k dnešnému dátumu
  const payoffDate = new Date(now.getFullYear(), now.getMonth() + month);

  // Pre month=360 (30 rokov):
  // 2025-11 + 360 mesiacov = 2055-11

  return `${payoffDate.getFullYear()}/${String(payoffDate.getMonth() + 1).padStart(2, "0")}`;
};

// Výsledok: "2055/11"
```

**Výpočet:**

```
Dnes: 2025-11-14
+ 360 mesiacov (30 rokov)
= 2055-11
```

---

## 5. Zobrazenie v StickyBottomBar

**Súbor:** `src/components/StickyBottomBar.tsx`

```typescript
const debtClearDate =
  debtPayoffMonth !== null && debts.length > 0
    ? (() => {
        const now = new Date();
        const targetDate = new Date(
          now.getFullYear(),
          now.getMonth() + debtPayoffMonth
        );
        const yyyy = targetDate.getFullYear();
        const mm = String(targetDate.getMonth() + 1).padStart(2, "0");
        return `${yyyy}/${mm}`;
      })()
    : null;

// Pre debtPayoffMonth=360 → "2055/11"
```

---

## 6. Príklad výpočtu (krok za krokom)

### Vstup:

- **Výška úveru:** 150 000 €
- **Úrok p.a.:** 3.5%
- **Splatnosť:** 30 rokov
- **Extra splátka:** 0 €

### Výpočet:

1. **monthsLeft** = 30 × 12 = **360 mesiacov**
2. **monthlyRate** = 3.5% ÷ 100 ÷ 12 = **0.002917**
3. **Mesačná splátka (anuitná):**
   ```
   monthly = (150000 × 0.002917) / (1 - (1.002917)^-360)
           = 437.5 / 0.6494
           ≈ 673.57 €
   ```
4. **Amortizácia:**
   - Mesiac 1: Zostatok 150 000 €, Úrok 437.50 €, Istina 236.07 €, Nový zostatok 149 763.93 €
   - Mesiac 2: Zostatok 149 763.93 €, Úrok 436.81 €, Istina 236.76 €, Nový zostatok 149 527.17 €
   - ...
   - **Mesiac 360:** Zostatok 0 €
5. **payoffMonth** = **360**
6. **Formátovanie dátumu:**
   ```
   Dnes: 2025-11
   + 360 mesiacov
   = 2055-11
   ```

### Očakávaný výsledok:

**"Vyplatenie úveru: 2055/11"**

---

## 7. Možné problémy

### Problém A: Dlh sa zobrazuje ako splatený v roku 2054 namiesto 2055

**Možná príčina:**

- `new Date()` môže zaokrúhľovať mesiace inak
- JavaScript Date API pridáva mesiace incrementálne (môže sa posunúť o 1 mesiac)

**Riešenie:**

```typescript
// Presnejší výpočet:
const payoffDate = new Date();
payoffDate.setMonth(payoffDate.getMonth() + month);
```

### Problém B: `monthsLeft` je nesprávne uložený

**Kontrola:**

- Otvoriť DevTools → Console
- Pridať dlh
- Skontrolovať DEBUG výpis:
  ```
  🔍 DEBUG debt calculation: {
    monthsLeft: 360  // Má byť 360 pre 30 rokov
  }
  ```

### Problém C: `scheduleWithExtra` vracia nesprávny `payoffMonth`

**Kontrola:**

- Skontrolovať test: `tests/pr9.task-b.amortization.test.tsx`
- Pre 30k €, 8%, 72 mesiacov → `payoffMonth` = 72

---

## 8. Otázky pre Advisora

1. **Je výpočet mesačnej splátky správny?**
   - Používame anuitný vzorec: `P × (r × (1+r)^n) / ((1+r)^n - 1)`
2. **Má byť `payoffMonth` absolútny (od začiatku úveru) alebo relatívny (od dnes)?**
   - Aktuálne: absolútny (360 mesiacov = 30 rokov od začiatku)
   - Zobrazenie: pridáva sa k dnešnému dátumu

3. **Je správne pridávať mesiace cez `new Date(year, month + X)`?**
   - Alebo máme použiť inú metódu?

4. **Ak zadám "30 rokov" dnes (2025-11), má výsledok byť:**
   - A) 2055-11 (presne 30 rokov od dnes)
   - B) 2054-11 (30 rokov mínus 1 mesiac)
   - C) Iné?

---

## 9. DEBUG výstup (príklad z konzoly)

Po pridaní dlhu v aplikácii:

```
🔍 DEBUG debt calculation: {
  debtName: "Hypotéka Byt",
  principal: 150000,
  ratePa: 3.5,
  monthsLeft: 360,
  extraMonthly: 0,
  payoffMonth: 360,
  payoffYears: "30.0"
}
```

**Interpretácia:**

- Input do `scheduleWithExtra`: 150k €, 3.5%, 360 mesiacov
- Output: `payoffMonth = 360` (dlh sa splatí za 360 mesiacov)
- Zobrazenie: 2025-11 + 360 mes = **2055-11**

---

## 10. Súbory na kontrolu

1. **EditDebtModal.tsx** (riadky 125-165)
   - Výpočet `monthsLeft` a `monthly`

2. **amortization.ts** (riadky 62-155)
   - `scheduleWithExtra()` a `calculateSchedule()`

3. **useProjection.ts** (riadky 110-145)
   - Použitie `scheduleWithExtra()`, tracking `debtPayoffMonth`

4. **DebtSummaryCard.tsx** (riadky 50-60)
   - `formatPayoffDate()` - formátovanie výsledku

5. **StickyBottomBar.tsx** (riadky 85-100)
   - Zobrazenie "Vyplatenie úveru"

---

**Kontakt:** Adam (Developer)  
**Pre advisora:** Prosím analyzuj výpočtovú logiku a potvrď, či je matematicky správna.
