# UNOTOP MVP - Kompletný Kód Snapshot (Časť 1: Core & Persist)

**Dátum:** 25. október 2025  
**Účel:** Prehľad celej aplikácie pre AI advisor  
**Stav:** Funkčná verzia po Phase 1 (BASIC režim)

---

## 1. PERSIST VRSTVA (Jediný zdroj pravdy)

### src/persist/v3.ts

```typescript
// src/persist/v3.ts
import { emitMixChangeEvent } from "./mixEvents";

export type Debt = {
  id: string;
  name: string;
  principal: number;
  ratePa: number;
  monthly: number;
  monthsLeft?: number;
  remaining?: number;
  extraMonthly?: number; // mimoriadna splátka (mesačná, ide na istinu)
};
export type MixItem = { key: string; pct: number };
export type Profile = {
  monthlyIncome?: number;
  reserveEur?: number;
  reserveMonths?: number;
  riskMode?: "legacy" | "current";
  modeUi?: "BASIC" | "PRO";
  clientType?: "individual" | "family" | "firm";
  riskPref?: string;
  crisisBias?: number;
  lumpSumEur?: number;
  horizonYears?: number;
  goalAssetsEur?: number;
  fixedExp?: number;
  varExp?: number;
  currentReserve?: number;
  emergencyMonths?: number;
};

export type V3 = Partial<{
  debts: Debt[];
  mix: MixItem[];
  profile: Profile;
  // back-compat top-level mirrors (tests may read these directly)
  monthlyIncome: number;
  monthly: number; // mirror for monthlyVklad
  reserveEur: number;
  reserveMonths: number;
  riskMode: "legacy" | "current";
  modeUi: "BASIC" | "PRO";
  riskPref: string; // legacy tests
  crisisBias: number; // legacy tests
}>;

const KEY_V3_COLON = "unotop:v3";
const KEY_V3_UNDERSCORE = "unotop_v3";

function safeParse<T>(s: string | null): T | null {
  try {
    return s ? (JSON.parse(s) as T) : null;
  } catch {
    return null;
  }
}

export function readV3(): V3 {
  return (
    safeParse<V3>(localStorage.getItem(KEY_V3_COLON)) ??
    safeParse<V3>(localStorage.getItem(KEY_V3_UNDERSCORE)) ??
    {}
  );
}

export function writeV3(patch: Partial<V3>): V3 {
  const cur = readV3();
  const next: V3 = { ...cur, ...patch };
  // ensure version marker for tests expecting version===3
  (next as any).version = 3;

  if (patch.profile) {
    const p = patch.profile as Profile;
    if (typeof p.monthlyIncome === "number")
      next.monthlyIncome = p.monthlyIncome;
    if (typeof p.reserveEur === "number") next.reserveEur = p.reserveEur;
    if (typeof p.reserveMonths === "number")
      next.reserveMonths = p.reserveMonths;
    if (p.riskMode) next.riskMode = p.riskMode;
    if (p.modeUi) next.modeUi = p.modeUi;
    if (p.riskPref) next.riskPref = p.riskPref;
    if (typeof p.crisisBias === "number") next.crisisBias = p.crisisBias;
    // legacy alias mirrors (tests still read these)
    if (typeof p.reserveEur === "number")
      (next as any).current_reserve = p.reserveEur;
    if (typeof p.reserveMonths === "number")
      (next as any).emergency_months = p.reserveMonths;
  }

  const json = JSON.stringify(next);
  try {
    localStorage.setItem(KEY_V3_COLON, json);
    localStorage.setItem(KEY_V3_UNDERSCORE, json);
  } catch {}

  // Emit event if mix changed (for event-based sync)
  if (patch.mix) {
    emitMixChangeEvent();
  }

  return next;
}
```

### src/persist/mixEvents.ts

```typescript
// src/persist/mixEvents.ts
// Event-based mix synchronization (replaces polling)

const MIX_CHANGE_EVENT = "unotop:mixChange";

export function emitMixChangeEvent() {
  window.dispatchEvent(new CustomEvent(MIX_CHANGE_EVENT));
}

export function createMixListener(callback: (mix: any[]) => void) {
  const handler = () => {
    try {
      const raw =
        localStorage.getItem("unotop:v3") || localStorage.getItem("unotop_v3");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.mix)) {
          callback(parsed.mix);
        }
      }
    } catch {}
  };

  window.addEventListener(MIX_CHANGE_EVENT, handler);
  return () => window.removeEventListener(MIX_CHANGE_EVENT, handler);
}
```

---

## 2. TEST IDS (Centrálna evidencia)

### src/testIds.ts

```typescript
// Central TEST_IDS podľa TOP TIER PROMPT
export const TEST_IDS = {
  ROOT: "clean-root",
  INSIGHTS_WRAP: "insights-wrap",
  GOLD_SLIDER: "slider-gold",
  GOLD_INPUT: "input-gold-number",
  MONTHLY_SLIDER: "slider-monthly",
  CHIPS_STRIP: "scenario-chips",
  SCENARIO_CHIP: "scenario-chip",
  WIZARD_DIALOG: "mini-wizard-dialog",
  WIZARD_ACTION_APPLY: "wizard-apply",
  DEEPLINK_BANNER: "deeplink-banner",
} as const;

export type TestIdKey = keyof typeof TEST_IDS;
```

---

## 3. ENGINE (Výpočty)

### src/engine/calculations.ts

```typescript
/**
 * Core Business Logic - Unified Calculation Functions
 *
 * Centrálne výpočty pre investície.
 * Yield a risk scoring sú v features/mix/assetModel.ts (zachované kvôli komplexnej logike).
 */

/**
 * Vypočítaj budúcu hodnotu investície s mesačnou kapitalizáciou
 *
 * Formula: FV = P0 * (1+r)^Y + PM * 12 * ((1+r)^Y - 1) / r
 *
 * @param lumpSum - Jednorazová investícia (EUR)
 * @param monthlyContribution - Mesačný vklad (EUR)
 * @param years - Investičný horizont (roky)
 * @param annualRate - Anualizovaný výnos (decimal, napr. 0.07 = 7%)
 * @returns Budúca hodnota investície (EUR)
 */
export function calculateFutureValue(
  lumpSum: number,
  monthlyContribution: number,
  years: number,
  annualRate: number
): number {
  if (years <= 0) return lumpSum;

  // Počet mesiacov
  const months = Math.round(years * 12);

  // Mesačná sadzba: (1 + r_annual)^(1/12) - 1
  const monthlyRate = annualRate > 0 ? Math.pow(1 + annualRate, 1 / 12) - 1 : 0;

  // Iteratívny výpočet (presnejší pre mesačnú kapitalizáciu)
  let value = lumpSum;
  for (let month = 1; month <= months; month++) {
    value = (value + monthlyContribution) * (1 + monthlyRate);
  }

  return value;
}
```

---

## 4. LAYOUT (Stabilná kostra)

### src/app/PageLayout.tsx

```tsx
import React from "react";

// Sticky layout wrapper – jediný zdroj pravdy pre dvojstĺpcové rozloženie.
// Pravidlá:
// - Pravý panel je sticky cez vnútorný <div className="sticky top-4">.
// - max-h-[calc(100vh-5rem)] = výška obrazovky mínus toolbar (4rem) + spacing (1rem)
// - overflow-y-auto = vlastný scrollbar ak obsah preteká
// - Panely samotné NESMÚ pridávať sticky.

export default function PageLayout({
  left,
  right,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <div
      className="grid grid-cols-12 gap-4 px-4 py-4 max-w-[1320px] mx-auto"
      data-testid="layout-root"
    >
      <main className="col-span-12 lg:col-span-8 space-y-4">{left}</main>
      <aside
        role="complementary"
        aria-label="Prehľad"
        className="col-span-12 lg:col-span-4 space-y-4"
      >
        <div className="sticky top-4 flex flex-col gap-4 max-h-[calc(100vh-5rem)] overflow-y-auto">
          {right}
        </div>
      </aside>
    </div>
  );
}
```

---

**Pokračovanie v časti 2...**
