# Auto-Optimizer - Detailná Analýza pre Advisora

**Dátum:** 17.11.2025  
**Problém:** Auto-optimizer sa niekedy zasekáva/odsekáva pri menení investičných nastavení  
**Režim:** BASIC (auto-optimize aktívny len v BASIC, PRO má ochranu)  
**Kontext:** Používateľ robí veľké skoky v parametroch → UI sa sem-tam odsekne/zasekne

---

## 1. Čo je Auto-Optimizer?

### Účel

Automaticky prepočítava portfólio mix keď používateľ zmení investičné parametre (lump sum, monthly, horizon, goal).

### Kedy sa spúšťa

- **Len v BASIC režime** (PRO má ochranu - manuálny režim)
- **Toggle ON** (`profile.autoOptimizeMix = true`, default)
- **Drift detection** rozpozná významné zmeny
- **Debounce 1s** - čaká kým používateľ dokončí zmeny

### Výstup

- Upraví mix podľa nových parametrov (getAdjustedPreset)
- Uloží snapshot (lumpSum, monthly, horizon, timestamp)
- Zobrazí toast: "🔄 Mix prispôsobený"
- Zmizne chip "Profil vyžaduje prepočítanie"

---

## 2. Drift Detection Mechanizmus

### Thresholdy (Absolútne OR Relatívne)

```typescript
// useProjection.ts (lines 184-211)

// Jednorazová investícia
const lumpDriftAbs = Math.abs(lumpSumEur - snapshot.lumpSum);
const lumpDriftRel = lumpDriftAbs / Math.max(snapshot.lumpSum, 1);
if (lumpDriftAbs >= 5000 || lumpDriftRel >= 0.2) {
  driftFields.push("lumpSum");
  hasDrift = true;
}

// Mesačný vklad
const monthlyDriftAbs = Math.abs(monthlyVklad - snapshot.monthly);
const monthlyDriftRel = monthlyDriftAbs / Math.max(snapshot.monthly, 1);
if (monthlyDriftAbs >= 100 || monthlyDriftRel >= 0.2) {
  driftFields.push("monthly");
  hasDrift = true;
}

// Investičný horizont (BASIC režim = IGNOROVANÉ)
const horizonDriftAbs = Math.abs(horizonYears - snapshot.horizon);
const horizonDriftRel = horizonDriftAbs / Math.max(snapshot.horizon, 1);

if (modeUi === "BASIC") {
  // BASIC: Ignoruj horizon ako trigger (žiadne auto-optimize pre posun slidera)
  // Používateľ uvidí chip "Profil vyžaduje prepočítanie", ale auto-optimize nespustí
} else {
  // PRO: Vyšší threshold (5 rokov alebo 25%)
  if (horizonDriftAbs >= 5 || horizonDriftRel >= 0.25) {
    driftFields.push("horizon");
    hasDrift = true;
  }
}
```

### Príklady výpočtov

**Scenár 1: Lump sum zmena**

```
Snapshot: lumpSum = 10000
Current:  lumpSum = 18000

lumpDriftAbs = |18000 - 10000| = 8000
lumpDriftRel = 8000 / 10000 = 0.80 (80%)

Threshold check:
  lumpDriftAbs >= 5000  → TRUE ✅
  lumpDriftRel >= 0.20  → TRUE ✅

Výsledok: hasDrift = TRUE → auto-optimize sa spustí
```

**Scenár 2: Monthly vklad zmena**

```
Snapshot: monthly = 500
Current:  monthly = 650

monthlyDriftAbs = |650 - 500| = 150
monthlyDriftRel = 150 / 500 = 0.30 (30%)

Threshold check:
  monthlyDriftAbs >= 100  → TRUE ✅
  monthlyDriftRel >= 0.20 → TRUE ✅

Výsledok: hasDrift = TRUE → auto-optimize sa spustí
```

**Scenár 3: Horizont zmena (BASIC režim)**

```
Snapshot: horizon = 10
Current:  horizon = 38

horizonDriftAbs = |38 - 10| = 28
horizonDriftRel = 28 / 10 = 2.80 (280%)

BASIC režim:
  Horizon ignorovaný ako trigger
  Chip "Profil vyžaduje prepočítanie" sa zobrazí
  ALE auto-optimize sa NESPUSTÍ ❌

Výsledok: hasDrift = FALSE (lebo horizon nezapočítaný)
```

**Scenár 4: Malý posun slidera**

```
Snapshot: lumpSum = 10000, monthly = 500, horizon = 10
Current:  lumpSum = 10500, monthly = 520, horizon = 11

lumpDriftAbs = 500 < 5000 ❌
lumpDriftRel = 0.05 < 0.20 ❌
monthlyDriftAbs = 20 < 100 ❌
monthlyDriftRel = 0.04 < 0.20 ❌
horizonDriftAbs = 1 (ignorovaný v BASIC)

Výsledok: hasDrift = FALSE → auto-optimize sa NESPUSTÍ ✅
```

---

## 3. Auto-Optimize Flow (Normálny Prípad)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Používateľ zmení lump sum: 10000 → 18000               │
│    └─> investParams.lumpSumEur = 18000                     │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. stableInvestKey sa zmení:                               │
│    "10000-500-10-0" → "18000-500-10-0"                     │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. useEffect dependencies trigger:                         │
│    [stableInvestKey, stableCashflowKey]                    │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. useEffect telo (BasicLayout.tsx lines 416-508):        │
│    a) Check: projection.hasDrift? → TRUE ✅                │
│    b) Check: projection.canReapply? → TRUE ✅              │
│    c) Check: snapshot age < 3s? → FALSE ✅                 │
│    d) Check: lastAutoOptimizeRef === currentKey? → FALSE ✅│
│    e) setTimeout(1000ms) → TIMER START                     │
└─────────────────────────────────────────────────────────────┘
                          ↓
                     [Debounce 1s]
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. Timer callback spustí:                                  │
│    a) lastAutoOptimizeRef = "18000-500-10-0-..."           │
│    b) getAdjustedPreset(preset, profile) → nový mix        │
│    c) writeV3({                                            │
│         mix: adjusted.mix,                                 │
│         mixOrigin: "presetAdjusted",                       │
│         profileSnapshot: {                                 │
│           lumpSum: 18000,                                  │
│           monthly: 500,                                    │
│           horizon: 10,                                     │
│           ts: Date.now()                                   │
│         }                                                  │
│       })                                                   │
│    d) emitMixChangeEvent()                                 │
│    e) Toast: "🔄 Mix prispôsobený"                        │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. v3ForDrift refresh (BasicLayout.tsx lines 388-396):    │
│    Dependencies: [driftRefreshKey, lumpSum, monthly,       │
│                   horizonRounded, goal]                    │
│    └─> readV3() → nový snapshot                           │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 7. useProjection prepočítanie:                            │
│    lumpDriftAbs = |18000 - 18000| = 0                     │
│    hasDrift = FALSE ✅                                     │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 8. UI update:                                              │
│    Chip "Profil vyžaduje prepočítanie" zmizne ✅          │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Problémový Flow (Zaseknutie)

### Hypotéza 1: 100ms Polling Race Condition

**Problém:**

- BasicLayout.tsx má 2 setInterval (100ms polling):
  - Lines 330-342: Cashflow data sync
  - Lines 345-357: Investment params sync
- Každých 100ms vytvára NOVÉ objekty → nové referencie
- React dependencies [investParams, cashflowData] → TRIGGER

**Timeline (Problémový scenár):**

```
T=0ms:    User posunie slider → lumpSum = 18000
          └─> BasicSettingsPanel.tsx writeV3()

T=100ms:  Polling interval #1 → readV3()
          setInvestParams({ lumpSum: 18000, ... }) ← NOVÁ referencia
          └─> stableInvestKey changed
          └─> useEffect trigger → setTimeout(1000ms) → timer1

T=200ms:  Polling interval #2 → readV3()
          setInvestParams({ lumpSum: 18000, ... }) ← NOVÁ referencia (opäť!)
          └─> stableInvestKey: "18000-500-10-0" (rovnaká hodnota, ale RE-RENDER)
          └─> useEffect trigger ZNOVA → clearTimeout(timer1) → timer2

T=300ms:  Polling interval #3 → readV3()
          setInvestParams({ lumpSum: 18000, ... }) ← NOVÁ referencia
          └─> useEffect trigger → clearTimeout(timer2) → timer3

... LOOP každých 100ms ...

T=1300ms: Konečne žiadna zmena → timer3 dokončí → auto-optimize
```

**Dôsledok:**

- Auto-optimize sa spustí, ALE s oneskorením 1s + N×100ms (kde N = počet polling intervalov)
- UI sa "zasekne" lebo React re-renderuje každých 100ms
- Používateľ vidí "odseknutie" keď posúva slider

### Hypotéza 2: v3ForDrift UseMemo Dependencies

**Problém:**

```typescript
// BasicLayout.tsx (lines 388-396) - OPRAVENÉ v PR-12
const v3ForDrift = React.useMemo(
  () => readV3(),
  [
    driftRefreshKey,
    investParams.lumpSumEur, // ✅ Primitív
    investParams.monthlyVklad, // ✅ Primitív
    horizonYearsRounded, // ✅ Primitív (zaokrúhlený)
    investParams.goalAssetsEur, // ✅ Primitív
  ]
);
```

**Pôvodný problém (pred PR-12):**

```typescript
// STARÝ KÓD (pred fix):
const v3ForDrift = React.useMemo(
  () => readV3(),
  [driftRefreshKey, investParams] // ❌ investParams je OBJEKT!
);
```

**Dôsledok starého kódu:**

- `investParams` objekt = nová referencia každých 100ms (polling)
- `useMemo` dependencies [investParams] → vždy TRUE → **refresh loop**
- `projection.hasDrift` prepočítaný každých 100ms
- useEffect auto-optimize trigger → clear timer → nový timer → LOOP

**Fix (PR-12):**

- Rozložené na primitívy (lumpSumEur, monthlyVklad, ...)
- Zaokrúhlený horizon (eliminuje FP noise)
- Stabilné dependencies → useMemo triggeruje LEN pri skutočnej zmene

### Hypotéza 3: Floating Point Precision Noise

**Problém:**

```typescript
// Slider môže vracať desatinné hodnoty
horizonYears: 10.0 → 10.000001 → 10.0 → 9.999999 → 10.0

// stableInvestKey:
"18000-500-10.000001-0" → "18000-500-10-0" → "18000-500-9.999999-0"

// Každá zmena spúšťa useEffect
```

**Fix (PR-12):**

```typescript
// BasicLayout.tsx (line 385)
const horizonYearsRounded = Math.round(investParams.horizonYears);

// stableInvestKey používa rounded hodnotu:
const stableInvestKey = `${lumpSumEur}-${monthly}-${horizonYearsRounded}-${goal}`;
```

### Hypotéza 4: Snapshot Freshness Guard Conflict

**Guard:**

```typescript
// BasicLayout.tsx (lines 436-447)
const snapshot = v3.profileSnapshot;
if (snapshot && snapshot.ts) {
  const age = Date.now() - snapshot.ts;
  if (age < 3000) {
    console.log("Auto-optimize skipped - snapshot too fresh");
    return;
  }
}
```

**Problémový scenár:**

```
T=0ms:    User zmení lumpSum → auto-optimize → snapshot.ts = 0
T=1000ms: Auto-optimize callback → writeV3({ ts: 1000 })
T=1100ms: Polling → setInvestParams → stableInvestKey changed
T=1100ms: useEffect trigger
T=1100ms: Check: snapshot.ts = 1000, age = 100ms < 3000ms → SKIP ✅
T=4100ms: Snapshot age = 3000ms → guard vypnutý
T=4100ms: ALE hasDrift = FALSE (už nie je drift) → effect sa NESPUSTÍ ✅

✅ Guard funguje správne - zabráni zbytočným re-runs
```

---

## 5. Aktuálny Kód (Kritické Sekcie)

### A) 100ms Polling (HLAVNÝ PODOZRIVÝ)

**BasicLayout.tsx (lines 330-357):**

```typescript
// Sync cashflow data from persist (100ms polling)
React.useEffect(() => {
  const interval = setInterval(() => {
    const v3 = readV3();
    setCashflowData({
      monthlyIncome: (v3.profile?.monthlyIncome as any) || 0,
      fixedExp: (v3.profile?.fixedExp as any) || 0,
      varExp: (v3.profile?.varExp as any) || 0,
    });
  }, 100); // ← Každých 100ms vytvára NOVÝ objekt
  return () => clearInterval(interval);
}, []);

// Sync invest params from persist (100ms polling)
React.useEffect(() => {
  const interval = setInterval(() => {
    const v3 = readV3();
    setInvestParams({
      lumpSumEur: (v3.profile?.lumpSumEur as any) || 0,
      monthlyVklad: (v3 as any).monthly || 0,
      horizonYears: (v3.profile?.horizonYears as any) || 10,
      goalAssetsEur: (v3.profile?.goalAssetsEur as any) || 0,
    });
  }, 100); // ← Každých 100ms vytvára NOVÝ objekt
  return () => clearInterval(interval);
}, []);
```

**Prečo je to problém:**

1. **Nové objekty každých 100ms** → React vidí zmenu referencie
2. **stableInvestKey prepočítanie** → nová string hodnota (aj keď číselne rovnaká)
3. **useEffect auto-optimize dependencies** → trigger
4. **setTimeout(1000ms)** → clear predchádzajúci timer → nový timer
5. **LOOP** každých 100ms kým používateľ neprestane meniť hodnoty

**Možné riešenia:**

- ✅ **Event-based sync** (POKUS: zlyhalo, rozbilo to auto-optimizer úplne)
- ⏳ **Optimalizovaný polling** (value equality check pred setState)
- ⏳ **Zvýšiť interval** (500ms namiesto 100ms)
- ⏳ **useSyncExternalStore** (React 18 API pre external state)

### B) Auto-Optimize useEffect

**BasicLayout.tsx (lines 416-508):**

```typescript
React.useEffect(() => {
  const v3 = readV3();
  const autoOptEnabled = v3.profile?.autoOptimizeMix ?? true;
  const modeUi = (v3.profile?.modeUi as any) || "BASIC";

  // Auto-optimize LEN v BASIC režime
  if (modeUi !== "BASIC") return;
  if (!autoOptEnabled) return;

  // Early-return ak drift neexistuje
  if (!projection.hasDrift || !projection.canReapply) return;
  if (!v3.presetId) return;

  // Guard proti infinite loop - skip ak snapshot je čerstvý (< 3s)
  const snapshot = v3.profileSnapshot;
  if (snapshot && snapshot.ts) {
    const age = Date.now() - snapshot.ts;
    if (age < 3000) {
      console.log("Auto-optimize skipped - snapshot too fresh");
      return;
    }
  }

  // Debounce 1s
  const timer = setTimeout(() => {
    // Skip ak už spracované
    const currentKey = `${stableInvestKey}-${stableCashflowKey}`;
    if (lastAutoOptimizeRef.current === currentKey) {
      console.log("Auto-optimize skipped - already processed");
      return;
    }

    // ... auto-optimize logika ...

    lastAutoOptimizeRef.current = currentKey;
  }, 1000);

  return () => clearTimeout(timer);
}, [
  stableInvestKey, // ← Mení sa každých 100ms (polling!)
  stableCashflowKey, // ← Mení sa každých 100ms (polling!)
]);
```

**Prečo triggery sú problém:**

- `stableInvestKey` = `"${lumpSum}-${monthly}-${horizonRounded}-${goal}"`
- Polling každých 100ms → setInvestParams → nový objekt → stableInvestKey prepočítanie
- Aj keď HODNOTY sú rovnaké, React vidí NOVÚ string referenciu
- Dependencies trigger → useEffect → clearTimeout → nový timer

### C) Drift Detection v useProjection

**useProjection.ts (lines 184-211):**

```typescript
// PR-12: Drift detection pre lazy reapply
const v3 =
  typeof window !== "undefined"
    ? (() => {
        try {
          const raw =
            localStorage.getItem("unotop:v3") ||
            localStorage.getItem("unotop_v3");
          return raw ? JSON.parse(raw) : {};
        } catch {
          return {};
        }
      })()
    : {};

const mixOrigin = v3.mixOrigin as "presetAdjusted" | "manual" | undefined;
const presetId = v3.presetId as string | undefined;
const snapshot = v3.profileSnapshot;

const canReapply = mixOrigin === "presetAdjusted" && !!presetId;

const driftFields: string[] = [];
let hasDrift = false;

if (canReapply && snapshot) {
  const modeUi = inputs.modeUi || "BASIC";

  // Lump sum drift
  const lumpDriftAbs = Math.abs(lumpSumEur - snapshot.lumpSum);
  const lumpDriftRel = lumpDriftAbs / Math.max(snapshot.lumpSum, 1);
  if (lumpDriftAbs >= 5000 || lumpDriftRel >= 0.2) {
    driftFields.push("lumpSum");
    hasDrift = true;
  }

  // Monthly drift
  const monthlyDriftAbs = Math.abs(monthlyVklad - snapshot.monthly);
  const monthlyDriftRel = monthlyDriftAbs / Math.max(snapshot.monthly, 1);
  if (monthlyDriftAbs >= 100 || monthlyDriftRel >= 0.2) {
    driftFields.push("monthly");
    hasDrift = true;
  }

  // Horizon drift (IGNOROVANÝ v BASIC)
  const horizonDriftAbs = Math.abs(horizonYears - snapshot.horizon);
  const horizonDriftRel = horizonDriftAbs / Math.max(snapshot.horizon, 1);

  if (modeUi === "BASIC") {
    // BASIC: Ignoruj horizon ako trigger
  } else {
    // PRO: Vyšší threshold (5 rokov alebo 25%)
    if (horizonDriftAbs >= 5 || horizonDriftRel >= 0.25) {
      driftFields.push("horizon");
      hasDrift = true;
    }
  }
}

return {
  // ... ostatné výstupy ...
  hasDrift,
  driftFields,
  canReapply,
};
```

**Prečo je drift detection problém:**

- Drift sa prepočítava v useMemo hook (useProjection.ts)
- Dependencies: `[lumpSum, monthly, horizon, goal, mixKey, debtsKey, riskPref]`
- Polling každých 100ms → nové investParams → projection prepočítanie
- `projection.hasDrift` môže fluktuovať medzi TRUE/FALSE
- ALE: early-return v auto-optimize effect zabraňuje zbytočným spusteniam

---

## 6. Diagnostika & Merania

### A) Console Logy (Pridať do kódu)

**BasicLayout.tsx (pred auto-optimize effect):**

```typescript
console.log("[AUTO-OPT DEBUG] Effect triggered", {
  stableInvestKey,
  stableCashflowKey,
  hasDrift: projection.hasDrift,
  canReapply: projection.canReapply,
  driftFields: projection.driftFields,
  snapshotAge: snapshot?.ts ? Date.now() - snapshot.ts : null,
});
```

**BasicLayout.tsx (polling intervals):**

```typescript
// V cashflow polling:
setInterval(() => {
  const v3 = readV3();
  const newData = {
    monthlyIncome: (v3.profile?.monthlyIncome as any) || 0,
    fixedExp: (v3.profile?.fixedExp as any) || 0,
    varExp: (v3.profile?.varExp as any) || 0,
  };

  // Value equality check pred setState
  if (JSON.stringify(newData) !== JSON.stringify(cashflowData)) {
    console.log("[POLLING] Cashflow changed", newData);
    setCashflowData(newData);
  }
}, 100);

// V invest polling:
setInterval(() => {
  const v3 = readV3();
  const newParams = {
    lumpSumEur: (v3.profile?.lumpSumEur as any) || 0,
    monthlyVklad: (v3 as any).monthly || 0,
    horizonYears: (v3.profile?.horizonYears as any) || 10,
    goalAssetsEur: (v3.profile?.goalAssetsEur as any) || 0,
  };

  // Value equality check pred setState
  if (JSON.stringify(newParams) !== JSON.stringify(investParams)) {
    console.log("[POLLING] InvestParams changed", newParams);
    setInvestParams(newParams);
  }
}, 100);
```

### B) Performance Profiling

**React DevTools Profiler:**

1. Otvoriť React DevTools → Profiler tab
2. Spustiť nahrávanie
3. Posúvať slider (lump sum 10k → 20k)
4. Zastaviť nahrávanie
5. Analyzovať:
   - Počet renderov BasicLayout
   - Počet renderov MixPanel
   - Počet renderov BasicSettingsPanel
   - Časové značky (každých 100ms?)

**Browser Performance:**

1. Chrome DevTools → Performance tab
2. Spustiť nahrávanie
3. Posúvať slider
4. Zastaviť nahrávanie
5. Hľadať:
   - setInterval callbacks (každých 100ms)
   - React render commits
   - localStorage.getItem calls

---

## 7. Možné Riešenia

### Riešenie 1: Optimalizovaný Polling (Value Equality Check)

**Benefit:** Jednoduché, minimálny zásah  
**Risk:** Polling stále beží každých 100ms (CPU overhead)

```typescript
// BasicLayout.tsx
React.useEffect(() => {
  const interval = setInterval(() => {
    const v3 = readV3();
    const newParams = {
      lumpSumEur: (v3.profile?.lumpSumEur as any) || 0,
      monthlyVklad: (v3 as any).monthly || 0,
      horizonYears: (v3.profile?.horizonYears as any) || 10,
      goalAssetsEur: (v3.profile?.goalAssetsEur as any) || 0,
    };

    // Porovnaj hodnoty (nie referencie)
    const changed =
      newParams.lumpSumEur !== investParams.lumpSumEur ||
      newParams.monthlyVklad !== investParams.monthlyVklad ||
      newParams.horizonYears !== investParams.horizonYears ||
      newParams.goalAssetsEur !== investParams.goalAssetsEur;

    if (changed) {
      setInvestParams(newParams);
    }
  }, 100);
  return () => clearInterval(interval);
}, [investParams]); // ← Teraz dependencies OK (len ak changed)
```

### Riešenie 2: Zvýšený Polling Interval

**Benefit:** Menej CPU overhead  
**Risk:** Pomalšia reaktivita (500ms delay)

```typescript
// Zvýš z 100ms na 500ms
setInterval(() => {
  // ... polling logika ...
}, 500); // ← Polovica záťaže
```

### Riešenie 3: useSyncExternalStore (React 18)

**Benefit:** React natívne API pre external state  
**Risk:** Vyžaduje refactor persist vrstvy

```typescript
import { useSyncExternalStore } from "react";

// persist/v3.ts
const listeners = new Set<() => void>();

export function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function getSnapshot() {
  return readV3();
}

export function writeV3(patch: Partial<V3>) {
  // ... existing logic ...
  listeners.forEach((listener) => listener());
}

// BasicLayout.tsx
const v3 = useSyncExternalStore(subscribe, getSnapshot);
const investParams = {
  lumpSumEur: (v3.profile?.lumpSumEur as any) || 0,
  monthlyVklad: (v3 as any).monthly || 0,
  horizonYears: (v3.profile?.horizonYears as any) || 10,
  goalAssetsEur: (v3.profile?.goalAssetsEur as any) || 0,
};
```

### Riešenie 4: Event-Based Sync (FAILED)

**Status:** ❌ POKUS ZLYHAL (17.11.2025)  
**Problém:** Auto-optimizer prestal fungovať úplne  
**Root cause:** Custom eventy sa neemitovali konzistentne, timing issues s React state

**Pozri:** Konverzačnú históriu (pokus o event-based sync → rollback)

### Riešenie 5: Debounce Polling (Hybrid)

**Benefit:** Kombinuje polling stabilitu + debounce efficiency  
**Risk:** Zložitejšia implementácia

```typescript
// Polling s debounce na setState
const debouncedSetInvestParams = useMemo(
  () => debounce(setInvestParams, 200),
  []
);

React.useEffect(() => {
  const interval = setInterval(() => {
    const v3 = readV3();
    const newParams = {
      /* ... */
    };

    // Debounce setState (čaká 200ms po poslednej zmene)
    debouncedSetInvestParams(newParams);
  }, 100);
  return () => clearInterval(interval);
}, []);
```

---

## 8. Odporúčania pre Advisora

### Priorita 1: Optimalizuj Polling (Value Equality)

- **Implementuj:** Riešenie 1 (value equality check)
- **Čas:** 15 min
- **Risk:** Minimálny
- **Test:** Posúvať slider rýchlo → merať počet renderov

### Priorita 2: Performance Profiling

- **Nástroj:** React DevTools Profiler + Chrome Performance
- **Merať:** Počet renderov, setInterval callbacks, localStorage reads
- **Cieľ:** Zistiť presný frekvenciu problému (100ms? 200ms?)

### Priorita 3: Zvýš Polling Interval (ak Priorita 1 nestačí)

- **Zmena:** 100ms → 300ms (3× menej záťaž)
- **Test:** UX responsiveness (prijateľné oneskorenie?)

### Priorita 4: useSyncExternalStore (ak potrebné)

- **Scope:** Refactor persist/v3.ts
- **Benefit:** React native API, žiadny polling
- **Čas:** 2-3 hodiny
- **Risk:** Zmena infra (potrebné regression testy)

### Otázky pre Advisora

1. **Polling Interval:** Je 100ms primeraný? Stačí 300ms?
2. **Value Equality:** Je JSON.stringify dostatočný? Alebo deep equal?
3. **useSyncExternalStore:** Je to worth refactor? Alebo držať polling?
4. **Drift Thresholdy:** Sú aktuálne thresholdy správne?
   - Lump sum: 5000 € alebo 20%
   - Monthly: 100 € alebo 20%
   - Horizon: IGNOROVANÉ v BASIC, 5 rokov/25% v PRO
5. **Auto-Optimize Debounce:** Je 1s dostatočný? Alebo 2s?

---

## 9. Testing Checklist

### Manuálne Testy

**Test 1: Veľký skok lump sum**

```
1. Nastav lump sum: 10000
2. Auto-optimize aplikuje preset
3. Posun slider: 10000 → 25000 (veľký skok)
4. Čakaj 1s
5. ✅ Očakávanie: Auto-optimize sa spustí (drift >= 5000)
6. ✅ UI: Plynulé, bez zaseknutia
7. ✅ Chip "Profil vyžaduje prepočítanie" zmizne
```

**Test 2: Malé kroky**

```
1. Nastav lump sum: 10000
2. Posúvaj slider pomaly: 10000 → 10100 → 10200 → ... → 11000
3. ✅ Očakávanie: Auto-optimize sa NESPUSTÍ (drift < 5000 && < 20%)
4. ✅ UI: Plynulé, žiadne odseknutia
5. ✅ Chip "Profil vyžaduje prepočítanie" ostane zobrazený
```

**Test 3: Horizont zmena (BASIC režim)**

```
1. Nastav horizon: 10 rokov
2. Posun slider: 10 → 38 rokov
3. ✅ Očakávanie: Auto-optimize sa NESPUSTÍ (horizon ignorovaný)
4. ✅ Chip "Profil vyžaduje prepočítanie" sa zobrazí
5. ✅ UI: Plynulé, bez zaseknutia
```

**Test 4: Kombinácia zmien**

```
1. Nastav: lumpSum=10000, monthly=500, horizon=10
2. Zmeni všetko naraz: lumpSum=20000, monthly=800, horizon=30
3. ✅ Očakávanie: Auto-optimize sa spustí (drift na lumpSum + monthly)
4. ✅ UI: Plynulé, jedno vykonanie (nie 3x)
5. ✅ Chip zmizne
```

### Automatické Testy (TODO)

**Test Suite: Auto-Optimize Stability**

```typescript
describe("Auto-optimize stability", () => {
  it("should not trigger on 100ms polling ticks", async () => {
    // Nastav investParams
    // Počkaj 1s
    // Assert: auto-optimize sa spustil LEN 1x (nie 10x)
  });

  it("should debounce rapid slider changes", async () => {
    // Simuluj 10 rýchlych zmien lumpSum
    // Počkaj 1s
    // Assert: auto-optimize sa spustil LEN 1x (po poslednej zmene)
  });

  it("should respect snapshot freshness guard", async () => {
    // Spusti auto-optimize
    // Hneď zmeni investParams
    // Assert: auto-optimize sa NESPUSTÍ (snapshot < 3s)
  });
});
```

---

## 10. Súvisiace Súbory

- **src/BasicLayout.tsx** (lines 330-508): Polling, auto-optimize effect
- **src/features/projection/useProjection.ts** (lines 184-211): Drift detection
- **src/features/basic/BasicSettingsPanel.tsx**: Uncontrolled inputs, writeV3 commits
- **src/persist/v3.ts**: readV3 / writeV3 API
- **src/features/mix/presets.ts**: getAdjustedPreset logika

---

## 11. Changelog

| Dátum      | Zmena                                       | Dôvod                    |
| ---------- | ------------------------------------------- | ------------------------ |
| 15.11.2025 | PR-12: Zaokrúhlený horizon, primitívne deps | FP precision noise fix   |
| 15.11.2025 | PR-12: Snapshot freshness guard (3s)        | Infinite loop protection |
| 15.11.2025 | PR-13: lastAutoOptimizeRef deduplication    | Zbytočné re-runs fix     |
| 17.11.2025 | Event-based sync pokus → ROLLBACK           | Rozbilo auto-optimizer   |
| 17.11.2025 | Tento dokument                              | Advisor konzultácia      |

---

**Záver:**

100ms polling je najväčší podozrivý. Vytvárajú sa nové objekty každých 100ms, čo spúšťa React re-rendery a dependencies triggers. Odporúčam:

1. **Hneď:** Value equality check v polling (Riešenie 1)
2. **Potom:** Performance profiling (React DevTools)
3. **Ak nedostačuje:** useSyncExternalStore refactor (Riešenie 3)

Drift detection logika a thresholdy vyzerajú OK. Auto-optimize effect guardy fungujú správne (snapshot freshness, lastAutoOptimizeRef).

**Otázka pre advisora:** Aký polling interval je optimálny? 100ms / 300ms / 500ms?
