# PROMPT PRE ADVISORA – Logika minimálnych investícií a realistické rozdelenie mixu

---

## Problém (Business Reality vs. Current Implementation)

**Súčasný stav:**

- Aplikácia umožňuje výber portfólia aj pri **veľmi nízkych mesačných vkladoch** (50-100 EUR), bez jednorazovej investície.
- Mix sa potom rozdeľuje **proporcionálne** do všetkých aktív podľa presetov (napr. konzervativny: 20% gold, 17% bonds, 8% dyn...).
- **Reálny problém:** Pri 50 EUR/mesiac sa vytvoria **nerealizovateľné položky**:
  - Dlhopisy: 17% z 50 EUR = **8.50 EUR/mesiac** → reálne minimum **2500 EUR jednorazovo**
  - Dynamické riadenie: 8% z 50 EUR = **4 EUR/mesiac** → reálne minimum **~1000 EUR**
  - Reality: 6% z 50 EUR = **3 EUR/mesiac** → reálne minimum **300 000 EUR lump sum**

**Dôsledok:** Klient s príjmom 3500+ EUR si odomkne reality, nastaví 50 EUR/mes, a dostane nerealizovateľný mix.

---

## Čo potrebujeme vyriešiť

### 1. **Definovať minimálne investície pre každé aktívum**

Prosím, doplň tieto údaje (pôvodné alebo upravené podľa reality):

| Aktívum                  | Min. jednorazová investícia | Min. mesačný DCA | Poznámka                                    |
| ------------------------ | --------------------------- | ---------------- | ------------------------------------------- |
| **Gold (fyzické)**       | ? EUR                       | ? EUR/mes        | Napr. 1 oz = ~2000 EUR? Alebo menšie mince? |
| **ETF (svetové)**        | ? EUR                       | ? EUR/mes        | Napr. broker minimum 50 EUR/transakcia?     |
| **Bonds (garantované)**  | **2500 EUR**                | N/A              | Už máme, len jednorazovo                    |
| **Bond 3-9y (cashflow)** | **2500 EUR**                | N/A              | Už máme, len jednorazovo                    |
| **Dynamické riadenie**   | ? EUR                       | ? EUR/mes        | Napr. 1000 EUR min?                         |
| **Cash/rezerva**         | **0 EUR**                   | **0 EUR**        | Vždy dostupné                               |
| **Krypto**               | ? EUR                       | ? EUR/mes        | Napr. 100 EUR minimum na burze?             |
| **Reality**              | **300 000 EUR**             | N/A              | Už máme, príjem 3500+                       |

---

### 2. **Logika pre "realizovateľný mix"**

**Variant A: Greedy Allocation (postupné plnenie)**

```
1. Zoraď aktíva podľa priority (napr. cash → bonds → gold → ETF → dyn → crypto → reality)
2. Pre každé aktívum:
   - Ak má klient dosť kapitálu (lump sum alebo kumulatívne DCA za 1 rok), alokuj požadované %.
   - Ak NIE, **vynechaj** to aktívum a presun % do nasledujúceho dostupného.
3. Normalize výsledný mix na 100%.
```

**Variant B: Threshold-Based Presets (iné mixe pre malých/veľkých investorov)**

```
- Ak totalFirstYear < 2500 EUR:
  → Použiť "MICRO" preset (len cash, ETF, gold – bez bonds, dyn, reality)
- Ak totalFirstYear 2500-10 000 EUR:
  → Použiť "BASIC" preset (cash, ETF, gold, bonds – bez dyn, reality)
- Ak totalFirstYear > 10 000 EUR:
  → Použiť "FULL" preset (všetko dostupné)
```

**Variant C: Dynamic Scaling s Warning (súčasný prístup + upozornenie)**

```
- Aplikuj preset normálne, ale:
  - Ak niektoré aktívum je pod min. investíciou, presun do "fallback bucket" (cash/ETF).
  - Zobraz warning: "Pri vašom vklade nie je možné investovať do dlhopisov (min. 2500 EUR). Prebytok presmerovaný do hotovosti."
```

---

### 3. **Špecifické otázky pre rozhodnutie**

1. **Bonds (2500 EUR minimum):**
   - Ak klient má lump sum 0 EUR a monthly 200 EUR (= 2400 EUR/rok), môžeme **akumulovať cash 1 rok a potom kúpiť bonds**?
   - Alebo **úplne vynechať bonds** a presunúť do ETF/gold?

2. **Dynamické riadenie:**
   - Aké je reálne minimum? 1000 EUR? 500 EUR?
   - Je to jednorazová investícia, alebo mesačný DCA?

3. **Gold (fyzické zlato):**
   - Môže klient kupovať po gramoch (napr. 10g = ~700 EUR)? Alebo len celé unce?
   - Aké je praktické minimum pre malého investora?

4. **ETF:**
   - Môže klient mesačne investovať aj 20-30 EUR (fractional shares)? Alebo je broker minimum vyššie?

5. **Krypto:**
   - Aké je reálne minimum? 50 EUR? 100 EUR?
   - Je to jednorazové alebo mesačné?

6. **Reality:**
   - Už máme threshold 300k lump sum ALEBO 3500+ príjem. Je to správne?
   - Alebo by mal byť threshold na **celkový investovateľný kapitál** (napr. lump + 12×monthly > 50 000 EUR)?

---

### 4. **Navrhovaný Output pre Implementáciu**

Potrebujem od teba:

**A) Tabuľku minimálnych investícií (presné čísla)**

```typescript
export const ASSET_MINIMUMS = {
  gold: { lumpMin: 500, monthlyMin: 50 }, // Príklad
  etf: { lumpMin: 100, monthlyMin: 25 },
  bonds: { lumpMin: 2500, monthlyMin: 0 }, // Len lump sum
  bond3y9: { lumpMin: 2500, monthlyMin: 0 },
  dyn: { lumpMin: 1000, monthlyMin: 100 },
  cash: { lumpMin: 0, monthlyMin: 0 }, // Vždy OK
  crypto: { lumpMin: 100, monthlyMin: 20 },
  real: { lumpMin: 300000, monthlyMin: 0 }, // Už máme
};
```

**B) Preferovaný prístup (A / B / C alebo vlastný)**

**C) Fallback priority (kam presúvať nedostupné alokácie)**

```
Napr.: bonds unavailable → presunúť do: 70% cash, 30% ETF
       dyn unavailable → presunúť do: 100% ETF
       reality unavailable → presunúť do: 60% ETF, 40% bonds
```

**D) UI/UX behavior**

- Zobrazovať warnings ("Dlhopisy nedostupné pri vašom vklade")?
- Disablovať presets ("Konzervatívny nedostupný pod 2500 EUR/rok")?
- Alebo aplikovať preset + auto-adjust + info chip?

---

### 5. **Príklad scenára (na overenie logiky)**

**Klient:**

- Príjem: 4000 EUR/mes (odomkne reality)
- Lump sum: **0 EUR**
- Mesačný vklad: **50 EUR**
- Horizont: 15 rokov

**Zvolí: Konzervatívny profil**
Pôvodný mix:

- Gold 20%, ETF 20%, Bonds 17%, Bond3y9 17%, Dyn 8%, Cash 12%, Crypto 0%, Reality 6%

**Čo by sa malo stať?**

1. Reality (6%) → nedostupné (lump < 300k) → presunúť do \_\_\_?
2. Bonds (34%) → nedostupné (50×12 = 600 EUR < 2500) → presunúť do \_\_\_?
3. Dyn (8%) → nedostupné (ak min = 1000 EUR) → presunúť do \_\_\_?
4. Výsledný mix: \_\_\_?

**Tvoje zadanie:**
Prosím, vyplň tabuľku minimálnych investícií, zvol prístup (A/B/C) a napíš, ako by sa mal vyriešiť tento scenár. Potom to implementujem presne podľa toho.

---

## Súčasný stav kódu (pre kontext)

**Už implementované thresholdy:**

- `bondMinimum.ts`: 2500 EUR (lump + 12×monthly)
- `lumpSumScaling.ts`: Tiers 10k/30k/50k+ (scaling dyn/crypto down)
- `monthlyScaling.ts`: 500 EUR cap na dyn+crypto pri monthly > 1000 EUR
- `cashReserve.ts`: Dynamická rezerva podľa príjmu/výdavkov
- Reality filter: príjem >= 3500 EUR ALEBO lump >= 300 000 EUR

**Potrebujeme:**
Konzistentnú logiku, ktorá zabráni vytváraniu nerealizovateľných alokácií pri malých vkladoch.
