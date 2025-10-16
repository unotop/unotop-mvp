# Current risk model – špecifikácia v1

Tento dokument formalizuje „Current“ model rizika a skórovania, aby bol auditovateľný a porovnateľný s „Legacy“ modelom.

## 1) Vstupy a konštanty

- Vstupné váhy portfólia w_k v percentách; interné výpočty pracujú s normovanými váhami p_k = w_k / Σw.
- Tabuľka aktív (per scenár) poskytuje:
  - expReturn_pa: očakávaný ročný výnos (desatinné číslo, napr. 0.12)
  - risk: základné riziko aktíva na škále 0–10
  - zdroj dát: súbory v kóde: `src/domain/assets.ts` (sekcie currentSets.\*)
- Režimy: Current používa tabuľky currentSets; Legacy používa legacySets.

## 2) Tabuľka aktív: expReturn_pa, baseRisk, zdroj dát

- Pozri `src/domain/assets.ts`, objekt `currentSets` pre scenáre conservative/base/aggressive.
- Príklad (base):
  - ETF (svet – aktívne): expReturn 0.075, risk 6
  - Zlato (fyzické): 0.03, risk 3
  - Krypto (BTC/ETH): 0.25, risk 10
  - Dynamické riadenie: 0.12, risk 7.5
  - Garantovaný dlhopis 7,5% p.a.: 0.075, risk 1.5
  - Hotovosť/rezerva: 0.01, risk 0.5
  - Reality (komerčné): 0.085, risk 5

## 3) Prahy (varovania/limity)

- Riziko (soft warn/hard):
  - warn: raw > 7.5 (v UI sa zvýrazní)
  - hard: raw ≥ 10 (blok – UI hláška)
- Hotovosť/rezerva max: odporúčanie v UI: Current signalizuje „cash > 35%“ (soft varovanie).
- Súhrn „dyn + crypto“: invarianty mimo rizika (viď kapitola 7), optimalizátor v Current používa dynCap = 30% (nie je to riziková penalizácia, ale obmedzenie v search).
- Overweight na jednotlivé pozície: penalizácia v riziku (viď vzorec). Hranica 35%.
- Koncentrácia: penalizácia z HHI s prahom 0.18.

## 4) Výpočet rizika (Current) – FORMULA

Výpočet je implementovaný v `src/domain/risk.ts` (computeRisk):

- Normalizácia na p_k = w_k / Σw.
- Základné riziko: base = Σ_k p_k · risk_k.
- Penalizácia za overweight: overweightPenalty = Σ_k max(0, p_k − 0.35) · 8.
- Penalizácia za koncentráciu: HHI = Σ_k p_k²; concentrationPenalty = max(0, HHI − 0.18) · 12.
- Príplatok za vysoké (dyn + crypto):
  - dyn = p*{Dynamické riadenie}, crypto = p*{Krypto}
  - ak (dyn + crypto) > 0.45: dynamicSurcharge = (dyn + crypto − 0.45) · 15; inak 0.
- Súčtové riziko: raw = min(10, base + overweightPenalty + concentrationPenalty + dynamicSurcharge).
- Mapovanie:
  - raw je priamo 0–10. Percentá do UI: pct = raw / 10.

Poznámka: Current je teda „základný vážený priemer + tri penalizačné členy“ s tvrdým stropom 10.

## 5) Výpočet očak. výnosu

- expectedReturn = Σ_k p_k · expReturn_pa_k
- Žiadne ďalšie prirážky / rizikové diskonty. Zaokrúhlenie len pri zobrazení (napr. na 2 desatinné miesta percentuálne).

## 6) Skóre optimalizátora (Current)

- Implementácia v `src/domain/optimizer.ts`:
  - Pre Current: `score = expectedReturn / (riskRaw || 1)`
  - Pre Legacy: `score = (er · 100) / min(10, risk)`

Formálne:

Current: er / risk

Legacy: (er · 100) / min(10, risk)

- Prečo iné než Legacy: Current chce zachovať rozmerovo jednoduchý pomer „výnos na jednotku rizika“ bez umelého škálovania a bez orezania na 10 v čitateli; Legacy ostáva kompatibilné s existujúcimi snímkami.

## 7) Obmedzenia a invarianty

- Pravidlá, ktoré platia univerzálne (v UI a helperoch), nie sú súčasťou výpočtu rizika Current, ale ovplyvňujú mixy:
  - Gold floor: zlato ≥ 10% (aplikované v odporúčaniach a pri niektorých akciách „upraviť podľa pravidiel“).
  - Dyn + crypto ≤ 22%: tvrdé pravidlo používané najmä v Legacy pipeline; Current optimalizátor používa mäkšie obmedzenie iba na „Dynamické riadenie“ (≤ 30%) a rizikový model penalizuje vysoké (dyn + crypto) až nad 45% cez dynamicSurcharge.
  - Súčet váh = 100%: fairRoundTo100 a guardy v UI.
- Zhrnutie: Current riziko neobsahuje „22% limiter“, ale penalizuje koncentráciu a extrémne (dyn + crypto) cez príspevkové členy. Legacy obsahuje dvojfázový limiter 22% priamo v odporúčaniach/invarianoch.

## 8) Rozdiely voči Legacy – stručná tabuľka

- Penalizácie:
  - Overweight: Current: prah 35% s koef. 8; Legacy: prah 20% škálovaný v base (cez ALPHA_OVERWEIGHT).
  - Koncentrácia (HHI): Current prah 0.18, koef. 12; Legacy prah 0.22, koef. 10 · GAMMA_HHI (tu 1.0) + ďalšie odvodené metriky (wMax, top2Sum) pre diagnostiku.
  - Dynamické prahy: Current iba príplatok pri (dyn+crypto) > 45%; Legacy má piecewise príplatok na samotné „Dynamické riadenie“ už od 20%.
- Limity a prahy:
  - Riziko warn/hard: Current warn 7.5, hard 10; Legacy ekvivalentné zobrazenie, ale iný výpočet raw.
  - Gold floor: oboje uplatňujú cez invarianty/odporúčania (nie je súčasť raw rizika).
  - Dyn+crypto 22%: Strict v Legacy invariantoch; Current nie (len penalizácia >45% + opt. dynCap 30%).
- Skóre:
  - Current: er / risk
  - Legacy: (er\*100) / min(10, risk)
- Behaviorálne rozdiely:
  - Current „odmeňuje“ diverzifikáciu cez HHI prah 0.18 silnejšie (skôr trestá koncentráciu).
  - Legacy reaguje výraznejšie na samotné „Dynamické riadenie“ cez stupňovitú prirážku; Current vníma skôr sumu (dyn+crypto) v extrémoch.

## 9) Dôvod existencie Current

- Ciele:
  - Jednoduchšia interpretácia: vážený priemer + penalizácie s explicitnými prahmi.
  - Stabilita pri malých zmenách: vyššie prahy (overweight 35%, HHI 0.18) znižujú „kmitanie“.
  - Lepšia kalibrácia na „real world“ pri reálnej dostupnosti aktív a nízkych podieloch častí portfólia.
- Kedy použiť:
  - Current: keď požadujeme hladší, intuitívny risk/return trade-off a robustnejšie skóre pre optimalizátor.
  - Legacy: keď potrebujeme striktné historické pravidlá (22% limiter) a spätnú kompatibilitu so staršími reportmi.

## 10) Porovnávací audit (Golden A/B/C + 2 reálne scenáre)

Pre scénar „base“ boli spočítané metriky pre rovnaké váhy na oboch modeloch, s aktuálnymi tabuľkami aktív. Vstupy FV: one-time = 10 000 €, monthly = 300 €, horizon = 10 rokov.

Výsledky vypočítame skriptom `scripts/audit-current-vs-legacy.ts` (pozri repo). Ak nie je spustený, odporúčané je ho spustiť lokálne a vložiť tabuľku sem. Kľúčové stĺpce:

- mix → riskLegacy vs riskCurrent, expectedReturnLegacy vs expectedReturnCurrent, FV(L) vs FV(C), rr score (pomer er/risk) a delta.

Poznámka: keďže Legacy a Current používajú rozdielne parametre aktív, rozdiely v expectedReturn sú očakávané; zmysel má porovnať dvojice v rámci každého modelu a zhodnotiť konzistenciu trendov (vyššia koncentrácia → vyššie riziko, dlhopis/čo-to-cash → nižšie riziko, atď.).

### Výsledky (base scenár)

| Scenár                       | riskL | riskC |  erL |  erC |    fvL |   fvC | scoreL | scoreC | Komentár                                                                                                                     |
| ---------------------------- | ----: | ----: | ---: | ---: | -----: | ----: | -----: | -----: | ---------------------------------------------------------------------------------------------------------------------------- |
| Golden A (60/20/10/5/5) | 7.55 | 10.00 | 0.15 | 0.09 | 125137 | 80181 | 1.96 | 0.01 | Vyššia koncentrácia v ETF → Current penalizuje cez HHI (0.18 prah) a overweight (35%).                                       |
| Golden B (40/20/20/10/10) | 5.95 | 7.26 | 0.17 | 0.11 | 142088 | 92015 | 2.77 | 0.01 | Vyšší podiel dyn+crypto (30%) pod prahom 45% → Current bez surcharge; Legacy môže mať vyššie base kvôli dynamickej stupnici. |
| Golden C (25/20/15/10/20/10) | 4.60 | 4.76 | 0.14 | 0.09 | 119318 | 82711 | 3.08 | 0.02 | Diverzifikovanejšie váhy → Current má nižší HHI; riziko klesá mierne oproti A/B.                                             |
| Real-1 (Conservative tilt) | 3.64 | 4.12 | 0.11 | 0.07 | 94513 | 71178 | 3.00 | 0.02 | Vysoký dlhopis/hotovosť → nižšie base risk; Current aj Legacy by mali byť nízke.                                             |
| Real-2 (Aggressive tilt) | 6.77 | 8.23 | 0.18 | 0.11 | 159218 | 94320 | 2.66 | 0.01 | Vyššie dyn+crypto; Current surcharge až nad 45% súčet — ak nedosiahnuté, rozdiel najmä v base a HHI.                         |

Pozn.: tabuľku naplň skriptom `scripts/audit-current-vs-legacy.ts`.

## 11) Test plán

- Unit parity a vlastnosti:
  - Monotónnosť rizika pri extrémoch: väčšie podiely rizikových aktív zvyšujú raw.
  - Stabilita pri malých zmenách: malá delta váh nevyvolá skoky cez prahy (najmä okolo 35% a HHI 0.18).
  - Hranové prípady: všetko v hotovosti; 100% v jednom aktíve; 50/50 v dvoch aktívach; dyn+crypto tesne pod a nad 45%.
- Optimalizátor smoke:
  - Pri Current: score = er/risk; kontrola, že riešenia s extrémnym rizikom > maxRisk sú odfiltrované.

## 12) Rozhodovacia logika (čo spravíme podľa výsledku)

- Ak Current neprinesie merateľnú výhodu (zrozumiteľnosť, stabilita, alebo lepší fit):
  - Current vypneme alebo skryjeme do „Expertný režim (beta)“ za prepínačom.
- Ak Current je zmysluplný:
  - ponecháme oba režimy; default = Legacy; Current označíme „beta“ do ukončenia auditu.

## 13) Čo (hneď teraz) poslať na GH

Prosím, doplň `spec-current-v1.md` podľa šablóny (body 1–9 vyššie) a sprav porovnávací audit (Golden A/B/C + 2 reálne scenáre). Na základe toho rozhodneme, či Current ponecháme, skryjeme ako beta, alebo odstránime.
