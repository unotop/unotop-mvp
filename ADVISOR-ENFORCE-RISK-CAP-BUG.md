# ADVISOR BRIEF: EnforceRiskCap Direct Cut Bug (PR-36 Critical Issue)

**Dátum:** 2026-01-08  
**Priorita:** P0 – CRITICAL BLOCKER  
**Autor:** Adam (unotop)  
**Status:** Awaiting advisor decision

---

## 🔴 EXECUTIVE SUMMARY

**Problém:** `enforceRiskCap()` má bug v **DIRECT CUT MODE** ktorý **násilne zabíja 50% ETF/dyn** pri neúspešnej redistribúcii, čím **rozbíja mix** a **znižuje výnos**. Risk spadne **pod minimum** (3.97 namiesto 8.5 pre Growth), appka potom neplní **core requirement: maximalizovať výnos pri zachovaní risk cap**.

**Dopad:**

- Growth profil (10k/300/20): **ETF 49% → 33%** (strata 16 p.b.), bonds **19% → 50%** (!!!), risk **8.9 → 4.85** (pod target)
- Výnos: **20.5% → 15.8%** (strata **4.7 p.p.** namiesto očakávaného nárastu na **22-23%**)
- **Reálne používateľ dostane HORŠIE portfólio** ako pred bond13 update!

**Root cause:** DIRECT CUT MODE (enforceRiskCap.ts, iteration 9+) aplikuje **50% škrt na všetky risky assets** namiesto jemného tunovania.

**KRITICKÉ: Toto je REGRESNÝ BUG** – pred bond13 update (bond 9%) fungovalo všetko OK, po update (bond 13%) sa to rozbilo.

---

## 📊 KONKRÉTNY PRÍPAD (Growth profil, 10k/300/20y)

### **Pred bond13 update (bond 9%) – FUNGUJÚCE:**

| Asset    | %       | Yield | Risk | Contribution       |
| -------- | ------- | ----- | ---- | ------------------ |
| ETF      | **49%** | 12%   | 6    | High growth driver |
| dyn      | **17%** | 60%   | 8    | High yield driver  |
| zlato    | 14%     | 7%    | 3    | Stabilizátor       |
| bond9    | 10%     | 9%    | 3    | Safe yield         |
| bonds7.5 | 9%      | 7.5%  | 2    | Ultra safe         |
| cash     | 1%      | 3%    | 2    | Rezerva            |

**Výnos:** **20.5%**  
**Risk:** **8.9** (tesne pod 9.0 limit pre Growth + 0.5 headroom) ✅  
**Hodnotenie:** Appka **maximalizovala výnos** v rámci risk budgetu ✅

---

### **Po bond13 update (bond 13%) – ROZBITÉ:**

#### **Fáza 1: UP-TUNE (STEP 5.5B) – OK**

```
Mix: ETF 47%, dyn 16%, zlato 4%, bond13 3%, bonds 0.3%, cash 10%, real 14%
Risk: 8.87 (tesne pod 9.0) ✅
```

#### **Fáza 2: enforceStageCaps (STEP 6) – PROBLÉM ZAČÍNA**

```
Mix: ETF 50%, dyn 16%, zlato 6%, bond13 3%, bonds 0.3%, cash 5%, real 14%
Risk: 9.65 (nad 8.5 cap!) ❌
```

**Poznámka:** enforceStageCaps **zvýšil ETF** z 47% → 50% (cap enforcement), čo **vytlačilo risk nad limit**.

#### **Fáza 3: enforceRiskCap (STEP 8) – KATASTROFA**

**Iterations 1-8:** Škrtá crypto (6% → 0%), real (14% → 6%), redistribuuje do bonds/bond13.

**Iteration 9 – DIRECT CUT MODE:**

```
[EnforceRiskCap] DIRECT CUT MODE (iteration 9): Force cut high-risk assets → bonds/bond9 ONLY

PRED:  ETF 52%, dyn 17%, real 10%
       bonds 6%, bond13 6%
       Risk: 9.74

ŠKRT:  ETF -26.3% (50% cut)  ← ❌ KATASTROFA!
       dyn -8.4% (50% cut)
       real -5.0% (50% cut)

PO:    ETF 26%, dyn 9%, real 5%
       bonds 24%, bond13 26%  ← ❌ BONDS DOMINUJÚ!
       Risk: 3.97  ← ❌ POD MINIMUM!
```

**Prečo DIRECT CUT?**  
Redistribúcia zlyhala 8× (`Cannot redistribute 0.62 p.b.`) → enforceRiskCap prepol na **núdzový režim** → **zabil 50% všetkých risky assets**.

#### **Fáza 4: Yield Optimizer (STEP 10) – SNAŽÍ SA ZACHRÁNIŤ**

```
Move 1: cash → ETF (+2 p.b.)
Move 2: cash → ETF (+2 p.b.)
Move 3: gold → ETF (+2 p.b.)

FINÁLNY MIX:
ETF 33%, dyn 9%, bonds 25%, bond13 26%, zlato 4%, cash 2%, real 2%
Risk: 4.85  ← ❌ STÁLE POD TARGET (8.5)
Výnos: 15.8%  ← ❌ NIŽŠÍ AKO PRED UPDATE (20.5%)!
```

**Yield optimizer dokázal zachrániť len 6 p.b. ETF** (26% → 33%), ale **nedosiahol pôvodných 49%**!

---

## 🔍 ROOT CAUSE ANALYSIS

### **1. Prečo redistribúcia zlyhala?**

**Console log (iteration 1-8):**

```
[EnforceRiskCap]   → bonds +0.70 p.b. (weight 0.35, room 39.7%)
[EnforceRiskCap]   → bond3y9 +0.39 p.b. (weight 0.30, room 36.7%)
[EnforceRiskCap]   → real +0.18 p.b. (weight 0.20, room 6.1%)
[EnforceRiskCap]   → gold +0.07 p.b. (weight 0.10, room 9.5%)
[EnforceRiskCap]   → cash +0.03 p.b. (weight 0.05, room 30.0%)
[EnforceRiskCap] Cannot redistribute 0.62 p.b. (will retry or switch to direct cut)
```

**Matematika:**

- **Zdroj:** crypto -2.0 p.b.
- **Cieľová redistribúcia:** 0.70 + 0.39 + 0.18 + 0.07 + 0.03 = **1.37 p.b.**
- **Chýba:** 2.0 - 1.37 = **0.62 p.b.**

**Prečo chýba 0.62 p.b.?**  
→ **enforceStageCaps** (STEP 6) už **naplnilo caps** pre bonds/bond13/gold/cash → **niet kam dať overflow**!

---

### **2. Prečo DIRECT CUT je zlý?**

**Kód (enforceRiskCap.ts, riadok 240-270):**

```typescript
// DIRECT CUT MODE: Force cut high-risk assets → bonds/bond9 ONLY
if (iteration >= MAX_REDISTRIBUTION_ATTEMPTS) {
  console.log(
    `[EnforceRiskCap] DIRECT CUT MODE (iteration ${iteration}): Force cut...`
  );

  // ŠKRT 50% všetkých risky assets
  dynItem.pct *= 0.5; // dyn 16% → 8%
  realItem.pct *= 0.5; // real 10% → 5%
  etfItem.pct *= 0.5; // ETF 52% → 26%  ← ❌ HLAVNÝ GROWTH DRIVER ZABIL!

  // Presun VŠETKO do bonds + bond13
  const totalCut = dynCut + realCut + etfCut;
  bondsItem.pct += totalCut * 0.5; // bonds +18.4%
  bond9Item.pct += totalCut * 0.5; // bond13 +18.4%

  // Risk spadne pod minimum!
  // Výnos klesne (bonds majú nižší yield ako ETF/dyn)
}
```

**Problém:**

- ❌ **Zabíja hlavné growth drivery** (ETF, dyn) → **výnos klesne**
- ❌ **Risk spadne POD target** (8.5 → 3.97) → **appka nedosahuje optimálny risk/reward**
- ❌ **Bonds dominujú** (50% mix) → **portfólio je príliš konzervatívne pre Growth profil**
- ❌ **Yield optimizer nemôže zachrániť** (MAX_BOOST limit + caps)

---

### **3. Prečo sa to stalo až teraz?**

**Pred bond13 update (bond 9%):**

- UP-TUNE dosiahol risk **~8.5** (presne na targete)
- enforceStageCaps zvýšil risk na **~8.7** (mierne nad)
- enforceRiskCap potreboval **len 2-3 iterations** (škrt crypto 6% → 3%)
- Redistribúcia **úspešne prešla** (bonds/bond13 mali dostatok room)
- **DIRECT CUT MODE sa nikdy nespustil** ✅

**Po bond13 update (bond 13%):**

- UP-TUNE dosiahol risk **~8.9** (nad targetom kvôli agresívnejšiemu tuningu)
- enforceStageCaps zvýšil risk na **~9.65** (vysoko nad)
- enforceRiskCap potreboval **9 iterations** (škrt crypto 6% → 0%, real 14% → 6%)
- Redistribúcia **zlyhala 8×** (bonds/bond13 už naplnené kvôli vyšším % z UP-TUNE)
- **DIRECT CUT MODE sa spustil** → **katastrofa** ❌

---

## 💡 RIEŠENIA (3 varianty na zváženie)

### **VARIANT A: Quick Fix – Zníženie UP-TUNE aggressive target (SAFEST)**

**Zmeny:**

1. UP-TUNE (mixAdjustments.ts, riadok 620-700) nesmie ísť nad `riskMax - 1.0` (namiesto `riskMax - 0.2`)
2. Pre Growth: targetMin = **7.5** (namiesto 8.5) → zanechá **1.0 risk room** pre caps enforcement

**Kód:**

```typescript
// PRED (aggressive):
const targetMin = adaptiveRiskCap * TARGET_BANDS[riskPref].min; // 9.0 × 0.95 = 8.55

// PO (conservative):
const targetMin = Math.min(
  adaptiveRiskCap * TARGET_BANDS[riskPref].min,
  finalRiskMax - 1.0 // Hard cap: nesmie byť bližšie ako 1.0 od riskMax
);
// Growth: min(8.55, 8.5 - 1.0) = 7.5
```

**Výhody:**

- ✅ **Najjednoduchšie** – 1 riadok zmeny
- ✅ **Najstabilnejšie** – enforceStageCaps/enforceRiskCap budú mať priestor
- ✅ **DIRECT CUT sa nespustí** (risk nikdy nepôjde nad 8.5 + margin)
- ✅ **Backwards compatible** – existujúce testy prejdú

**Nevýhody:**

- ⚠️ **Menej agresívne** – Growth profil bude mať risk ~7.5-8.0 (nie 8.5)
- ⚠️ **Nižší výnos** – strácame ~0.5-1.0 p.p. yield kvôli safety margin

**Očakávaný výsledok (Growth 10k/300/20):**

- Risk: **7.5-8.0** (namiesto 8.5)
- Výnos: **21-22%** (namiesto 22-23%)
- Mix: **ETF 45-47%**, dyn 15-16%, bonds ~20%

**Odporúčanie:** ✅ **Použiť ako IMMEDIATE FIX**, potom vylepšiť v Phase 2.

---

### **VARIANT B: Medium Fix – Zrušenie DIRECT CUT MODE (RECOMMENDED LONG-TERM)**

**Zmeny:**

1. **Zmaž DIRECT CUT MODE** úplne (enforceRiskCap.ts, riadok 240-270)
2. Ak redistribúcia zlyhá 3× → **STOP** (nenič mix)
3. Vráť warning: `"risk-cap-soft-limit"` (UI zobrazí používateľovi)
4. Nechaj risk **mierne nad limitom** (napr. 8.7 namiesto 8.5) → **OK pre Growth**

**Kód:**

```typescript
// REMOVE: DIRECT CUT MODE (riadok 240-270)

// ADD: Soft limit handling
if (iteration >= MAX_REDISTRIBUTION_ATTEMPTS) {
  console.warn(
    `[EnforceRiskCap] Cannot reduce risk further (${currentRisk.toFixed(2)} > ${riskMax.toFixed(1)}). ` +
      `Returning mix with soft warning.`
  );
  return {
    mix,
    applied: true,
    warning: "risk-cap-soft-limit", // UI zobrazí: "Portfólio má mierne vyššie riziko (optimálne pre max výnos)"
    initialRisk,
    finalRisk: currentRisk,
    iterations,
    riskMax,
  };
}
```

**Výhody:**

- ✅ **Zachováva agresívny mix** (ETF/dyn vysoké %)
- ✅ **Maximalizuje výnos** (risk tesne pod/nad limitom je OK)
- ✅ **Transparent** – používateľ vidí warning, môže manuálne upraviť
- ✅ **Prirodzené správanie** – žiadne násilné škrty

**Nevýhody:**

- ⚠️ **Risk môže byť nad limitom** (8.7 namiesto 8.5) – je to OK? (advisor decision)
- ⚠️ **Testy môžu zlyhať** (strict assertions na riskMax)

**Očakávaný výsledok (Growth 10k/300/20):**

- Risk: **8.5-8.7** (tesne nad/pod limitom)
- Výnos: **22-23%** (maximálny možný)
- Mix: **ETF 47-49%**, dyn 16-17%, bonds ~15-20%
- Warning: "Portfólio má mierne vyššie riziko (9/10 je stále v Green zone)"

**Odporúčanie:** ✅ **Use for Phase 2** (po schválení soft limit policy).

---

### **VARIANT C: Full Fix – Redistribution tolerance + UP-TUNE cap (COMPREHENSIVE)**

**Zmeny:**

1. **Variant A** (UP-TUNE cap na `riskMax - 1.0`)
2. **Variant B** (zrušenie DIRECT CUT)
3. **PLUS:** Zvýšenie redistribution room (10% tolerance)

**Kód (enforceRiskCap.ts, riadok 200-230):**

```typescript
// PRED (strict cap):
const room = stageCapsMap[sinkKey] - sinkItem.pct; // Strict

// PO (tolerance 10%):
const cap = stageCapsMap[sinkKey] ?? 100;
const room = cap * 1.1 - sinkItem.pct; // 10% tolerance
// bonds cap 40% → room až do 44%
```

**Výhody:**

- ✅ **Najrobustnejšie** – redistribúcia má priestor aj pri naplnených caps
- ✅ **DIRECT CUT sa nespustí** (redistribúcia vždy prejde)
- ✅ **Vysoký výnos** – agresívny mix + jemné tunovanie

**Nevýhody:**

- ⚠️ **Komplexné** – 3 miesta zmien (testovanie náročnejšie)
- ⚠️ **Caps overflow** – assets môžu byť mierne nad caps (44% namiesto 40%)

**Očakávaný výsledok (Growth 10k/300/20):**

- Risk: **7.5-8.0** (stable)
- Výnos: **21-22%**
- Mix: **ETF 45-47%**, dyn 15-16%, bonds ~22-25%
- Bonds môžu byť 44% (namiesto 40% cap) → **je to OK?** (advisor decision)

**Odporúčanie:** ⚠️ **Use only if Variant A + B not sufficient** (over-engineering risk).

---

## 🎯 ADVISOR QUESTIONS (ROZHODNUTIE)

### **Q1: Soft risk limit policy – súhlasíš?**

**Otázka:** Je OK ak Growth profil má risk **8.7** namiesto **8.5** (hard cap)?

**Argumenty PRO:**

- ✅ Maximalizuje výnos (risk 8.7 je stále "bezpečný" – nie je 10/10)
- ✅ Prirodzené správanie (optimizer má priestor)
- ✅ Transparent (UI zobrazí warning, používateľ sa rozhodne)

**Argumenty PROTI:**

- ❌ Porušuje "hard cap" policy (8.5 je limit, nie odporúčanie)
- ❌ Používateľ môže byť zmätený (prečo risk 8.7 keď limit je 8.5?)

**Tvoje rozhodnutie:**

- [ ] **ÁNO** – soft limit OK (use Variant B)
- [ ] **NIE** – hard cap must be respected (use Variant A)

---

### **Q2: UP-TUNE aggressive vs. conservative target?**

**Otázka:** Má UP-TUNE ísť až na `riskMax - 0.2` (aggressive) alebo `riskMax - 1.0` (conservative)?

**Aggressive (current):**

- Growth: targetMin = **8.55** (tesne pod 8.7)
- ✅ Vyšší výnos (+0.5-1.0 p.p.)
- ❌ Vyššie riziko DIRECT CUT (redistribution zlyhá)

**Conservative (Variant A):**

- Growth: targetMin = **7.5** (1.0 margin od 8.5)
- ✅ Stabilnejšie (DIRECT CUT sa nespustí)
- ❌ Nižší výnos (-0.5-1.0 p.p.)

**Tvoje rozhodnutie:**

- [ ] **AGGRESSIVE** (riskMax - 0.2) – use Variant B (soft limit)
- [ ] **CONSERVATIVE** (riskMax - 1.0) – use Variant A (hard cap)
- [ ] **ADAPTIVE** – Conservative/Balanced riskMax-1.0, Growth riskMax-0.5

---

### **Q3: DIRECT CUT MODE – ponechať ako fallback?**

**Otázka:** Má DIRECT CUT zostať ako **emergency fallback** (pre extreme edge cases), alebo ho zmazať úplne?

**Keep (current):**

- ✅ Failsafe pre extreme cases (risk 15/10 → musí klesnúť)
- ❌ Rozbíja mix pri normal cases (ako Growth 10k/300/20)

**Remove (Variant B):**

- ✅ Nikdy nerozbije mix
- ❌ Risk môže ostať nad limitom (soft warning)

**Tvoje rozhodnutie:**

- [ ] **KEEP** – ponechaj DIRECT CUT, ale zvýš threshold (iteration 15+ namiesto 9+)
- [ ] **REMOVE** – zmaž úplne, vráť soft warning

---

### **Q4: Redistribution room tolerance – potrebné?**

**Otázka:** Má redistribúcia mať **10% tolerance** (Variant C) alebo strict caps stačia?

**10% tolerance:**

- bonds cap 40% → room až do **44%**
- ✅ Redistribúcia vždy prejde
- ❌ Assets môžu prekročiť caps (44% bonds)

**Strict caps:**

- bonds cap 40% → room až do **40%** (presne)
- ✅ Caps sa dodržiavajú presne
- ❌ Redistribúcia môže zlyhať (ako teraz)

**Tvoje rozhodnutie:**

- [ ] **10% tolerance** (Variant C) – robustné, ale caps overflow
- [ ] **5% tolerance** (kompromis) – mierne overflow (42%)
- [ ] **Strict caps** (current) – žiadny overflow

---

## 📋 IMPLEMENTATION MATRIX

| Variant             | UP-TUNE cap | DIRECT CUT    | Redistrib tolerance | Risk limit | Výnos (Growth) | Complexity |
| ------------------- | ----------- | ------------- | ------------------- | ---------- | -------------- | ---------- |
| **A (Quick)**       | riskMax-1.0 | Keep (unused) | Strict              | Hard (7.5) | 21-22%         | LOW ✅     |
| **B (Recommended)** | riskMax-0.2 | **Remove**    | Strict              | Soft (8.7) | 22-23%         | MEDIUM ✅  |
| **C (Full)**        | riskMax-1.0 | **Remove**    | +10% tolerance      | Hard (7.5) | 21-22%         | HIGH ⚠️    |
| **B+A (Hybrid)**    | riskMax-0.5 | **Remove**    | Strict              | Soft (8.5) | 21.5-22.5%     | MEDIUM ✅  |

---

## 🚀 MOJE ODPORÚČANIE (TOP TIER)

### **Immediate (PR-36 hotfix) – VARIANT A**

**Dôvod:** Najrýchlejšie, najstabilnejšie, no regrets.

**Zmeny:**

```typescript
// mixAdjustments.ts, riadok ~620
const targetMin = Math.min(
  adaptiveRiskCap * TARGET_BANDS[riskPref].min,
  finalRiskMax - 1.0 // Hard safety margin
);
```

**ETA:** 5 min coding + 10 min testing = **15 min total**  
**Risk:** VERY LOW (1 riadok zmeny)  
**Výsledok:** Growth risk 7.5-8.0, výnos 21-22%, DIRECT CUT sa nespustí ✅

---

### **Phase 2 (PR-37) – VARIANT B**

**Dôvod:** Maximalizuje výnos, prirodzené správanie, transparent.

**Zmeny:**

1. **Zmaž DIRECT CUT MODE** (enforceRiskCap.ts, 30 riadkov)
2. **Vráť soft warning** pri failed redistribution
3. **UI update:** Zobraz warning "Mierne vyššie riziko (optimálne pre max výnos)"

**ETA:** 1h coding + 2h testing + 1h QA = **4h total**  
**Risk:** MEDIUM (zmena core logic)  
**Výsledok:** Growth risk 8.5-8.7, výnos 22-23%, agresívny mix ✅

---

### **Fallback (ak Variant B zlyhá) – VARIANT B+A (Hybrid)**

**Dôvod:** Kompromis – moderate aggressiveness + soft limit.

**Zmeny:**

1. UP-TUNE cap na `riskMax - 0.5` (namiesto -1.0)
2. Zmaž DIRECT CUT
3. Soft warning pri risk > riskMax

**ETA:** 30 min coding + 1h testing = **1.5h total**  
**Risk:** LOW-MEDIUM  
**Výsledok:** Growth risk 8.0-8.5, výnos 21.5-22.5%, balanced ✅

---

## 📈 OČAKÁVANÝ DOPAD (všetky varianty)

### **VARIANT A (Quick Fix):**

| Profil       | Risk    | Výnos  | ETF %  | Bonds % | Hodnotenie      |
| ------------ | ------- | ------ | ------ | ------- | --------------- |
| Conservative | 3.5-4.0 | 9-10%  | 28-30% | 35-40%  | ✅ Stable       |
| Balanced     | 5.5-6.0 | 15-16% | 40-43% | 25-30%  | ✅ Good         |
| Growth       | 7.5-8.0 | 21-22% | 45-47% | 20-25%  | ⚠️ Conservative |

**Zlepšenie oproti BROKEN stavu:**

- Growth: **15.8% → 21-22%** (+5-6 p.p.) ✅
- Growth ETF: **33% → 45-47%** (+12-14 p.b.) ✅
- **NO MORE DIRECT CUT DISASTERS** ✅

---

### **VARIANT B (Recommended):**

| Profil       | Risk    | Výnos      | ETF %  | Bonds % | Hodnotenie       |
| ------------ | ------- | ---------- | ------ | ------- | ---------------- |
| Conservative | 4.0-4.2 | 9.5-10.5%  | 30-32% | 35-40%  | ✅ Excellent     |
| Balanced     | 6.0-6.5 | 15.5-16.5% | 43-45% | 22-28%  | ✅ Excellent     |
| Growth       | 8.5-8.7 | 22-23%     | 47-49% | 15-20%  | ✅ **MAX VÝNOS** |

**Zlepšenie oproti BROKEN stavu:**

- Growth: **15.8% → 22-23%** (+6-7 p.p.) ✅✅
- Growth ETF: **33% → 47-49%** (+14-16 p.b.) ✅✅
- **AGGRESSIVE MIX + SOFT LIMIT POLICY** ✅✅

---

## 🧪 TESTOVACÍ PLÁN

### **Acceptance test (manual):**

| Scenario | Inputs       | Expected Risk              | Expected Yield       | Expected ETF %       | PASS Criteria     |
| -------- | ------------ | -------------------------- | -------------------- | -------------------- | ----------------- |
| A1       | C 10k/300/20 | 3.8-4.0                    | ≥9.5%                | ≥28%                 | Risk ≤ 4.5        |
| A2       | B 10k/300/20 | 5.8-6.0                    | ≥15.5%               | ≥40%                 | Risk ≤ 6.5        |
| A3       | G 10k/300/20 | 7.5-8.0 (A)<br>8.5-8.7 (B) | ≥21% (A)<br>≥22% (B) | ≥45% (A)<br>≥47% (B) | Risk ≤ 8.5+margin |
| B1       | G 100k/1k/30 | 7.5-8.0 (A)<br>8.5-8.7 (B) | ≥22% (A)<br>≥23% (B) | ≥46% (A)<br>≥48% (B) | No DIRECT CUT     |

**QA checklist:**

- [ ] DIRECT CUT MODE sa NIKDY nespustí (check console logs)
- [ ] Risk je v rámci targetu ± margin
- [ ] ETF % je vysoké (40%+ pre Balanced, 45%+ pre Growth)
- [ ] Bonds % nie je dominantné (max 30% pre Growth)
- [ ] Yield je vyšší ako pred bond13 update

---

### **Unit tests (vitest):**

```typescript
describe("EnforceRiskCap v2 (No Direct Cut)", () => {
  it("should stop with soft warning if redistribution fails 3×", () => {
    const mix = [
      { key: "etf", pct: 52 },
      { key: "dyn", pct: 17 },
      { key: "bonds", pct: 40 }, // Cap already full
      { key: "bond3y9", pct: 40 }, // Cap already full
    ];

    const result = enforceRiskCap(mix, "rastovy", stageCaps);

    // Should NOT apply DIRECT CUT
    expect(result.warning).toBe("risk-cap-soft-limit");
    expect(result.mix.find((m) => m.key === "etf")!.pct).toBeGreaterThan(45); // ETF not killed
    expect(result.finalRisk).toBeGreaterThan(8.0); // Risk > riskMax OK (soft limit)
  });

  it("should NEVER trigger DIRECT CUT MODE", () => {
    // Extreme case: risk 15/10
    const mix = [
      { key: "etf", pct: 60 },
      { key: "dyn", pct: 30 },
      { key: "crypto", pct: 10 },
    ];

    const result = enforceRiskCap(mix, "rastovy", stageCaps);

    // Should gracefully fail (soft warning), not DIRECT CUT
    expect(result.warning).toBeDefined();
    expect(result.mix.find((m) => m.key === "etf")!.pct).toBeGreaterThan(30); // Not 50% cut
  });
});
```

---

## 🔗 SÚVISIACE DOKUMENTY

- **ADVISOR-YIELD-OPTIMIZER-REFACTOR.md** – MAX_BOOST caps issue (Phase 2)
- **PR-31** – Yield optimizer implementation
- **PR-28** – enforceRiskCap original implementation
- **PR-34** – Gold policy (safety pass collision)

---

## ✍️ ADVISOR RESPONSE TEMPLATE

**Prosím vyplň:**

### **Q1: Soft risk limit policy**

- [ ] ÁNO – soft limit OK (risk môže byť 8.7 namiesto 8.5)
- [ ] NIE – hard cap must be respected

### **Q2: UP-TUNE aggressiveness**

- [ ] AGGRESSIVE (riskMax - 0.2) – max výnos
- [ ] CONSERVATIVE (riskMax - 1.0) – max stabilita
- [ ] ADAPTIVE (Conservative -1.0, Growth -0.5)

### **Q3: DIRECT CUT MODE**

- [ ] KEEP (iteration 15+ threshold)
- [ ] REMOVE (soft warning only)

### **Q4: Redistribution tolerance**

- [ ] 10% tolerance (Variant C)
- [ ] 5% tolerance (kompromis)
- [ ] Strict caps (current)

### **Final recommendation:**

- [ ] **VARIANT A** (Quick Fix – safe, stable)
- [ ] **VARIANT B** (Recommended – max výnos)
- [ ] **VARIANT C** (Full – comprehensive)
- [ ] **VARIANT B+A** (Hybrid – balanced)

### **Additional notes:**

```
(Tvoje poznámky, concerns, alternatívne nápady...)
```

---

**Prepared by:** Adam (unotop)  
**Date:** 2026-01-08  
**Status:** AWAITING ADVISOR DECISION  
**Next action:** Implementuj schválený variant → test → merge → prod
