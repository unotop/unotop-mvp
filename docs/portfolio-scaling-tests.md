# Portfolio Scaling - Test Scenáre

## ✅ **Implementované Features:**

### **1. Lump Sum Scaling (5 tiers)**

- 100k - 250k: dyn ≤ 16%, crypto ≤ 6%
- 250k - 500k: dyn ≤ 14%, crypto ≤ 5%
- 500k - 1M: dyn ≤ 10%, crypto ≤ 4% ← **User's cap**
- 1M - 5M: dyn ≤ 8%, crypto ≤ 2%
- 5M+: dyn ≤ 5%, crypto = 0%

**Boost:** Bonds/Bond3y9 > Zlato > ETF

### **2. Monthly Scaling (500 EUR cap)**

- Pri mesačných vkladoch > 1000 EUR
- Dyn + Crypto max **500 EUR absolútne**
- Presun: 50% bonds (25% každý), 30% gold, 20% ETF

### **3. Cash Reserve Optimization**

- Krátkodobá: 6 mesiacov výdavkov
- Caps: 20k (250k portfólio), 30k (500k), 50k (1M+)
- Fallback: 70% príjmu ak výdavky neznáme

### **4. Bond Minimum (2500 EUR)**

- Ak prvý rok < 2500 → bonds unavailable
- Redistribúcia: 70% cash, 30% ETF
- UI warning s timeline

---

## 🧪 **Test Scenáre:**

### **Scenár 1: Malý investor (nováčik)**

```
Jednorazová: 5 000 EUR
Mesačná: 300 EUR
Horizont: 10 rokov
Výdavky: 1 500 EUR/mes
```

**Očakávaný výsledok:**

- ⚠️ **Bond warning:** Prvý rok = 8 600 EUR (chýba 2500 → dostupné za ~8 mes)
- 💵 **Cash reserve:** Optimálna ~8% (cca 6000 EUR potrebné na rezervu)
- ✅ Bez lump sum/monthly scaling (pod prahy)
- Bonds presmerované do cash (70%) + ETF (30%)

---

### **Scenár 2: Stredný investor**

```
Jednorazová: 150 000 EUR
Mesačná: 1 500 EUR
Horizont: 10 rokov
Výdavky: 3 000 EUR/mes
Rezerva existujúca: 10 000 EUR
```

**Očakávaný výsledok:**

- ✅ Bonds OK (prvý rok = 168k EUR)
- 💎 **Lump sum tier 100k:** dyn capped na 16%, crypto na 6%
- 📊 **Monthly capping:** 1500 EUR > 1000 → dyn+crypto max 500 EUR
  - Pôvodne (rastový): dyn 21% = 315 EUR, crypto 7% = 105 EUR → spolu 420 EUR ✅ (pod cap)
- 💵 **Cash reserve:** Potreba 18k EUR (6×3000), už má 10k → optimálna ~5%

---

### **Scenár 3: Bohatý investor**

```
Jednorazová: 800 000 EUR
Mesačná: 3 000 EUR
Horizont: 15 rokov
Výdavky: 5 000 EUR/mes
Rezerva: 25 000 EUR
```

**Očakávaný výsledok:**

- ✅ Bonds OK
- 💎 **Lump sum tier 500k:** dyn ≤ 10%, crypto ≤ 4% (user's strict cap)
  - Rastový pôvodne: dyn 21% → **10%**, crypto 7% → **4%**
  - Freed: 14% → redistribúcia do bonds/gold/ETF
- 📊 **Monthly capping:** 3000 EUR → dyn+crypto max 500 EUR
  - Po lump sum: dyn 10%, crypto 4% → 300+120 = 420 EUR ✅ (pod cap)
- 💵 **Cash reserve:** Potreba max 30k EUR (cap pre 500k+), už má 25k → optimálna ~3%

---

### **Scenár 4: Mega investor (1M+)**

```
Jednorazová: 2 000 000 EUR
Mesačná: 5 000 EUR
Horizont: 20 rokov
Výdavky: 10 000 EUR/mes
Rezerva: 40 000 EUR
```

**Očakávaný výsledok:**

- ✅ Bonds OK
- 💎 **Lump sum tier 1M:** dyn ≤ 8%, crypto ≤ 2%
  - Rastový: dyn 21% → **8%**, crypto 7% → **2%**
  - Freed: 18% → masívna redistribúcia do safe assets
- 📊 **Monthly capping:** 5000 EUR → dyn+crypto max 500 EUR
  - Po lump sum: dyn 8%, crypto 2% → 400+100 = 500 EUR ✅ (presne cap)
- 💵 **Cash reserve:** Potreba max 50k EUR (cap pre 1M+), už má 40k → optimálna ~3%
  - Pri 3.2M portfóliu (2M + 5k×12×20 = 3.2M) → 50k = 1.56% → **min 3%** applied

---

### **Scenár 5: Ultra investor (5M+)**

```
Jednorazová: 10 000 000 EUR
Mesačná: 10 000 EUR
Horizont: 10 rokov
```

**Očakávaný výsledok:**

- 💎 **Lump sum tier 5M:** dyn ≤ 5%, crypto = **0%** (ultra-safe)
  - Vyvážený: dyn 18% → **5%**, crypto 4% → **0%**
  - Bonds/Gold dominancia
- 📊 **Monthly capping:** 10k EUR → dyn+crypto max 500 EUR
  - Po lump sum: dyn 5%, crypto 0% → 500 EUR ✅
- 💵 **Cash reserve:** Max 50k EUR cap → pri 11.2M portfóliu = **0.45%** → min 3% applied

---

## 🎯 **Manuálne testy (v prehliadači):**

### **Test 1: Bond minimum warning**

1. Nastav: Lump 1000, Monthly 100
2. Očakávaj: Amber warning "Dlhopisy od 2500 EUR", timeline "za X mesiacov"
3. Zmeň Monthly na 500 → warning zmizne (prvý rok = 7000)

### **Test 2: Cash reserve low**

1. Nastav: Lump 50k, Monthly 1000, Výdavky 3000
2. Očakávaj: Blue warning "Zvýš cash na X%"
3. Klikni "Aplikovať" → mix sa upraví

### **Test 3: Lump sum scaling**

1. Nastav: Lump 600k, vyber "Rastový"
2. Očakávaj: Purple info "dyn ≤ 10%, crypto ≤ 4%"
3. Share modal: Over že dyn naozaj ≤ 10%

### **Test 4: Monthly capping**

1. Nastav: Monthly 5000, vyber "Rastový"
2. Očakávaj: Green info "dyn+crypto max 500 EUR"
3. Vypočítaj: dyn% + crypto% z 5000 = max 500

---

## 📊 **Výsledky:**

✅ Build successful (627.57 kB)  
✅ Preview running on http://localhost:4173/  
✅ Všetky 4 scaling logiky implementované  
✅ UI warnings interaktívne  
✅ Cash reserve s CTA "Aplikovať"

**Next:** Manuálne otestuj scenáre v prehliadači! 🚀
