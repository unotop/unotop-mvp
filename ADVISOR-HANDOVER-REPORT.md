# 📊 UNOTOP MVP – Advisor Handover Report

**Dátum:** 22. november 2025  
**Verzia:** UNOTOP – majetkový plánovač 0.9.0 (BASIC)  
**Status:** ✅ PRODUCTION READY – pripravené na verejné zdieľanie

### 📋 Release politika 0.9.0 BASIC

- **0.9.0 BASIC** = stabilná verzia pre klientov, PRO režim pôjde ako samostatná fáza
- **Zmeny logiky výpočtov** (FV, riziko, mix, constraints) musia ísť vždy cez review + testy
- **Bezpečné rýchle zmeny:** texty v UI, email copy, styling, bonusy
- **Pravidlo:** Akákoľvek zmena, ktorá mení čísla v komunikácii smerom ku klientovi, musí byť vedome rozhodnutie, nie „náhodný refactor"

---

## 1️⃣ Čo máme hotové

### ✅ BASIC režim (kompletný)

Interaktívna kalkulačka s "herným" zážitkom – jednoduché, jasné kroky, okamžitá vizuálna odozva.

#### Implementované panely:

1. **Cashflow & rezerva** (sec1)
   - Mesačný príjem, fixné/variabilné výdavky
   - Súčasná rezerva (EUR + mesiace)
   - Mesačný vklad (slider)
   - Wizard "Rezervu doplň" (ak < 1000 € alebo < 6 mesiacov)

2. **Investičné nastavenia** (sec2)
   - Jednorazová investícia, mesačný vklad, horizont, cieľ aktív
   - Live prepočty (debounce 120ms, blur flush)
   - Persist do `profile.*`

3. **Zloženie portfólia** (sec3)
   - Slidery: Zlato, Dynamické riadenie, ETF, Krypto
   - Wizard "Vylepši stabilitu (zlato 12 %)"
   - Auto-normalizácia VYPNUTÁ (ručná kontrola cez CTA "Dorovnať")
   - Mix constraints: Dyn+Krypto ≤ 22 %, zlato ≥ 12 %

4. **Projekcia** (sec4 – pravý panel)
   - CSS progress bar (žiadne závislosti)
   - Live reaktivita na zmeny (vklady, horizont, mix, cieľ)
   - Výpočet FV: compound interest + annuity

5. **Metriky & odporúčania** (sec5)
   - 3 scorecards: Riziko (0–10), Výnos/rok, Progres k cieľu
   - Live chips: "Zlato dorovnané", "Dyn+Krypto obmedzené", "Súčet dorovnaný"
   - CTA: "Max výnos (riziko ≤ cap)" (placeholder)

6. **Email notifikácie** (produkčné)
   - **Klientovi:** Kompletná projekcia (vklady, horizont, cieľ, hodnota po X rokoch, portfólio, bonusy, deeplink)
   - **Agentovi (info.unotop@gmail.com):** Interný email s kontaktmi a detailmi projekcie
   - Fallback: Ak nie je zadaný `recipients`, agent dostane email automaticky

---

## 2️⃣ Bezpečnosť & infraštruktúra

### 🔒 Email systém (Resend API)

- **Server-side only** (Netlify Function)
- **Overená doména:** `unotop.sk` (SPF, DKIM, DMARC)
- **Sender:** `noreply@unotop.sk`
- **Ochrana:**
  - Rate limiting: 5 requestov/hodinu per IP
  - CORS whitelist: `unotop.sk`, `unotop.netlify.app`, `localhost` (dev)
  - Input validácia: email regex, phone regex, čísla v safe ranges
  - Honeypot: metadata check (reCAPTCHA placeholder)

### 🛡️ Security & Anti-bot policy (BASIC 0.9.0)

#### reCAPTCHA
- **V BASIC režime je reCAPTCHA vedome vypnutá** (`ENABLE_RECAPTCHA = false`, `VITE_ENABLE_RECAPTCHA = false`)
- **Dôvod:** Menej problémov s Tracking Prevention / blokovaním scriptov, plynulejší UX pre bežného používateľa
- **Nie je to bug ani nedokončená featura** – je to vedomé rozhodnutie pre jednoduchosť BASIC verzie

#### Ochrana pred spamom
- **Honeypot pole:** Skryté pole + metadata (jednoduchý bot filter)
- **Netlify Function rate limit:** 5 odoslaní / hodinu na IP
- **Validácie:** Email/telefón/čísla v safe ranges (už popísané vyššie)

#### Politika do budúcna
- Ak by sa objavil reálny spam, prvý krok je **sprísnenie rate limitu** (napr. 3/hodinu)
- reCAPTCHA (alebo iný bot filter) sa môže zapnúť neskôr v PRO režime alebo len pri podozrivých requestoch

### 🛡️ Persist & dáta

- **Úložisko:** `localStorage` (v3 schema)
- **Kľúče:** `unotop:v3` (primárny) + `unotop_v3` (alias, synchronizovaný)
- **Hydration guard:** Prvý render ignoruje persist efekt (zabraňuje race conditions)
- **Backward compatibility:** Top-level mirror polí pre staršie testy

### ⚙️ CI/CD

- **GitHub Actions:** Automatické testy na každý PR
- **Netlify:** Deploy preview + produkcia
- **Build:** Clean install (`npm ci`), lint, type-check, unit tests
- **Critical tests:** 17 testov (invariants, a11y, persist, deeplink) – všetky PASS

---

## 3️⃣ Ako appka funguje (pre advisora)

### 📥 Klient príde na `unotop.sk`:

1. Vyplní **cashflow** (príjem, výdavky, rezerva)
2. Nastaví **investičné ciele** (vklad, horizont, cieľ aktív)
3. Upraví **portfólio** (slidery: zlato, dyn, ETF, krypto)
4. Vidí **live projekciu** (hodnota po X rokoch, progres k cieľu, riziko)
5. Klikne **"Odoslať projekciu"** → formulár (meno, email, telefón, bonusy)

### 📧 Čo sa stane po odoslaní:

- **Klient dostane:** Potvrdzovaciu emailu s detailami projekcie + deeplink na interaktívnu verziu
- **Agent dostane:** Interný email na `info.unotop@gmail.com` s kontaktmi a dátami projekcie
- **Deeplink:** URL s hashom obsahujúcim stav (projekcia, mix, profil) – klient môže znova otvoriť svoju projekciu

### 🎯 Advisor workflow:

1. Agent dostane email s kontaktom klienta
2. Otvorí deeplink → vidí presne tú istú projekciu ako klient
3. Môže ju upraviť (PRO režim – budúcnosť)
4. Kontaktuje klienta do 24h

---

## 4️⃣ BASIC vs PRO – hlavné rozdiely

### 🎮 BASIC (aktuálne hotové)

**Filozofia:** "Gaming experience" – jednoduché, zábavné, vedené

- **UI:** Minimum polí, krátke kroky, jasné CTA, micro-animácie
- **Portfólio:** 3 predefinované mixy (Conservative, Balanced, Aggressive) – výber jedným klikom
- **Wizardy:** "Rezervu doplň", "Vylepši stabilitu (zlato)"
- **Odporúčania:** 1-klik Apply (auto-návrhy)
- **Metriky:** 3 scorecards (riziko, výnos, progres)
- **Cieľ:** Začiatočník si rýchlo nastaví rezervu + základnú investíciu bez komplikovaných nastavení

### 🔧 PRO (budúcnosť – Phase 2)

**Filozofia:** "Banking-grade" – presnosť, kontrola, pokročilé nástroje

- **UI:** Všetky polia viditeľné, jemná kontrola, viac číselných inputov
- **Portfólio:** 8 sliderov (všetky asset triedy), manuálne nastavenie percent
- **Dlhy:** Tabuľka hypoték/úverov, payoff kalkulácie, optimalizácia splátok
- **Export/Import:** JSON export projekcie, zdieľanie, verziovanie
- **Metriky:** Viac grafov (histórie, porovnania), detailné breakdown
- **Optimalizátor:** Auto-návrh mixu podľa rizika, cieľa, časového horizontu
- **Cieľ:** Expert má plnú kontrolu, vidí všetko, môže ručne nastaviť každý detail

### 🔄 Zdieľané medzi BASIC a PRO:

- **Rovnaké dáta:** Persist v3 (prepínač nemení stav, len UI)
- **Rovnaká logika:** Výpočty FV, riziko, výnos, mix constraints
- **Rovnaký email systém:** Resend API, rovnaké šablóny
- **Rovnaké bezpečnostné prvky:** Rate limiting, CORS, validácie

---

## 5️⃣ Čo potrebujeme do PRO verzie

### 📋 Technický plán (Phase 2):

1. **Rozšírenie UI komponentov:**
   - Zobrazenie všetkých 8 mix sliderov (conditional render ak `modeUi === 'PRO'`)
   - Debt panel prominentný (BASIC má len tlačidlo "Pridať dlh")
   - Export/Import buttony (JSON download/upload)

2. **Logika (z BASIC preniesť do PRO):**
   - **Prepočty FV** (compound interest + annuity) – už máme ✅
   - **Mix constraints** (dyn+krypto ≤ 22, zlato ≥ 12) – už máme ✅
   - **Risk scoring** (váhovaný priemer volatility asset tried) – už máme ✅
   - **Yield approximation** (váhovaný priemer výnosov mixu) – už máme ✅

3. **Nové features (len PRO):**
   - Debt payoff kalkulácie (predčasné splatenie, optimalizácia splátok)
   - Optimalizátor mixu (Markowitz, risk parity, alebo heuristika)
   - Viac grafov (histogram rizík, scenáre Monte Carlo – voliteľné)
   - Historické porovnania (ak máme dáta z minulosti)

4. **UI/UX rozdiely:**
   - BASIC: 3 predefinované portfóliá (Conservative, Balanced, Aggressive), wizardy, micro-animácie
   - PRO: 8 sliderov (manuálne nastavenie každej asset triedy), tabuľky, exporty, číselné inputy, detailné metriky

---

## 6️⃣ Aktuálny bezpečnostný status

### ✅ Bezpečné:

- Email credentials skryté (server-side Netlify Function)
- Rate limiting (5 req/h per IP) – zabraňuje spamu
- CORS whitelist – len povolené domény
- Input sanitácia – email/phone regex, čísla v safe ranges
- Resend domain verified – SPF, DKIM, DMARC OK

### ⚠️ Môžeme vylepšiť (budúcnosť):

- reCAPTCHA server-side verifikácia (zatiaľ len placeholder)
- Redis/KV store pre rate limiting (teraz in-memory, reset na cold start)
- CSP headers (Content Security Policy) pre XSS ochranu
- HTTPS everywhere (Netlify už má, ale hardcoded redirects)

### ✅ Záver:

**BASIC verzia je bezpečná a ready pre verejnosť.** Základné ochranné prvky sú na mieste, emailový systém je produkčný (verified domain, server-side, rate limiting).

---

## 7️⃣ Odpoveď na tvoju otázku: BASIC vs PRO

**Hlavný rozdiel:**

- **BASIC** = Začiatočník, vedený zážitok, minimum polí, wizardy, "gaming UX"
- **PRO** = Expert, plná kontrola, všetky polia viditeľné, manuálne nastavenia, "banking UX"

**Čo je rovnaké:**

- Všetky prepočty (FV, riziko, výnos, mix constraints)
- Perzistencia (rovnaké dáta, len iný UI layer)
- Email systém (rovnaké notifikácie)

**Čo pridáme do PRO:**

- Viac sliderov (8 namiesto 4)
- Debt panel prominentný (tabuľka hypoték)
- Export/Import (JSON)
- Optimalizátor mixu (auto-návrh podľa cieľov)
- Viac metrík/grafov (detailné breakdown)

**Ako na to:**

1. Všetku logiku z BASIC preniesť do zdieľaných servisov (`*.service.ts`)
2. UI komponenty podmieňovať na `modeUi === 'BASIC' | 'PRO'`
3. PRO rozšíriť o nové features (debt payoff, optimizer, export)

**Odhadovaný čas:** 2–3 týždne (ak pracujeme systematicky)

---

## 8️⃣ Known limitations & support (BASIC 0.9.0)

### ⚠️ Známe limity a edge cases

1. **Preklep v emaili klienta**
   - Ak klient zadá zlý email, confirmation email mu nepríde
   - Interný email agentovi (`info.unotop@gmail.com`) však obsahuje projekciu a telefón, takže kontakt je stále možný

2. **Resend / email výpadok**
   - Ak Resend API alebo Netlify Function zlyhá, používateľ uvidí generickú chybovú hlášku
   - Aktuálne neexistuje auto-retry / queue; rieši sa manuálnym kontaktovaním po nahlásení problému

3. **LocalStorage & režimy prehliadača**
   - V InPrivate/Inkognito alebo v starších prehliadačoch môže byť `localStorage` obmedzený alebo vypnutý
   - Appka stále funguje, ale neudrží stav medzi reloadmi (len znížený komfort, nie crash)

4. **Auto-translate / preklad prehliadača**
   - Appka je písaná po slovensky (`lang="sk"`), ale automatické prekladače v prehliadači môžu texty skomoliť
   - Odporúčanie: preto je primárny cieľ SK používateľ, iné jazyky budú riešené neskôr samostatne

5. **Dlhy & hypotéky**
   - BASIC verzia nemá plnohodnotný „debt panel" – hypotéky/úvery sa zatiaľ riešia manuálne pri stretnutí
   - PRO verzia prinesie tabuľku úverov a payoff kalkulácie (už naznačené v časti „Čo potrebujeme do PRO verzie")

---

## 9️⃣ Next steps

### Ak chceš pokračovať s PRO verziou:

1. **Refactor logiky:** Presunúť všetky výpočty do `src/services/*.service.ts`
2. **Conditional rendering:** Rozšíriť `LegacyApp.tsx` o PRO panely
3. **Debt panel:** Implementovať tabuľku hypoték + payoff kalkulácie
4. **Export/Import:** JSON download/upload komponent
5. **Optimalizátor:** Heuristika alebo Markowitz (Phase 3)

### Ak chceš web stránku:

1. **Landing page:** Marketing copy, screenshoty, CTA "Vyskúšaj kalkulačku"
2. **SEO:** Meta tags, Open Graph, structured data
3. **Analytics:** Google Analytics / Plausible
4. **Legal:** Privacy policy, cookies, GDPR compliance

---

## ✅ Zhrnutie

**Máme funkčnú BASIC verziu:**

- 5 panelov (cashflow, investície, portfólio, projekcia, metriky)
- Email notifikácie (klient + agent) s Resend API
- Bezpečnosť (rate limiting, CORS, validácie, verified domain)
- 17 kritických testov PASS
- Deploy na Netlify (CI/CD)

**Rozdiel BASIC vs PRO:**

- BASIC = vedený zážitok, minimum polí, wizardy
- PRO = plná kontrola, všetky polia, export/import, optimalizátor
- Rovnaká logika, len iný UI layer

**Ďalší krok:**
Rozhodnutie medzi PRO verziou (rozšírenie kalkulačky) alebo web stránkou (marketing, landing).

---

**Status:** ✅ PRODUCTION READY – môžeme verejne zdieľať BASIC verziu!
