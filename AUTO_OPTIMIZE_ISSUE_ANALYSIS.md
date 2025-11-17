# Auto-Optimize Zasekávanie - Analýza pre Advisora

**Dátum:** 15.11.2025  
**Problém:** Auto-optimize sa zasekáva pri určitých hodnotách investičného horizontu (36-40 rokov)  
**Prejavy:** Chip "Profil vyžaduje prepočítanie" sa zobrazuje náhodne, auto-optimize sa spúšťa opakovane

---

## 1. Popis funkcionality

### Auto-Optimize Mechanizmus

- Automaticky prepočítava portfólio mix keď používateľ zmení investičné parametre
- Aktivuje sa len v BASIC režime (PRO režim má ochranu)
- Má debounce 1s (čaká kým používateľ dokončí zmeny)
- Používa drift detection (rozpoznáva významné zmeny)

### Drift Detection Thresholdy

```typescript
// useProjection.ts (lines 190-230)

// Jednorazová investícia
if (lumpDriftAbs >= 5000 || lumpDriftRel >= 0.2) {
  hasDrift = true;
}

// Mesačný vklad
if (monthlyDriftAbs >= 100 || monthlyDriftRel >= 0.2) {
  hasDrift = true;
}

// Investičný horizont ← PROBLEMATICKÉ
if (horizonDriftAbs >= 2 || horizonDriftRel >= 0.15) {
  hasDrift = true;
}
```

**Príklad výpočtu (horizont 36 → 38 rokov):**

```
horizonDriftAbs = |38 - 36| = 2
horizonDriftRel = 2 / 36 = 0.0556 (5.56%)

Threshold check:
  horizonDriftAbs >= 2  → TRUE ✅
  horizonDriftRel >= 0.15 → FALSE

Výsledok: hasDrift = TRUE (lebo aspoň jedna podmienka)
```

---

## 2. Flow Auto-Optimize (Normálny prípad)

```
1. Používateľ zmení horizont: 10 → 40 rokov
   └─> investParams.horizonYears = 40

2. stableInvestKey sa zmení:
   └─> "0-500-10-0" → "0-500-40-0"

3. useEffect dependencies trigger:
   └─> projection.hasDrift = TRUE
   └─> stableInvestKey changed

4. useEffect spustí:
   a) Check snapshot age (< 3s?) → FALSE
   b) Check lastAutoOptimizeRef → ""
   c) setTimeout(1000ms) → START

5. Po 1s debounce:
   a) lastAutoOptimizeRef = "0-500-40-0-..."
   b) getAdjustedPreset() → nový mix
   c) writeV3({ profileSnapshot: { horizon: 40, ts: Date.now() }})
   d) emitMixChangeEvent()
   e) Toast: "🔄 Mix prispôsobený"

6. v3ForDrift refresh:
   └─> snapshot.horizon = 40
   └─> snapshot.ts = Date.now()

7. projection prepočítanie:
   └─> horizonDriftAbs = |40 - 40| = 0
   └─> hasDrift = FALSE ✅

8. Chip "Profil vyžaduje prepočítanie" zmizne ✅
```

---

## 3. Problémový Flow (Zaseknutie pri 36-40 rokoch)

**Hypotéza 1: Race Condition v React Effect**

```
Timeline:
T=0ms:   User posunie slider → horizont = 38
T=50ms:  useEffect#1 spustí (stableInvestKey changed)
T=100ms: User EŠTE posúva → horizont = 38.2 (malý posun)
T=150ms: useEffect#2 spustí (stableInvestKey changed ZNOVA)
         └─> clearTimeout(timer1) ← Prvý timer zrušený
         └─> setTimeout(1000ms) → timer2 START

T=200ms: User pustí myš → horizont = 38
T=250ms: useEffect#3 spustí (stableInvestKey changed)
         └─> clearTimeout(timer2) ← Druhý timer zrušený
         └─> setTimeout(1000ms) → timer3 START

T=1250ms: timer3 spustí auto-optimize
          └─> writeV3({ horizon: 38, ts: 1250 })

T=1260ms: v3ForDrift refresh
          └─> projection.hasDrift prepočítanie
          └─> horizonDriftAbs = |38 - 38| = 0
          └─> hasDrift = FALSE ← Mal by byť OK

T=1270ms: ALE snapshot.ts = 1250 (čerstvý < 3s)
          └─> Guard: "snapshot too fresh" → SKIP

T=4250ms: snapshot age = 3000ms (už nie je fresh)
          └─> Guard nepracuje
          └─> ALE hasDrift = FALSE → effect SA NESPUSTÍ

✅ V tomto prípade by to MALO fungovať!
```

**Hypotéza 2: Zaokrúhľovanie Slider Hodnôt**

```typescript
// Slider môže vracať desatinné hodnoty
horizonYears: 38.0 → 38.1 → 38.0 → 37.9 → 38.0

// stableInvestKey:
"0-500-38.1-0" → "0-500-38-0" → "0-500-37.9-0" → "0-500-38-0"

// Každá zmena spúšťa effect ZNOVA
```

**Príklad problému:**

```
1. Slider hodnota: 38.0 → auto-optimize → snapshot.horizon = 38.0
2. User malý posun: 38.0 → 38.1
3. stableInvestKey: "...-38.1-..." (ZMENA)
4. useEffect trigger
5. Drift check: |38.1 - 38.0| = 0.1 < 2 → hasDrift = FALSE
6. Effect sa NESPUSTÍ (hasDrift = FALSE) ✅

ALE čo ak:
1. Slider hodnota: 38.0
2. Auto-optimize: snapshot.horizon = 38
3. Slider vracia: 38.00001 (floating point precision)
4. stableInvestKey: "...-38.00001-..." (NOVÁ hodnota)
5. Drift check: |38.00001 - 38| = 0.00001 < 2 → hasDrift = FALSE
6. ALE stableInvestKey sa zmenil → effect DEPENDENCIES TRIGGER
7. Effect spustí, ale guard "snapshot too fresh" → SKIP
8. Po 3s guard vypne → hasDrift = FALSE → NESPUSTÍ

✅ Toto by tiež NEMALO spôsobiť loop
```

**Hypotéza 3: V3ForDrift UseMemo Dependencies**

```typescript
// BasicLayout.tsx (line 313-316)
const v3ForDrift = React.useMemo(
  () => readV3(),
  [driftRefreshKey, investParams] // ← investParams je OBJECT!
);
```

**PROBLÉM:**

- `investParams` je objekt `{ lumpSumEur, monthlyVklad, horizonYears, goalAssetsEur }`
- Pri KAŽDOM renderi React vytvára NOVÝ objekt (nová referencia)
- `useMemo` porovnáva referencie → vždy TRUE → **VŽDY SA REFRESH**

**Dôsledok:**

```
1. Slider zmena → render
2. investParams = { horizonYears: 38 } ← NOVÁ referencia
3. v3ForDrift useMemo dependencies [investParams] → CHANGED
4. v3ForDrift = readV3() → NOVÉ čítanie
5. projection prepočítanie → NOVÝ hasDrift
6. useEffect dependencies [projection.hasDrift] → TRIGGER
7. LOOP ♻️
```

---

## 4. Aktuálny Kód (Problematické Sekcie)

### A) v3ForDrift Memoization

```typescript
// BasicLayout.tsx (lines 313-316)
const v3ForDrift = React.useMemo(
  () => readV3(),
  [driftRefreshKey, investParams] // ← PROBLÉM: investParams je objekt
);
```

**Fix potrebný:**

```typescript
// Použiť stabilné primitívy namiesto objektu
const v3ForDrift = React.useMemo(
  () => readV3(),
  [
    driftRefreshKey,
    investParams.lumpSumEur,
    investParams.monthlyVklad,
    investParams.horizonYears,
    investParams.goalAssetsEur,
  ]
);
```

### B) Auto-Optimize Effect Dependencies

```typescript
// BasicLayout.tsx (lines 421-427)
}, [
  projection.hasDrift,        // ← Mení sa pri každom v3ForDrift refresh
  projection.canReapply,
  stableInvestKey,
  stableCashflowKey,
]);
```

**Problém:**

- `projection.hasDrift` je v dependencies
- Ak sa `v3ForDrift` mení pri každom renderi (kvôli `investParams` objektu)
- Potom `projection` sa prepočítava pri každom renderi
- Potom `projection.hasDrift` sa mení pri každom renderi
- Effect sa spúšťa pri každom renderi → **INFINITE LOOP**

---

## 5. Testovacie Scenáre

### Test 1: Jeden slider posun (10 → 40)

```
Očakávané:
1. Auto-optimize spustí 1x po 1s
2. Toast: "🔄 Mix prispôsobený"
3. Chip zmizne
4. Žiadne ďalšie spustenia

Aktuálne (BUG):
1. Auto-optimize spustí
2. Chip zmizne
3. Po ~5s sa chip ZNOVA ZOBRAZÍ ← PROBLÉM
4. Auto-optimize SA NESPUSTÍ (hasDrift detekovaný, ale guard blokuje)
```

### Test 2: Rýchle posúvanie (36 → 37 → 38 → 39 → 40)

```
Očakávané:
1. Debounce čaká kým používateľ skončí
2. Auto-optimize spustí 1x po 1s od posledného posunu
3. Chip zmizne

Aktuálne (BUG):
1. Debounce funguje
2. Auto-optimize spustí
3. Chip zmizne
4. Po 3-5s sa chip ZNOVA ZOBRAZÍ ← PROBLÉM
```

### Test 3: Konkrétne hodnoty (36, 38, 40 rokov)

```
Pozorované:
- Pri hodnotách 36-40 rokov sa chip zobrazuje častejšie
- Pri hodnotách 10-20 rokov problém menší
- Náhodný charakter (nie vždy reproducible)

Možná príčina:
- Pri vyšších hodnotách horizonDriftRel je menší (2/40 = 5% vs 2/10 = 20%)
- Edge case okolo thresholdu horizonDriftAbs >= 2
```

---

## 6. Debug Výpis (Konzola)

### Normálny prípad (funguje):

```
[BasicLayout] BETA auto-optimize triggered
🔄 Mix prispôsobený novým vstupom (auto-optimize)
[BasicLayout] Auto-optimize skipped - snapshot too fresh (age: 150 ms)
[BasicLayout] Auto-optimize skipped - already processed: 0-500-40-0-...
```

### Problémový prípad (zaseknutie):

```
[BasicLayout] BETA auto-optimize triggered
🔄 Mix prispôsobený novým vstupom (auto-optimize)
[BasicLayout] Auto-optimize skipped - snapshot too fresh (age: 150 ms)
[BasicLayout] Auto-optimize skipped - snapshot too fresh (age: 2800 ms)
[BasicLayout] Auto-optimize skipped - already processed: 0-500-38-0-...
[BasicLayout] BETA auto-optimize triggered  ← ZNOVA po 5s!
🔄 Mix prispôsobený novým vstupom (auto-optimize)
[BasicLayout] Auto-optimize skipped - snapshot too fresh (age: 180 ms)
... LOOP ♻️
```

---

## 7. Navrhované Riešenie

### Fix 1: v3ForDrift Stabilné Dependencies

```typescript
// PRED (PROBLÉM)
const v3ForDrift = React.useMemo(
  () => readV3(),
  [driftRefreshKey, investParams] // ← Object referencia
);

// PO (FIX)
const v3ForDrift = React.useMemo(
  () => readV3(),
  [
    driftRefreshKey,
    investParams.lumpSumEur,
    investParams.monthlyVklad,
    investParams.horizonYears,
    investParams.goalAssetsEur,
  ]
);
```

### Fix 2: Odstrániť projection.hasDrift z Dependencies

```typescript
// PRED (PROBLÉM)
}, [
  projection.hasDrift,     // ← Trigger pri každom projection refresh
  projection.canReapply,
  stableInvestKey,
  stableCashflowKey,
]);

// PO (FIX)
}, [
  stableInvestKey,         // ← Len stabilné kľúče
  stableCashflowKey,
]);

// Vnútri effectu manuálne check:
if (!projection.hasDrift || !projection.canReapply) return;
```

### Fix 3: Zaokrúhľovanie Horizont Hodnôt

```typescript
// stableInvestKey zaokrúhľovanie
const horizonRounded = Math.round(investParams.horizonYears);
const stableInvestKey = `${investParams.lumpSumEur}-${investParams.monthlyVklad}-${horizonRounded}-${investParams.goalAssetsEur}`;
```

---

## 8. Alternatívne Riešenie (Radical)

**Úplne vypnúť auto-optimize pre horizont:**

```typescript
// useProjection.ts - upraviť drift detection
const horizonDriftAbs = Math.abs(horizonYears - snapshot.horizon);
const horizonDriftRel = horizonDriftAbs / Math.max(snapshot.horizon, 1);

// Zvýšiť threshold na 5 rokov (namiesto 2)
if (horizonDriftAbs >= 5 || horizonDriftRel >= 0.25) {
  driftFields.push("horizon");
  hasDrift = true;
}
```

**Dôvod:**

- Horizont zmena o 2 roky nie je tak významná pre mix adjustment
- Používatelia často "experimentujú" so sliderom
- Lepšie počkať kým urobia väčšiu zmenu (5+ rokov)

---

## 9. Otázky pre Advisora

1. **Je horizont threshold 2 roky správny?**
   - Malo by sa mix prepočítať už pri zmene 10 → 12 rokov?
   - Alebo až pri 10 → 15 rokov?

2. **Je auto-optimize vôbec potrebný pre horizont?**
   - Používatelia často experimentujú so sliderom
   - Mix adjustment pre horizont je menej kritický ako pre lump sum/monthly

3. **Mal by byť auto-optimize úplne vypnutý?**
   - Nahradiť ho len manuálnym tlačidlom "Prepočítať profil"
   - BASIC režim = jednoduchosť, nie automatizácia

4. **Sú drift thresholdy optimálne?**
   ```
   Lump sum:  5000€ alebo 20%
   Monthly:   100€ alebo 20%
   Horizont:  2 roky alebo 15%  ← TOTO JE PODOZRIVÉ
   ```

---

## 10. Reprodukcia Problému

### Postup:

```
1. Vymazať localStorage: localStorage.clear()
2. Refresh stránky
3. Kliknúť "Začať plánovať" v intro
4. Vybrať profil: Vyvážený
5. Nastaviť:
   - Jednorazový vklad: 0€
   - Mesačný vklad: 500€
   - Horizont: 10 rokov
6. Počkať 2s (auto-optimize)
7. Pomaly posúvať horizont: 10 → 15 → 20 → 25 → 30 → 35 → 38
8. Pozorovať:
   - Chip "Profil vyžaduje prepočítanie" sa zobrazuje/mizne
   - Konzola: počet "auto-optimize triggered"
   - Toast: "🔄 Mix prispôsobený" - koľkokrát?
```

### Očakávaný výsledok:

```
- Auto-optimize spustí 5-6x (pri každom kroku)
- Chip zmizne po každom auto-optimize
- Žiadne zaseknutie
```

### Aktuálny výsledok (BUG):

```
- Auto-optimize spustí 5-6x
- Chip zmizne
- Po ~5s sa chip ZNOVA ZOBRAZÍ pri hodnotách 36-40
- Konzola: loop "auto-optimize triggered" → "snapshot too fresh"
```

---

## 11. Doplňujúce Informácie

### Verzia Kódu:

- Branch: `feat/pr-7-gdpr-bottom-bar-info-mix`
- Last commit: PR-13 debt management + auto-optimize fixes
- React version: 18.3.1
- Node version: 22.20.0

### Relevantné Súbory:

1. `src/BasicLayout.tsx` (lines 310-430) - Auto-optimize effect
2. `src/features/projection/useProjection.ts` (lines 190-230) - Drift detection
3. `src/persist/v3.ts` - ProfileSnapshot type
4. `src/features/portfolio/presets.ts` - getAdjustedPreset()

### Logovanie:

Pre debug pridať do konzoly:

```typescript
// V auto-optimize effect
console.log("[DEBUG] Effect triggered:", {
  hasDrift: projection.hasDrift,
  canReapply: projection.canReapply,
  stableInvestKey,
  lastAutoOptimize: lastAutoOptimizeRef.current,
  snapshotAge: snapshot?.ts ? Date.now() - snapshot.ts : null,
});
```

---

**Kontakt:** Adam (Developer)  
**Pre advisora:** Prosím analyzuj hlavne **Hypotézu 3** (v3ForDrift useMemo dependencies) a **Fix 1/2** návrhy. Myslím si že tam je root cause.
