# TEST CLIENT LIMITS (PR-17 Fix)

## Manuálny test scenár (localhost:5174)

### 1. Mesačný príjem - slider max

**Kroky:**

1. Otvor BASIC režim
2. Zmeň "Profil klienta":
   - **Jednotlivec**: slider max = 10 000 €
   - **Rodina**: slider max = 20 000 €
   - **Firma**: slider max = 100 000 €

**Očakávaný výsledok:**

- Slider "Mesačný príjem" max sa dynamicky mení podľa typu klienta
- Slider ide až po správny max (nie 50k pre firmu!)

---

### 2. Jednorazová investícia - slider max

**Kroky:**

1. Zmeň "Profil klienta":
   - **Jednotlivec**: slider max = 200 000 €
   - **Rodina**: slider max = 300 000 €
   - **Firma**: slider max = 1 000 000 €

**Očakávaný výsledok:**

- Slider "Jednorazová investícia" max sa dynamicky mení
- Správne hodnoty podľa typu klienta ✅

---

### 3. Mesačný vklad - slider max

**Kroky:**

1. Zmeň "Profil klienta":
   - **Jednotlivec**: slider max = 5 000 €
   - **Rodina**: slider max = 5 000 € (rovnaké)
   - **Firma**: slider max = 10 000 €

**Očakávaný výsledok:**

- Slider "Mesačný vklad" max správne (family=5k, company=10k)

---

### 4. Toast pri prekročení limitu

**Kroky:**

1. Nastav clientType = "Rodina"
2. Do textboxu "Mesačný príjem" zadaj "25000"
3. Blur (klikni mimo)

**Očakávaný výsledok:**

- Toast: "Limit pre mesačný príjem pri **rodiny** je 20 000 €."
- Hodnota sa clampe na 20 000

---

## Opravené (commit)

- ✅ lumpSumMax initialization: Odstránený hardcoded fallback na 100k
- ✅ monthlyIncome slider: Používa `clientLimits.monthlyIncomeMax` namiesto hardcoded `company ? 50000 : 10000`
- ✅ Build: 653.09 kB
- ✅ Testy: 17/17 PASS

## Pred push

- [ ] Manuálne overiť všetky 3 slider maxes na localhost
- [ ] Potvrdiť toast zobrazuje správny typ klienta (jednotlivca/rodiny/firmy)
