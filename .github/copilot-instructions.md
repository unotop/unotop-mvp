<!-- TOP TIER PROMPT (Legacy UI na stabilnej kostre) -->

UNOTOP MVP — TOP TIER PROMPT (Legacy UI na stabilnej kostre)
Tento brief je jediný zdroj pravdy pre ďalší vývoj. Všetci (ja, ty, GH) programujeme presne podľa neho.
Cieľ: atraktívna, interaktívna verzia (BASIC) + pokročilá verzia (PRO) na robustnej infra (persist v3, fokusy, deeplink, testy).

---

1. Vízia & režimy
   • BASIC (default)
   o „Herný“ zážitok: krátke kroky, jasné CTA, okamžitá odozva (chips, mini-wizard, micro-animácie).
   o Minimum polí, vedenie používateľa: „Sprav rezervu“, „Nastav mesačný vklad“, „Vylepši stabilitu (zlato)“.
   o Odporúčania 1-klik (Apply). Žiadne tabuľky naviac.
   o Vizuálne čisté (má ťa to baviť ťahať slidermi).
   • PRO (prepínač v hlavičke: BASIC / PRO)
   o Odomkne pokročilé nastavenia (viac polí, jemnejšia kontrola, export/import atď.).
   o Ručné zásahy bez obmedzení, viac metrík, viac grafov.
   o Všetko z BASIC + navyše.
   Režimy zdieľajú rovnaké úložisko stavu (persist v3). Prepínač nemení dáta, len UI úroveň.

---

2. Architektúra (súbory & vrstvy)
   • src/LegacyApp.tsx – hlavná obrazovka (obsahuje BASIC aj PRO panely; PRO časti sú conditionally rendered).
   • src/main.tsx – mount root. V testoch bez StrictMode, v dev/prod so StrictMode.
   • src/persist/v3.ts – jediná perzistentná vrstva (readV3 / writeV3) – viď detaily.
   • src/testIds.ts – centrálna evidencia TEST_IDS.
   • src/components/\* – logické celky: DebtsTable, MixPanel, ReserveWizard, ShareModal, DeepLinkBanner, ChipsStrip, MetricsPanel, ProjectionCard.

---

3. Údaje & perzistencia v3 (zdroj pravdy)
   Kľúče: unotop:v3 (primárny) a unotop_v3 (alias, vždy synchronizovaný).
   Typy:
   type Debt = { id: string; name: string; principal: number; ratePa: number; monthly: number; monthsLeft?: number };
   type MixItem = { key: 'gold'|'dyn'|'etf'|'bonds'|'cash'|'crypto'|'real'|'other'; pct: number };
   type Profile = {
   monthlyIncome: number; reserveEur: number; reserveMonths: number;
   riskMode: 'legacy'|'current'; modeUi: 'BASIC'|'PRO'
   };
   type V3 = Partial<{
   debts: Debt[]; mix: MixItem[]; profile: Profile;
   // spätná kompatibilita – mirror na top-level
   monthlyIncome:number; reserveEur:number; reserveMonths:number; riskMode:Profile['riskMode'];
   }>;
   API:
   • readV3(): V3 – načítaj colon → underscore → {}.
   • writeV3(patch: Partial<V3>): V3 – merge s existujúcim, zapíš do oboch kľúčov; ak prichádza profile, zrkadli vybrané polia aj na top-level (kvôli starším testom).
   • Hydration guard: prvý useEffect persist ignoruj (po mount-e nastav flag hydratedRef), aby defaulty neprebili vstup.
   • Test env: NODE_ENV==='test' → render bez StrictMode (zabraňuje double-mountu).

---

4. UI rozloženie (BASIC vs PRO)
   4.1 Nadstavba (zostáva rovnaká v oboch režimoch)
   • Horný step-bar: 1) Cashflow & rezerva 2) Investičné nastavenia 3) Zloženie portfólia 4) Metriky & odporúčania.
   • Pravý stĺpec: Projekcia (graf) + Metriky & odporúčania (karty s textami).
   • Prepínač: BASIC / PRO (ukladá sa do profile.modeUi).
   • Prepínač rizika: Legacy / Current (aria-pressed, zapisuje do profile.riskMode).
   4.2 Panely
   A) Cashflow & rezerva (BASIC aj PRO)
   Polia:
   • Mesačný príjem, Fixné výdavky, Variabilné výdavky (PRO môže zobraziť ešte „iné“/detail).
   • Súčasná rezerva (EUR), Rezerva (mesiace).
   • Mesačný vklad – slider (+ zobrazenie hodnoty).
   Odporúčanie (BASIC):
   • „Rezervu doplň“ – zobraziť, ak reserveEur < 1000 || reserveMonths < 6.
   • Po Apply: nastav aspoň minimum (EUR a mesiace), prípadne zvýš monthly na baseline (napr. min 300), fokus na Mesačný vklad – slider.
   • Vygeneruj chip „Rezerva dorovnaná“.
   B) Investičné nastavenia (BASIC aj PRO)
   • Jednorazová investícia, Mesačný vklad (číselný), Horizont (roky), Cieľ majetku (€).
   • BASIC: zobraziť len slider mesačného vkladu a horizont + tooltip k cieľu.
   • PRO: všetky polia + validácie.
   C) Zloženie portfólia (BASIC: stručné 3–4 páky, PRO: plné)
   • BASIC:
   o Slidery: Zlato (fyzické), Dynamické riadenie, ETF (svet – aktívne), Krypto (ostatné sú skryté alebo agregované).
   o Insight: „Vylepši stabilitu (zlato)“.
    Nie je fixne 12 %. Vypočítaj cieľové pásmo podľa režimu rizika a mixu:
    default min pre stabilitu = 12 % (kvôli testom a spätným metrikám), ale BASIC copy znie:
   „Navýš zlato na odporúčanú úroveň“ (percento zobraz do tlačidla: „Gold 12 % (odporúčanie)“).
    Po Apply: setGoldTarget(mix, minGold) → persist → chip „Zlato dorovnané“ → fokus na gold slider.
    Poznámka: Text je herne motivačný, ale správanie ostáva kompatibilné s testami.
   o CTA: Dorovnať (normalize na 100 %).
   • PRO:
   o Plné pole sliderov/čísel: Zlato, Dyn. riadenie, ETF, Garantovaný dlhopis, Hotovosť/rezerva, Krypto, Reality, Ostatné.
   o Upraviť podľa pravidiel (apply mix constraints) – generuje status chips („Dyn+Krypto obmedzené“, „Súčet dorovnaný“…).
   o Export/Import, Optimalizuj (placeholder alebo existujúci algoritmus).
   D) Dlhy & hypotéky (MVP, PRO prominentné, BASIC zjednodušené)
   • Form na pridanie: Typ, Názov, Zostatok, Úrok p.a., Splátka, Zostáva (m).
   • Tabuľka: Názov, Zostatok, Úrok p.a., Splátka, Zostáva mesiacov + Akcia Zmazať.
   • Labely sú unikátne (riadok #1 bez prípony, ďalšie „#2“, „#3“…).
   • Persist: na každú zmenu writeV3({ debts }).
   E) Metriky & odporúčania (BASIC aj PRO)
   • Scorecards: Výnos/rok, Riziko, Pílenie cieľa, stručné bullets „Čo urobiť ďalej“.
   • Chips (vo viditeľnom DOM, nie sr-only):
   o „Zlato dorovnané“ (ak zlato >= minGold),
   o „Dyn+Krypto obmedzené“ (ak dyn+krypto > 22),
   o „Súčet dorovnaný“ (|sum−100| < 0.01),
   o voliteľne „Rezerva dorovnaná“.
   F) Projekcia (pravý panel)
   • Jednoduchý graf rastu (placeholder OK).

---

5. Odporúčania & wizardy
   • Komponent ReserveWizard a GoldWizard (alebo jediný generický wizard s obsahom podľa „cardy“).
   • Otvára sa cez tlačidlá v Insights („Rezervu doplň“, „Gold 12 % (odporúčanie)“).
   • Dialog: role="dialog", aria-modal="true", Esc zatvorí, fokus sa vráti na spúšťacie tlačidlo.
   • Po Apply:
   o Rezerva: doplň minimá + nastav monthly baseline → fokus na Mesačný vklad – slider.
   o Zlato: setGoldTarget(mix, minGold) → fokus na Gold slider.
   • Wizard sa UNMOUNTUJE po zatvorení (nie hidden).

---

6. Deep-link banner
   • Render úplne hore pred <main>. data-testid="deeplink-banner".
   • Pri location.hash s #state=... skús: URL-decode → JSON.parse; ak zlyhá, skús atob → JSON.parse; ak nič, ignoruj.
   • Aplikuj writeV3(payload).
   • Hash nečisti hneď – až po zobrazení/kliknutí „Zavrieť“:
   history.replaceState(null, '', location.pathname + location.search).

---

7. A11y & fokus – pevné pravidlá
   • Modaly: role="dialog", aria-modal="true", Esc zavrie, fokus sa vráti.
   • Risk prepínače: aria-pressed (true/false).
   • Mesačný vklad – slider: element, na ktorý padne fokus po Rezerva Apply (v testoch určujeme data-testid).
   • Gold slider: fokus po Gold Apply.
   • Žiadne kľúčové texty len v sr-only.
   • V JSDOM testoch používať data-testid tam, kde je type="range" (stabilita).

---

8. TEST_IDS (používaj konzistentne)
   ROOT='clean-root'
   INSIGHTS_WRAP='insights-wrap'
   GOLD_SLIDER='slider-gold'
   GOLD_INPUT='input-gold-number'
   MONTHLY_SLIDER='slider-monthly'
   CHIPS_STRIP='scenario-chips'
   SCENARIO_CHIP='scenario-chip'
   WIZARD_DIALOG='mini-wizard-dialog'
   WIZARD_ACTION_APPLY='wizard-apply'
   DEEPLINK_BANNER='deeplink-banner'

---

9. Pravidlá mixu
   • normalize(list) – presne 100 % (2 des. miesta).
   • Drift: ručné zásahy nenormalizuj okamžite; zobraziť chip „Súčet X %“ (voliteľne), CTA Dorovnať to vyrieši.
   • setGoldTarget(list, target) – nastav gold = target, zvyšok redistribuuj proporcionálne → normalize().

---

10. Štýl & UX
    • Dark theme, vzdušné karty, oblásť 12–16 px, jemné tieňe, micro-animácie (napr. pulse na slider po Apply).
    • Jazyk: SK (krátke jasné copy).
    • V BASIC má baviť ťahať – menej textu, viac „aha“ momentov.
    • V PRO presnosť – presné hodnoty, editor mixu, export/import.

---

11. Akceptačné kritériá (musí prejsť)
    • Persist: persist.load-save, persist.debts.v3, persist.profile.v3, persist.roundtrip.
    • Wizardy: ui.wizard.reserve (fokus po apply).
    • Mix & limity: invariants.limits (chips texty).
    • A11y: accessibility.ui (Share modal: autofocus na „Email agenta“, Esc close + return focus).
    • Deeplink: deeplink.banner (banner visible pri hashi, po close hash preč).

---

12. Implementačný postup (striktné poradie)

1) persist/v3.ts + testIds.ts (ak ešte nie sú).
2) LegacyApp: BASIC panely + insights (Rezerva/Gold), chips, Dorovnať.
3) Share modal + Deeplink banner.
4) PRO panely (rozšírenia), export/import.
5) A11y edge cases, fokusy.
6) Selektívne testy → full suite → build.

---

13. Poznámky k „Gold 12 %“
    • BASIC copy: „Gold 12 % (odporúčanie)“ – game-like guidance.
    • Logika: minGold = 12 (default; v PRO konfigurovateľné), Apply → setGoldTarget(mix, minGold).
    Zmysel: stabilita portfólia pre nováčikov; nie je to dogma, v PRO môže užívateľ nastaviť manuálne.

Dodatok: Stabilná a ľahko upraviteľná architektúra

1. Štruktúra projektu (nemeniť bez dôvodu)
   src/
   app/
   PageLayout.tsx // layout kontrakt (ľavý obsah + pravý sticky)
   routes.tsx // (ak máme router), BASIC/PRO prepínač
   features/
   mix/
   MixPanel.tsx // vizuál
   mix.service.ts // čistá logika (normalize, setGoldTarget)
   mix.config.ts // definícia sliderov/percent, ID, poradia
   reserve/
   ReservePanel.tsx
   ReserveWizard.tsx
   reserve.service.ts
   debts/
   DebtsPanel.tsx
   debts.service.ts
   metrics/
   MetricsPanel.tsx
   projection/
   ProjectionCard.tsx
   share/
   ShareButton.tsx
   ShareModal.tsx
   deeplink/
   DeepLinkBanner.tsx
   persist/
   v3.ts // readV3 / writeV3 – jediný dotyk s localStorage
   ui/
   Buttons.tsx, Inputs.tsx, Chips.tsx, Dialog.tsx
   testIds.ts
   main.tsx
   Pravidlo: komponenty UI nikdy nepíšu priamo do localStorage. Všetko ide cez persist/v3.ts alebo \*.service.ts.

---

2. Stabilný layout (pravý panel vždy sticky)
   Jediné miesto, kde sa rieši lepenie pravého panelu: PageLayout.tsx.
   // app/PageLayout.tsx
   export default function PageLayout({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
   return (
   <div className="grid grid-cols-12 gap-4 px-4 py-4 max-w-[1320px] mx-auto">
   <main className="col-span-12 lg:col-span-8 space-y-4">{left}</main>
   <aside className="col-span-12 lg:col-span-4 space-y-4">
   <div className="sticky top-4 flex flex-col gap-4">{right}</div>
   </aside>
   </div>
   );
   }
   • Nikdy nevkladať sticky štýly do panelov; len do PageLayout.
   • Všetky stránky/hlavný root používajú:
   <PageLayout left={<LeftStack />} right={<RightStack />} />
   → Presun panelu = zmena poradia v LeftStack/RightStack, nie CSS.

---

3. CTA & tlačidlá – „registry pattern“ (ľahké skrytie/presun)
   Každé tlačidlo/akcia je v konfigu, UI iba mapuje:
   // features/mix/mix.config.ts
   export const MIX_ACTIONS = [
   { id: 'applySelection', label: 'Použiť vybraný mix (inline)', onClick: 'mix/applyInline' },
   { id: 'recommend', label: 'Aplikovať odporúčaný mix portfólia', onClick: 'mix/applyRecommended' },
   { id: 'share', label: 'Zdieľať', onClick: 'share/open' },
   { id: 'optimize', label: 'Optimalizuj', onClick: 'mix/optimize' },
   { id: 'normalize', label: 'Dorovnať', onClick: 'mix/normalize' },
   ] as const;
   // features/mix/MixPanel.tsx (výpis akcií)
   {MIX_ACTIONS.map(a => (
   <Button key={a.id} onClick={() => actions.exec(a.onClick)}>{a.label}</Button>
   ))}
   • Skryť/presunúť tlačidlo = edit MIX_ACTIONS (bez zásahu do JSX).
   • actions.exec(topic) mapuje na funkcie v mix.service.ts / share.modal atď.

---

4. BASIC vs PRO – vypínanie/UI level bez rozbitia kódu
   • Stav UI režimu je výhradne v profile.modeUi ('BASIC'|'PRO').
   • Viditeľnosť panelov/fíčur rieši iba routes.tsx (alebo LeftStack/RightStack):
   {modeUi === 'BASIC' ? <BasicMixSlice/> : <ProMixPanel/>}
   • Biznis logika je rovnaká (service vrstva). BASIC je len skrátený pohľad.

---

5. Slidery a logika: servis vs. UI
   • mix.service.ts:
   o normalize(list), setGoldTarget(list, target), caps, sum, chipsFromState(state).
   o Čisté funkcie, žiadny React, žiadna perzistencia.
   • UI (MixPanel.tsx) importuje mix.service.ts, vyrenderuje slidery podľa mix.config.ts (poradie, min/max, id).
   → Zmena/sladenie slidera = zmena v mix.config.ts alebo CSS, nie rozkop Rex.

---

6. Wizardy & modaly – jeden unifikovaný wrapper
   ui/Dialog.tsx – jediný modálny wrapper (role, aria, Esc close, návrat fokusu).
   ReserveWizard.tsx, ShareModal.tsx používajú len tento wrapper.
   • Záruka: modaly sa unmountujú po zatvorení (žiadne „hidden“).
   • Fokus sa vracia na spúšťací element cez ref.

---

7. Chips & Insights – deklaratívne
   • insights.config.ts: definuj podmienku a akciu (id + label). UI iba zobrazuje dostupné karty.
   • chips sú generované čistou funkciou chipsFromState – v DOM sú vždy viditeľné.

---

8. Perzistencia – jediný dotykový bod
   • UI nikdy nesiaha na localStorage; len writeV3/readV3.
   • Hydration guard: prvý render bez persist efektu.
   • StrictMode v testoch vypnutý v main.tsx, v prod zapnutý.

---

9. Test IDs, labely a prístupnosť
   • Jediný zdroj TEST_IDS v src/testIds.ts.
   • Labely pre dlhy sú unikátne (1. bez suffixu, ďalšie #2, #3).
   • Pre type="range" používaj v testoch data-testid (stabilita).
   • Modaly: role="dialog", aria-modal="true", Esc zatvára, fokus sa vracia.

---

10. Štýlové konzervy (aby sa layout nerozsypal)
    • Tailwind utility len v layout komponentoch (PageLayout, panely).
    Žiadne absolútne pozicovanie pre hlavné bloky.
    • Z-index mapa:
    o base 0–10: bežné karty
    o modaly 1000+
    o toast/bannery 1100+
    • Všetky panely v kartách majú rovnaké paddingy a radius (rounded-2xl p-4 shadow-sm).

---

11. Čo nesmieme robiť (red flags)
    • Sticky dávať priamo do panelu → rozbije pravý stĺpec. Sticky len v PageLayout.
    • Priamy localStorage.setItem v komponentoch → zakázané.
    • Rozsiahle „kopíruj-vlož“ bloky do LegacyApp.tsx → rozdeliť do features/\*.
    • Vymýšľať nové data-testid ad hoc → pridať do testIds.ts.
    • Meniť texty/chipsy do nečitateľných variácií → držať sa promptu (BASIC copy „Gold 12 % (odporúčanie)“ atď.).

---

12. Ako bezpečne odstraňovať/presúvať veci
    • Odstrániť tlačidlo: vymaž z \*.config.ts (napr. MIX_ACTIONS).
    • Presunúť panel: v LeftStack/RightStack zmeň poradie.
    • Schovať v BASIC: v routes.tsx podmienka na modeUi.
    • Zmeniť cieľ i percento zlata: v mix.service.ts exportuj MIN_GOLD_DEFAULT = 12 → zmeníš na jednom mieste.

---

13. Git / PR disciplina (aby sa dalo vrátiť späť)
    • Každá zmena v UI = samostatný PR (max ~200 LOC).
    • Názvy vetiev:
    o feat/ui-... (len UI),
    o feat/infra-... (len infra),
    o fix/bug-....
    • V PR popise vždy: „Zmenené komponenty“, „Dopad na layout“, „Testy, ktoré sa tým dotýkajú“.
    • Nikdy nerobiť UI aj infra v jednom PR.

---

14. Mini checklist pred merge
    • Pravý panel sticky ostal vpravo (desktop), neschádza pod ľavý.
    • Odstránené/pridané tlačidlá sa riešili cez \*.config.ts.
    • Žiadny priamy localStorage mimo persist/v3.ts.
    • Wizardy unmountujú po close; Esc vracia fokus.
    • Chips sú v viditeľnom DOM.
    • Selektívne testy (reserve wizard, limits, deeplink, a11y) → PASS.

---

15. Implementované panely (Phase 1 – BASIC režim)

    **sec2 (Investičné nastavenia)**
    • 4 textboxy s uncontrolled hooks (debounce ~120ms, blur flush):
    - Jednorazová investícia (lumpSumEur) → persist do profile.lumpSumEur
    - Mesačný vklad (monthlyVklad) → persist do v3.monthly (back-compat mirror)
    - Investičný horizont (horizonYears) → persist do profile.horizonYears
    - Cieľ majetku (goalAssetsEur) → persist do profile.goalAssetsEur
      • type="text" + role="textbox" (compatibility s testami)
      • Žiadne sr-only invest stubs (odstránené po implementácii)
      • A11y: aria-label na každom poli

    **sec5 (Metriky & odporúčania)**
    • 3 scorecards (read-only, live update):
    - Riziko (0–10): riskScore(mix) vs. risk cap (4.0/6.0/7.5), ⚠️ ak over
    - Výnos/rok (odhad): approxYieldAnnualFromMix(mix)
    - Progres k cieľu: FV vs. goalAssetsEur (%)
      • CTA: "Max výnos (riziko ≤ cap)" (placeholder)
      • Žiadne grafy, len číselné karty
      • Helper funkcie: approxYieldAnnualFromMix(), calculateFutureValue()

    **sec4 (Projekcia – lightweight)**
    • CSS progress bar (žiadne nové balíky, žiadne Recharts)
    • A11y: role="progressbar", aria-valuemin/max/now, aria-label
    • Live reaktivita na zmeny v sec2 (lump sum, monthly, horizon, goal) aj na mix
    • Výpočet: FV = P0 _ (1+r)^Y + PM _ 12 \* ((1+r)^Y - 1) / r
    • Fallback: ak goal <= 0 → hint "Nastavte cieľ aktív..."
    • Žiadne zapisovanie do persistu (iba čítanie z v3)

    **Pravidlo: BEZ auto-normalizácie**
    • Ručné zásahy v mixe nenormalizuj okamžite
    • Zobraz chip "Súčet X %" (ak drift)
    • CTA "Dorovnať" to vyrieši manuálne
    • Používateľ má kontrolu nad každou zmenou

---

16. Test stratégia (Phase 1)

    **Kritické testy (npm run test:critical):**
    • tests/invariants.limits.test.tsx (2 tests)
    • tests/accessibility.ui.test.tsx (9 tests)
    • tests/acceptance.mix-cap.ui.test.tsx (3 tests)
    • tests/persist.roundtrip.test.tsx (1 test)
    • tests/persist.debts.v3.test.tsx (1 test)
    • tests/deeplink.banner.test.tsx (1 test)
    **Spolu: 17 tests – musia byť všetky PASS pred merge**

    **Preskočené testy (Phase 1):**
    • Debt UI testy (9 tests) – očakávané FAIL, implementované v Phase 2
    • Chart legend testy – očakávané FAIL, PRO režim
    • Dôvod: BASIC režim nemá debt panel (len tlačidlo "Pridať dlh")

---

TOTO JE OFICIÁLNY PROMPT & STABILITY ADDENDUM.
