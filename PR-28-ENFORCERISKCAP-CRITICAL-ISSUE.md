# 🚨 KRITICKÝ PROBLÉM: enforceRiskCap nefunguje správne – DEADLOCK a zlyhávanie validácie

## Kontext

PR-28 implementuje systém **hard risk cap** (riskMax: 5.0/7.0/8.5) s 2-úrovňovým fallback mechanizmom. Po Fix #3 (2-level fallback: PRIMARY gold+cash, FALLBACK bonds/ETF) sme stále **v DEADLOCK situácii pri všetkých 3 profiloch**.

---

## 🔴 PROBLÉM: Všetky 3 profily FAILUJÚ

### Test scenár

- **Lump sum**: 0 €
- **Mesačný vklad**: 250 €
- **Horizont**: Nezadaný (predpoklad ~20-23 rokov)
- **Mesačný príjem**: 4000 €
- **Celkový prvý rok**: 3000 € (lump + 12×monthly)

---

## 📊 VÝSLEDKY TESTOVANIA

### 1️⃣ **RASTOVÝ profil** (riskMax: 8.5)

**Status**: ❌ **VALIDATION FAILED**

```
Initial risk: 9.19 / max 8.50
Iteration 7: etf 50.00% → 45.00% (-5.00 p.b.)
  → gold +0.26 p.b. (weight 0.5, room 0.3%)
  → cash +2.50 p.b. (weight 0.5, room 39.7%)
  ⚠️ Primary full (gold 39.7%, cash 10.3%), using FALLBACK (2.24 p.b.)
  → bonds +1.12 p.b. (FALLBACK, room 40.0%)
  → etf +0.56 p.b. (FALLBACK, room 5.0%)
  DEADLOCK: Cannot redistribute 0.56 p.b. (all targets full: gold 39.7%, cash 10.3%)

⚠️ Risk blízko horného limitu profilu (8.7 / 8.5)
Final: 9.19 → 8.69 (7 iterations)

VALIDATION FAILED: Príliš vysoká alokácia gold (40.22%). Max 40%.
```

**Problémy**:

- ✅ Risk KLESOL (9.19 → 8.69), ale **stále nad limitom** (8.69 > 8.50)
- ❌ DEADLOCK pri 0.56 p.b. remainder (ETF fallback nemá miesto)
- ❌ Gold prekročil 40% stage cap (40.22% > 40%)
- ❌ Validácia FAILED

---

### 2️⃣ **VYVÁŽENÝ profil** (riskMax: 7.0)

**Status**: ❌ **VALIDATION FAILED**

```
Initial risk: 7.51 / max 7.00
Iteration 1: crypto 6.00% → 4.00% (-2.00 p.b.)
  → cash +0.80 p.b. (weight 0.4, room 43.0%)
  ⚠️ Primary full (gold 40.0%, cash 7.0%), using FALLBACK (1.20 p.b.)
  → bonds +0.84 p.b. (FALLBACK, room 40.0%)
  → etf +0.11 p.b. (FALLBACK, room 3.0%)
  DEADLOCK: Cannot redistribute 0.25 p.b. (all targets full: gold 40.0%, cash 7.0%)

⚠️ CRITICAL: Risk prekročil limit aj po 1 iteráciách (7.5 / 7.0)
Final: 7.51 → 7.51 (1 iterations)  ← RISK SA NEZMENIL!

VALIDATION FAILED: Príliš vysoká alokácia gold (40.1%). Max 40%.
```

**Problémy**:

- ❌ Risk **SA VÔBEC NEZMENIL** (7.51 → 7.51)
- ❌ DEADLOCK po prvej iterácii (0.25 p.b. remainder)
- ❌ Gold už na začiatku na limite (40.0%), fallback nemá kam dávať
- ❌ Cash má LOW cap (7%), rýchlo sa naplní
- ❌ Bonds + ETF fallback nestačia (0.25 p.b. zostáva)

---

### 3️⃣ **KONZERVATÍVNY profil** (riskMax: 5.0)

**Status**: ❌ **VALIDATION FAILED**

```
Initial risk: 7.31 / max 5.00
Gold JUŽ NA ZAČIATKU: 40.3% (NAD LIMITOM!)

Iteration 1-3: real reduction → bonds FALLBACK (gold už plný)
Iteration 4-15: bonds 4.20% → 0.00%
  KAŽDÁ iterácia:
    → cash +0.XX p.b. (weight 0.3, room 3X%)
    ⚠️ Primary full (gold 40.3%, cash 1X.X%), using FALLBACK (1.XX p.b.)
    → bonds +1.XX p.b. (FALLBACK, room 3X%)

PROBLÉM: Bonds sa PRIDÁVAJÚ a následne OPÄŤ REDUKUJÚ
→ Nekonečný cyklus: bonds +1.40 → bonds reduction -1.80 → bonds +1.26 → reduction...

After iteration 15: risk 7.19 (iba -0.12 po 15 iteráciách!)
⚠️ CRITICAL: Risk prekročil limit aj po 15 iteráciách (7.2 / 5.0)
Final: 7.31 → 7.19 (15 iterations)

VALIDATION FAILED: Príliš vysoká alokácia gold (40.27%). Max 40%.
```

**Problémy**:

- ❌ **NEKONEČNÝ CYKLUS**: bonds sa pridávajú (FALLBACK) a potom opäť redukujú (v RISK_ORDERED_KEYS)
- ❌ Gold **UŽ NA ZAČIATKU NAD 40%** (40.3% → 40.27%, nikdy neklesne pod limit)
- ❌ Risk **TAKMER SA NEMENÍ** (7.31 → 7.19, iba -0.12 po 15 iteráciách)
- ❌ Cash LOW cap (max 50%), rýchlo sa naplní
- ❌ 15 iterácií MAX LIMIT dosiahnutý, stále risk 7.19 vs. limit 5.0

---

## 🧠 ROOT CAUSE ANALÝZA

### Problém #1: **BONDS v RISK_ORDERED_KEYS aj FALLBACK**

```typescript
// enforceRiskCap.ts
RISK_ORDERED_KEYS: ['crypto', 'dyn', 'real', 'bond3y9', 'bonds', 'etf', 'gold', 'cash']
                                                        ^^^^^^
SAFE_TARGETS_FALLBACK: {
  konzervativny: [{ key: 'bonds', weight: 1.0 }],  ← bonds sa PRIDÁVAJÚ
  vyvazeny: [{ key: 'bonds', weight: 0.70 }, ...]
}
```

**Dôsledok**:

- Iteration N: bonds sa PRIDAJÚ (fallback, +1.40 p.b.)
- Iteration N+1: bonds sa REDUKUJÚ (v RISK_ORDERED_KEYS, -2.00 p.b.)
- Iteration N+2: bonds sa opäť PRIDAJÚ (fallback, +1.26 p.b.)
- **→ NEKONEČNÝ CYKLUS**, risk sa takmer nemení

---

### Problém #2: **Gold už NA ZAČIATKU nad stage cap**

```
Konzervativny: gold 40.3% (limit 40%)
Vyvážený: gold 40.0% (limit 40%)
Rastový: gold 39.7% → 40.22% po redistribúcii
```

**Dôsledok**:

- PRIMARY target (gold) **NEMÁ MIESTO** od začiatku
- 0.99 buffer nestačí (gold 40.3% × 0.99 = 39.9%, ale real gold už 40.3%)
- Cash LOW cap (7%/10%/50%) sa rýchlo naplní
- **FALLBACK aktivovaný OKAMŽITE**, ale...

---

### Problém #3: **Fallback nemá dostatok kapacity**

```
Rastový:
  ETF fallback: room 5.0% → +0.56 p.b. → DEADLOCK 0.56 p.b.
  (ETF stage cap 50%, už má 45%)

Vyvážený:
  Bonds fallback: room 40.0% → +0.84 p.b.
  ETF fallback: room 3.0% → +0.11 p.b. → DEADLOCK 0.25 p.b.

Konzervativny:
  Bonds fallback: room 35.0% → pridá, ale v ďalšej iterácii sa zase redukuje
```

**Dôsledok**:

- Bonds majú relatívne vysoké riziko (~1.5-2.0), ale **NIE SÚ V RISK_ORDERED_KEYS na TOP pozícii**
- ETF má stage cap 50%, pri rastovom profil už má 45% → iba 5% miesta
- **DEADLOCK threshold 0.1 p.b.** je príliš benevolentný (0.56 p.b. > 0.1 → DEADLOCK log, ale pokračuje)

---

### Problém #4: **0.99 buffer nestačí na rounding errors**

```
Iteration 7 (rastový):
  gold +0.26 p.b. (weight 0.5, room 0.3%)
  → 0.3% × 0.99 = 0.297% max
  → actual allocation 0.26 p.b. OK

  cash +2.50 p.b. (weight 0.5, room 39.7%)
  → 39.7% × 0.99 = 39.3% max
  → actual allocation 2.50 p.b. OK

ALE: Po normalizácii → gold 40.22% (NAD 40%!)
```

**Dôsledok**:

- Normalizácia (`sum === 100%`) **REDISTRIBUUJE zaokrúhľovacie chyby**
- 0.99 buffer platí PRE alokáciu, ale **PO normalizácii sa čísla ZMENIA**
- Gold skončí na 40.22% → validácia FAIL

---

## 🛠️ ODPORÚČANÉ RIEŠENIA (pre advisora)

### Riešenie A: **Odstrániť bonds z RISK_ORDERED_KEYS** (Quick fix)

**Prečo**: Zabráni nekonečnému cyklu (bonds pridané → bonds redukované → bonds pridané...)

```typescript
// enforceRiskCap.ts
const RISK_ORDERED_KEYS: AssetKey[] = [
  "crypto",
  "dyn",
  "real",
  "bond3y9",
  /* REMOVED: 'bonds', */ "etf",
  "gold",
  "cash",
];
```

**Riziko**: Bonds sa NIKDY NEBUDÚ REDUKOVAŤ (len pridávať cez fallback). Ak bonds majú vysokú alokáciu NA ZAČIATKU, risk sa nezníži.

---

### Riešenie B: **Zvýšiť 0.99 buffer na 0.95** (Aggressive cap protection)

**Prečo**: Viac miesta pre rounding errors pri normalizácii.

```typescript
const targetAllocation = Math.min(
  actualReduction * target.weight,
  availableRoom * 0.95 // CHANGED from 0.99
);
```

**Riziko**: Väčšie "plytvanie" miestom → viac DEADLOCK situácií.

---

### Riešenie C: **3-level fallback + ETF do TERTIARY** (Complex fix)

**Architektúra**:

- **PRIMARY**: gold + cash (lowest risk)
- **SECONDARY**: bonds (mid risk ~1.5-2.0)
- **TERTIARY**: ETF (higher risk ~3.0, ale ešte prijateľné)

**Kód**:

```typescript
// LEVEL 1: PRIMARY (gold+cash)
for (const target of safeTargetsPrimary) { ... }

// LEVEL 2: SECONDARY (bonds)
if (remainingReduction > 0.01) {
  for (const target of safeTargetsSecondary) { ... }
}

// LEVEL 3: TERTIARY (ETF)
if (remainingReduction > 0.01) {
  for (const target of safeTargetsTertiary) { ... }
}

// DEADLOCK ak stále remainder > 0.01
```

**Výhoda**: Postupná degradácia (gold → cash → bonds → ETF), viac kapacity.

**Riziko**: Komplikovanejší kód, pomalšie, ťažšie testovať.

---

### Riešenie D: **Validáciu presunúť PO enforceRiskCap** (Validation order fix)

**Prečo**: Stage caps sa ZNOVA kontrolujú PO enforceRiskCap → gold 40.22% sa zredukuje späť na 40%.

**Flow**:

```
CURRENT:
  STEP 6: enforceStageCaps → gold 40%
  STEP 8: enforceRiskCap → gold 40.22% (redistribúcia)
  → Validácia FAIL

PROPOSED:
  STEP 6: enforceStageCaps → gold 40%
  STEP 8: enforceRiskCap → gold 40.22%
  STEP 9: enforceStageCaps (ZNOVA!) → gold 40%
  → Validácia PASS
```

**Riziko**: enforceStageCaps môže ZNOVA zmeniť risk → potrebujeme RECHECK risk po STEP 9.

---

### Riešenie E: **Disable enforceRiskCap pre malé plány** (Graceful degradation)

**Prečo**: effectivePlanVolume < 5,000€ → príliš malý plán na komplexné adjustmenty.

```typescript
if (effectivePlanVolume < 5000) {
  console.warn("Plán príliš malý, enforceRiskCap preskočený");
  return { ...input, enforcedRiskCap: false };
}
```

**Výhoda**: Soft fail, používateľ dostane warning, ale profil sa načíta.

**Riziko**: Risk môže byť NAD limitom (akceptovateľné pre mini plány?).

---

## 🎯 ODPORÚČANÝ POSTUP (TOP-DOWN)

### 1. **IMMEDIATE FIX** (1-2 hodiny)

- [ ] **Riešenie A**: Odstrániť `bonds` z `RISK_ORDERED_KEYS`
- [ ] **Riešenie D**: Pridať `enforceStageCaps()` **PO** `enforceRiskCap()` (STEP 9)
- [ ] **Test**: Všetky 3 profily s 0€/250€/23y

---

### 2. **MEDIUM FIX** (4-6 hodín, ak IMMEDIATE FAIL)

- [ ] **Riešenie C**: Implementovať 3-level fallback (PRIMARY → SECONDARY → TERTIARY)
- [ ] **Riešenie B**: Zvýšiť buffer na 0.95 (alebo dynamic buffer podľa room)
- [ ] **Test**: Regresné scenáre (low/mid/high volume)

---

### 3. **LONG-TERM FIX** (1-2 dni)

- [ ] **Riešenie E**: Graceful degradation pre malé plány
- [ ] **Dynamic buffer**: `buffer = Math.max(0.90, 1 - 0.1 / availableRoom)` (viac room = vyšší buffer)
- [ ] **Unit testy**: `tests/portfolio.enforceRiskCap-fallback.test.tsx`
- [ ] **Edge case handling**: Gold > 40% na začiatku → force reduction pred enforceRiskCap

---

## 📋 DEBUG INFO PRE ADVISORA

### Dôležité čísla (konzervativny):

```
Initial: gold 40.3%, cash 9.4%, bonds 0%, etf 43.9%, real 6.0%
Stage caps: gold 40%, cash 50%, ETF 50%
Risk: 7.31 / max 5.00

Expected final: gold 40%, cash ~10-15%, bonds ~5-8%, etf ~30-35%
Actual final: gold 40.27%, cash 15.8%, bonds 0.1%, etf 43.9%
→ ETF NEBOL DOSTATOČNE REDUKOVANÝ
```

### Prečo ETF nebol redukovaný?

- Bonds sa PRIDALI (fallback) → bonds sa REDUKOVALI (RISK_ORDERED_KEYS) → **PING-PONG**
- Real sa redukoval na 0% → bonds sa pridali na 4.2% → bonds sa redukovali na 0%
- **ETF ostal nedotknutý** (až po bonds v RISK_ORDERED_KEYS)
- Risk zostal 7.19 (nad limitom 5.0)

---

## ❓ OTÁZKY PRE ADVISORA

1. **Je akceptovatelné, aby bonds NEBOLI v RISK_ORDERED_KEYS?**
   - Ak áno → Riešenie A (quick fix)
   - Ak nie → Riešenie C (3-level fallback)

2. **Môžeme tolerovať soft fail pre malé plány (< 5k€)?**
   - Ak áno → Riešenie E
   - Ak nie → musíme vyriešiť A/C

3. **Je stage cap enforcement PO enforceRiskCap akceptovateľný?**
   - Ak áno → Riešenie D
   - Ak nie → musíme zaručiť, že enforceRiskCap NIKDY neprekročí stage caps

4. **Aká je priorita: risk limit vs. stage cap?**
   - Ak risk limit > stage cap → stage caps sú HARD, risk soft
   - Ak stage cap > risk limit → risk je HARD, stage caps soft

---

## 🔗 SÚVISIACE SÚBORY

```
src/features/portfolio/enforceRiskCap.ts (lines 33-290)
src/features/portfolio/mixAdjustments.ts (lines 332-357)
src/features/policy/risk.ts (lines 14-25, RISK_MAX config)
src/features/portfolio/presets.ts (enforceStageCaps cache)
```

---

**URGENT**: Potrebujeme rozhodnutie advisora, ktoré riešenie (A/B/C/D/E) implementovať. Bez toho nemôžeme pokročiť na Phase B (UX layer).
