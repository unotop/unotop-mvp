# Copilot Instructions – UNOTOP MVP

> Cieľ: Pomôcť AI agentom robiť malé, bezpečné, konzistentné zmeny bez dlhého čítania celého repozitára.

## UNOTOP MVP — pokyny pre AI agenta (rozšírenie)

**Cieľ:** Buď okamžite produktívny v React/TS codebase UNOTOP (investičný plánovač). Priorita: Legacy model = default, Current model = BETA (auditované). UI má byť „banking-grade“, 2‑stĺpcový layout so sticky pravým panelom (nesmie spadnúť pod ľavý ani pri zmenšovaní šírky).

### Rýchly štart

- Node 20, npm 10. Inštalácia: `npm ci`
- Dev: `npm run dev` / Build: `npm run build` / Testy: `npm run test`
- Ak PowerShell blokuje skripty: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`

### Kľúčové súbory / moduly

- Hlavný tok: `src/App.tsx` (produkcia), `src/App.clean.tsx` (sandbox/test), `src/LegacyApp.tsx` (legacy parity testy)
- Doména dlhov: `src/domain/amortization.ts` (`buildAmortSchedule`, `negativeAmort`)
- Selektory portfólia: `src/selectors/portfolio.ts` (`selectPortfolioFVOverTime`, `firstCrossoverIndex`)
- Sekcia porovnania dlhy vs investície: `src/ui/DebtVsInvestSection.tsx` (Recharts – 2 línie + marker prelomu)
- Formátovanie: `formatMoneySk`, `formatPercentPa` (pozri util / format súbory)

### UX zásady

- BASIC vs PRO: BASIC skrýva „Krízový bias“; PRO ho zobrazuje (neskrývať v PRO).
- Poradie: „Metriky & odporúčania“ nad „Projekciou“; tlačidlo „Graf“ je v hlavičke sekcie Projekcia.
- Terminológia: používať „Zloženie portfólia“ (nie skráteniny), nečíslovať sekcie.
- Risk Gauge: polkruh, pevná hrúbka oblúka, číslo pod – zachovať vzhľad.
- CTA texty: „Odporúčané nastavenie“, „Zistiť maximum (výnos/riziko)“ – po akcii auto-scroll k potvrdeniu.

### Biznis pravidlá (policy)

- Rezerva pred investovaním; normalizácia mixu vždy na 100 %.
- Gold (Zlato) min 10 % (legacy ethos).
- Crypto strop BASIC 3–7 %, PRO 8–10 %; dyn + crypto ≤ 22 % (legacy limit) – Current BETA má vlastné penalizácie nad 45 %.
- Cieľový risk/horizon – Legacy rozhodujúci pre konzistenciu testov (Current označené BETA).

### Testové vzory

- `tests/parity.golden.test.ts` – golden scenáre (riziko & návratnosť staying consistent)
- `tests/amortization.parity.test.ts` – splátkové tabuľky konzistencia
- `tests/ui.debt.vs.invest.chart.test.ts` – 2 línie + crossover marker
- Layout testy chránia sticky pravý panel (žiadny „biely gap“)

### Vzorové task postupy

- Nový slider aktíva: kopíruj existujúci pattern (range + number), aktualizuj mix normalizáciu, riziko & KPI; pridaj test.
- Oprava layoutu: uprav grid (hlavné 2 stĺpce + sticky pravý), testuj 320–1440 px.
- Odporúčanie „Max bezpečný mix“: aplikuj policy limity (rezerva, crypto/dyn stropy), vypočítaj návrh, zobraz diff a auto-scroll.

### Konvencie & technológie

- Tailwind utility + shadcn/ui komponenty, grafy cez Recharts, ikony lucide-react.
- Selektory čisté pure funkcie; žiadne side‑effects.
- Legacy výpočty neupravuj bez parity testov; Current zmeny schovaj za audit/feature flag.
- Testy preferujú stabilné `data-testid` (TEST_IDS) namiesto textových labelov kvôli i18n a zamedzeniu kolízií.

### Mimo scope (neimplementuj v rámci drobných patchov)

- Mix A/B porovnávač, coach panel, animované scenáre.

---

## Architektúra v skratke

- Build stack: React 19 + TypeScript + Vite + Vitest.
- Dva režimy rizika / výpočtov: Legacy vs Current (pozri `src/domain/*`). Current model je v BETA; dokumentácia v `docs/spec-current-v1.md`.
- Prezentácia: Jedna hlavná aplikácia (`src/App.tsx`) + testový čistý povrch (`src/App.clean.tsx`) + `LegacyApp.tsx` pre spätnú kompatibilitu testov.
- Doménové moduly:
  - `src/domain/assets.ts` (datasety aktív, default mixy)
  - `src/domain/risk.ts` (computeRisk pre Current + Legacy varianty/prvky)
  - `src/domain/optimizer.ts` (brute-force enumerácia s krokovým percentom)
  - `src/domain/finance.ts` (FV, rounding)
  - `src/domain/recommendation.ts` (heuristiky)
- Persistencia: multi-key localStorage (priorita `unotop:v3`, alias `unotop_v3`, fallback `unotop_v1`). Test-only stubs v `App.clean.tsx` zapisujú okamžite (bez debouncu) pre deterministické testy.

## Kľúčové konvencie

- Nikdy needituj `src/App.tsx`, ak task chce “clean” test povrch – použij `App.clean.tsx` alebo `LegacyApp.tsx` podľa testu.
- Test-only komponenty sú skryté cez `className="sr-only"` a podmienku `IS_TEST` (`process.env.NODE_ENV === 'test'`).
- Pravidlá mixu / invarianty: normalizácia sumy na 100%, limity (Gold ≥10%, Dyn ≤30% v Current optimizéri), koncentrácia penalizovaná cez HHI. Nepriateľ duplicít v aria-label (a11y testy sú striktné).
- ETF naming: slider `aria-label="ETF (svet – aktívne)"`; number input používa odlišný názov (napr. `... percentá`) ak treba predísť kolízii.
- Persist stub pattern: 1) lazy readAll (RAM mirror → shadow keys → v1 → v3 colon → v3 underscore) 2) micro rehydrate (layout effect) 3) okamžitý zápis do RAM mirror + shadow + v3 + v1 pri každom onInput/onChange.

## Testy & workflow

- Spustenie všetkých testov: `npm run test` (predtým script čistí cache: `test:clean`).
- Selektívny test: `npm run test -t "názov"` (Vitest). Regexy v testoch často používajú `findByLabelText` → pri úpravách udrž presné reťazce.
- Dôležité testové súbory v `tests/`:
  - persist.\* (roundtrip, load-save)
  - mix-invariants.\* (tlačidlá "Upraviť podľa pravidiel" / "Resetovať hodnoty")
  - ui.\* (a11y + vizuálne invarianty)
- Ak pridávaš nový test-only input: označ `sr-only` a unikátny `aria-label`.

## Persistencia – detail

- Smer: všetky zápisy musia zrkadliť v3 aj v1 (kvôli roundtrip testom) + shadow kľúče pre rýchlu re-hydratáciu druhého mountu.
- Reset logika: selektívne `removeItem` len cieľových kľúčov (nie `localStorage.clear()`).
- Hydratácia: neblokujúce – čítanie synchronne pri mount-e, doplnené micro rehydrate ak prázdny init.

## A11y & UI

- Žiadne duplikované accessible names pre prvky ktoré testy lovia; ak slider a number reprezentujú rovnakú entitu, použij prefix/suffix.
- Live oblasti: používaj `aria-live="polite"` pre statusy (napr. baseline pripravený).
- V test-only stubs minimalizuj vizuálny šum; miešanie real UI a stub musí byť deterministické.

## Optimalizátor & riziko (zhrnutie pre rýchle úpravy)

- `computeRisk` skladá: weighted base + overweightPenalty (prahové >35%) + concentrationPenalty (HHI>0.18) + dynamicSurcharge (dyn+crypto>45%) → clamp 10.
- Skóre Current: `expectedReturn / riskRaw`; Legacy odlišný vzorec (pozri kód pri potrebe parity).
- Ak meníš tabuľku aktív, aktualizuj aj dokumenty v `docs/` ak meníš semantiku (nie len hodnoty).

## Štýl & kvalita

- Použi ESLint/Prettier – nepíš vlastné formátovacie hacky.
- Malé PR: zachovaj spätnú kompatibilitu testov; ak meníš aria-label, uprav alebo vysvetli test.
- Conventional commits: `feat:`, `fix:`, `refactor:` atď.

## Bežné chyby (čomu sa vyhnúť)

- Duplicitné `aria-label` pre "Mesačný príjem" alebo ETF – rozbije `findByLabelText`.
- Zápis len do jedného storage kľúča → zlyhá roundtrip test.
- Debounce pri persist stube → race v load-save teste.
- Mazanie všetkých položiek localStorage → test reset branch FAIL.

## Rýchle referencie

- Storage keys: `unotop:v3`, `unotop_v3`, `unotop_v1`, shadow: `unotop:shadow:income`, `unotop:shadow:fixed`.
- Test root komponent: `App.clean.tsx` (hľadá sa podľa `aria-label="UNO clean root"`).
- Invariants action bar: tlačidlá presne "Upraviť podľa pravidiel", "Resetovať hodnoty" + status texty "upravené podľa pravidiel" / "Žiadne úpravy.".

## Ako postupovať pri novom feature

1. Pridaj doménovú funkciu do `src/domain/*` (čistá, bez UI side-efektov).
2. UI komponent v `src/components` + napojenie v `App.clean.tsx` (ak test-driven) alebo v `App.tsx` (produkčný povrch) bez rušenia existujúcich aria-label.
3. Persist (ak treba) – zrkadli v1 + v3 + shadow, okamžitý zápis.
4. Napíš selektívny test v `tests/` s query by role/label.

---

Ak potrebuješ doplniť špecifiká k dlhovému CRUD modulu alebo deep-link state serializácii (hash state=...), vyžiadaj doplnenie.
