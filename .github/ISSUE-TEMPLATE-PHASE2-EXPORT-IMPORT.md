# [Phase-2] Export/Import konfigurácie

## Kontext

Používatelia potrebujú možnosť:

- Exportovať aktuálny stav (mix, debts, profile) do JSON súboru
- Importovať predpripravenú konfiguráciu (napr. "Konzervatívny začiatočník", "Agresívny investor")
- Zdieľať konfiguráciu s agentom/poradcom (už existuje Share modal, ale len URL)

## Cieľ

Implementovať export/import funkcionalitu pre persist v3 state:

- **Export**: Button "Exportovať" → stiahne `unotop-config-{timestamp}.json`
- **Import**: Button "Importovať" → file picker → load JSON → `writeV3(parsed)`
- **Validácia**: Import kontroluje schému (`Debt[]`, `MixItem[]`, `Profile`)
- **Presets**: 3 predpripravené konfigurácie (dropdown alebo karty)

## Akceptačné kritériá

- [ ] Export button v sec1 alebo header → stiahne JSON súbor
- [ ] Import button → file picker → load + validate + apply
- [ ] Validácia schémy: ignoruj neznáme kľúče, vyžaduj povinné (`debts`, `mix`, `profile`)
- [ ] Error handling: ak JSON invalid → toast/alert "Neplatný formát súboru"
- [ ] Presets (voliteľné):
  - "Konzervatívny začiatočník" (gold 15%, bonds 20%, cash 20%, etf 45%)
  - "Vyvážený investor" (gold 12%, dyn 10%, etf 50%, bonds 20%, cash 8%)
  - "Agresívny rastový" (dyn 15%, etf 60%, crypto 5%, gold 10%, cash 10%)
- [ ] A11y: buttons s `aria-label`, file input s label

## Súbory na úpravu

- `src/LegacyApp.tsx` – pridať export/import buttons do sec1 alebo header
- Nové súbory:
  - `src/utils/exportConfig.ts` – `exportToJson(state: V3): void`
  - `src/utils/importConfig.ts` – `importFromJson(file: File): Promise<V3>`
  - `src/utils/validateV3Schema.ts` – `validateV3(data: unknown): V3 | null`
  - `src/presets/` – JSON súbory s presetmi (alebo TS constants)

## Odhadovaný čas

~3-4 hodiny (export/import logic, validácia, presets, UI)

## Priorita

**Low** – nice-to-have feature, nie critical pre MVP.

## Závislosti

- Phase-1 merge (persist v3 stabilné)
- Share modal existuje (možno pridať tab "Import/Export" tam?)

## Dizajn notes

### Export flow

1. User klikne "Exportovať"
2. Browser stiahne `unotop-config-2025-10-20-14-30.json`
3. Toast: "Konfigurácia exportovaná ✓"

### Import flow

1. User klikne "Importovať"
2. File picker (accept=".json")
3. Validácia: `validateV3Schema(parsed)`
4. Ak OK: `writeV3(parsed)` → toast "Konfigurácia načítaná ✓"
5. Ak NOK: alert "Neplatný formát súboru. Skontrolujte JSON štruktúru."

### Presets UI

- Dropdown v header: "Načítať preset" → 3 možnosti
- Alebo karty v sec1: 3 karty s preview (gold %, dyn %, risk score)
- Po kliknutí: confirm dialog "Prepísať aktuálne nastavenia?" → Áno/Nie

### JSON formát (export example)

```json
{
  "version": "v3",
  "timestamp": "2025-10-20T14:30:00Z",
  "debts": [
    {
      "id": "d1",
      "name": "Hypotéka",
      "principal": 80000,
      "ratePa": 3.5,
      "monthly": 450,
      "monthsLeft": 240
    }
  ],
  "mix": [
    { "key": "gold", "pct": 12 },
    { "key": "dyn", "pct": 10 },
    { "key": "etf", "pct": 50 },
    { "key": "bonds", "pct": 20 },
    { "key": "cash", "pct": 8 }
  ],
  "profile": {
    "monthlyIncome": 2500,
    "reserveEur": 5000,
    "reserveMonths": 6,
    "riskMode": "current",
    "modeUi": "BASIC",
    "lumpSumEur": 10000,
    "monthlyVklad": 500,
    "horizonYears": 20,
    "goalAssetsEur": 150000
  }
}
```

## Test IDs (doplniť)

- `EXPORT_BTN`, `IMPORT_BTN`, `PRESET_DROPDOWN`, `PRESET_CARD`
- Pridať do `src/constants/testIds.ts`

## Testy (nové)

- `tests/export-import.test.tsx`:
  - Export → stiahne JSON → parsuj → očakávané keys
  - Import → mock file → writeV3 called s correct data
  - Invalid JSON → error handling
  - Preset load → writeV3 called s preset data

---

**Labels:** `enhancement`, `phase-2`, `export`, `import`, `presets`
