# [Phase-2] Debt UI (rozšírené)

## Kontext

V Phase-1 (BASIC režim) je implementované iba tlačidlo "Pridať dlh" bez expanded debt management UI. Tým pádom 9 testov z `tests/ui.debts.*.test.tsx` očakávane failuje.

## Cieľ

Implementovať rozšírené debt management v BASIC režime:

- Tabuľka dlhov (Názov, Zostatok, Úrok p.a., Splátka, Zostáva mesiacov)
- Form na pridanie dlhu (Typ, Názov, Zostatok, Úrok, Splátka, Zostáva)
- Akcia Zmazať pre každý riadok
- Labely unikátne (1. bez prípony, ďalšie "#2", "#3"...)
- Persist do `debts` array v v3

## Akceptačné kritériá

- [ ] 9/9 debt UI testov PASS:
  - `tests/ui.debts.a11y.test.tsx`
  - `tests/ui.debts.kpi-and-reason.test.tsx`
  - `tests/ui.debt.crossover.test.tsx`
  - `tests/ui.debt.vs.invest.chart.test.tsx`
- [ ] Form validácia (min/max, required fields)
- [ ] Unikátne labely pre riadky (#1, #2, #3)
- [ ] Persist: `writeV3({ debts })` po každej zmene
- [ ] A11y: `role="table"`, `aria-label`, focus management

## Súbory na úpravu

- `src/LegacyApp.tsx` – pridať sec dlhov (BASIC režim)
- `src/persist/v3.ts` – typ `Debt` už existuje, len použiť
- `tests/ui.debts.*.test.tsx` – skontrolovať po implementácii

## Odhadovaný čas

~3-4 hodiny (form + table + persist + tests)

## Priorita

**Medium** – BASIC režim je funkčný bez tohto, ale PRO potrebuje expanded view.

## Závislosti

- Žiadne – môže byť implementované ihneď po merge Phase-1 PR.

## Test IDs (použiť existujúce)

Z `src/constants/testIds.ts`:

- Asi budú potrebné nové: `DEBT_FORM`, `DEBT_TABLE`, `DEBT_ROW`, `DEBT_DELETE_BTN`
- Pridať do `testIds.ts` pred implementáciou

## Dizajn notes

- Dark theme (ako všetky panely)
- Tabuľka: `rounded-2xl p-4 shadow-sm` (rovnako ako iné karty)
- Form: inline alebo modal? (TBD podľa UX preferencie)
- Validácia: inline error messages (červený text pod poľom)

---

**Labels:** `enhancement`, `phase-2`, `debt-ui`, `basic-mode`
