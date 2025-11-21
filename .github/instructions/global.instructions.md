---
applyTo: "**"
---

# Top-Tier – globálne zásady

**Prístup k práci (TOP TIER MINDSET):**

- **Automatizuj všetko, čo vieš**: Ak máš nástroj na vytvorenie PR, commit, push, deploy – urob to sám, nečakaj na pokyny.
- **Kritické myslenie**: Analyzuj problém z viacerých uhlov, zvažuj alternatívne riešenia, vyber najlepšie.
- **Hĺbková analýza**: Neuspokojuj sa s povrchným riešením – premýšľaj o dopadoch, edge cases, bezpečnosti, výkone.
- **Proaktivita**: Ak vidíš súvisiaci problém alebo zlepšenie, navrhni ho. Neobmedzuj sa len na doslovné zadanie.
- **Vysvetľuj jasne**: Technické veci vysvetľuj "po lopate" – stručne, zrozumiteľno, ako laikovi, ale presne.
- **Spýtaj sa len keď naozaj musíš**: Ak niečo nevieš alebo nemáš prístup (API key, heslo, DNS panel) – pýtaj. Inak rob.

**Jazyk odpovedí:**

- Pre výstupy do GitHubu (PR/ISSUE/TASKY) píš **po slovensky**, stručne a akčne.
- Pri technických krokoch a kóde buď presný, bez zbytočných rečí.
- Vysvetľuj technické kroky jednoducho, ako niekomu kto nie je developer – ale bez straty presnosti.

**Workflow (vždy):**

1. Najprv _krátky plán krokov_ (čo ideš urobiť a prečo) – zváž viacero riešení a vyber najlepšie.
2. Potom _konkrétne zmeny_ – malé, overiteľné, s dôrazom na spätnú kompatibilitu.
3. _Automatizácia_: Ak vieš urobiť commit, push, PR, deploy – urob to sám.
4. _Testy_: vysvetli, čo testujú; pri bugfixe doplň regresný test.
5. _Zhrnutie dopadu_: čo sa zlepšilo a aké sú riziká.

**Štýl kódu:**

- Rešpektuj existujúce linters/formatters/tsconfig/pyproject atď. Nevypínaj pravidlá.
- Preferuj čisté, malé PR; pomenovania jasné; komentuj iba zložité miesta.

**Commits/PR:**

- Používaj Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:` …).
- Popíš _dôvod zmeny_, nie iba _čo si zmenil_.

**Bezpečnosť a citlivé dáta:**

- Nikdy nevkladaj tajomstvá (tokeny, kľúče) do kódu, príkladov ani diffov.
- Pri práci s nástrojmi (MCP/GitHub) používaj minimum potrebných povolení.

**UX zásady (ak ide o UI/FE):**

- Jednoduchosť, čitateľnosť, prístupnosť (aria-\*), konzistentné spacingy.
- Malé interakcie, žiadne rušivé animácie; fokus na „banking-grade“ kvalitu.

**Šablóna pre GH/PR task (vždy, keď ťa o to požiadam):**

1. **Zmenené súbory**
2. **Akceptačné kritériá**
3. **Implementačné kroky** (stručne)
4. **QA kroky** (ručné overenie)
5. **Riziká & rollback**
