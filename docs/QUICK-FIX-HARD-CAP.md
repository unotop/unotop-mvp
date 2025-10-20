# Quick Fix: Hard Cap 100% pre mix slidery

**Datum:** 2025-10-20  
**Commit:** `717d0dc`  
**Trvanie:** 30 min  
**Status:** ✅ COMPLETE

---

## 🎯 Problém

**Screenshot:** `docs/screenshots/3.PNG`

Mix slidery umožňovali nastaviť súčet na 700% (každý slider max 100%, žiadny hard cap).  
→ **Nereálne portfólio**, mätúce pre používateľa.

---

## 🔧 Riešenie

Implementovaný dynamický `max` atribút pre každý slider:

```typescript
// src/features/mix/MixPanel.tsx
const sum = mix.reduce((a, b) => a + b.pct, 0);

const getMaxAllowed = (currentPct: number) => {
  const otherSum = sum - currentPct;
  const remaining = 100 - otherSum;
  return Math.min(100, remaining);
};

// Aplikované na všetky slidery
<input
  type="range"
  min={0}
  max={getMaxAllowed(goldPct)}  // ← Dynamický max
  value={goldPct}
  ...
/>
```

---

## ✅ Správanie

### Pred fixom:
- Zlato 100% + Dyn 100% + ETF 100% + ... = **700%** ❌

### Po fixe:
- Ak súčet = 95% → max pre nulový slider = 5% (zostatok do 100%)
- Ak súčet = 100% → max pre nulový slider = 0% (disabled prakticky)
- Používateľ môže zvýšiť slider len ak je miesto v "budget-e" (zvyšok do 100%)

---

## 📋 Zmeny v súboroch

### `src/features/mix/MixPanel.tsx`
- **Lines 124-133**: Pridané `getMaxAllowed()` helper
- **Lines 261, 296, 330, 364, 398, 432, 466**: Aplikované `max={getMaxAllowed(pct)}` na všetky 7 sliderov

---

## 🧪 Validácia

### Testy: ✅ 17/17 PASS (5.99s)
- `invariants.limits` (2/2)
- `accessibility.ui` (9/9)
- `acceptance.mix-cap` (3/3)
- `persist.roundtrip` (1/1)
- `persist.debts.v3` (1/1)
- `deeplink.banner` (1/1)

### Build: ✅ SUCCESS (3.47s)
- Bundle: 165.83 kB gzipped (unchanged)

---

## 🎨 UX Impact

**Používateľ teraz vidí:**
1. Súčet 98% → môže pridať max 2% k nulovému slideru ✅
2. Súčet 100% → nulové slidery sú "locked" (max=0) ✅
3. Súčet 102% → červený chip "Súčet 102%" + CTA "Dorovnať" (existujúce správanie) ✅

**Benefit:** Používateľ nemôže spraviť nereálne portfólio (700%).

---

## 📝 Poznámky

- **Textboxy** majú stále `max={100}` (používateľ môže zadať 150, ale clamp to zredukuje na allowed max)
- **"Dorovnať" CTA** ostáva (redistribute proporcionálne na 100%)
- **Hard cap** = preventívny, "Dorovnať" = korektívny

---

## 🚀 Ďalšie kroky

Hotovo! Ideme na **Sprint 3: Mix optimizer** (applyRiskConstrainedMix, gold recommendation, "Max výnos" CTA).
