# PR: UNOTOP BASIC 0.9.0 – release policy, security & known limitations

## Zmenené súbory

- `ADVISOR-HANDOVER-REPORT.md`
- `index.html`
- `src/components/WelcomeModal.tsx`

## Čo sa zmenilo

### 1. Verzia a release politika (ADVISOR-HANDOVER-REPORT.md)

- Jasné označenie: **UNOTOP – majetkový plánovač 0.9.0 (BASIC)**
- Release politika: kritické zmeny (výpočty) cez review + testy, bezpečné zmeny (texty/styling) OK
- Jasné pravidlo: čísla smerom ku klientom = vedome rozhodnutie, nie náhodný refactor

### 2. Security & Anti-bot policy (ADVISOR-HANDOVER-REPORT.md)

- **reCAPTCHA vedome vypnutá v BASIC** (plynulejší UX, menej tracking prevention problémov)
- Nie je to bug ani nedokončená featura – je to vedomé rozhodnutie
- Ochrana: honeypot + rate limit (5 requestov/hod) + validácie email/phone/čísla
- Politika do budúcna: pri spame najprv sprísnenie rate limitu, reCAPTCHA len v PRO alebo pri podozrivých requestoch

### 3. Known limitations & support (ADVISOR-HANDOVER-REPORT.md)

Zdokumentované známe limity a edge cases:

- **Preklep v emaili:** Klient nedostane confirmation, ale agent má interný email s telefónom
- **Resend výpadok:** Generická chybová hláška, zatiaľ bez auto-retry/queue
- **localStorage limity:** InPrivate/Inkognito neudrží stav, ale appka necrashne
- **Auto-translate:** SK appka, prekladače môžu skomoliť texty (primárny cieľ = SK používateľ)
- **Debt panel:** BASIC nemá plnohodnotný panel, hypotéky sa riešia pri stretnutí (PRO prinesie tabuľku)

### 4. HTML lang="sk" (index.html)

- Zmenené `lang="en"` → `lang="sk"` pre správne rozpoznanie jazyka prehliadačmi
- Zabráni auto-translate problémom a zlepší accessibility

### 5. Intro modal fix (WelcomeModal.tsx)

- **Bug fix:** Modal sa zobrazoval na spodku namiesto stredu
- Zmenené `items-start` → `items-center` pre správne vertikálne centrovanie
- Odstránené `my-4 sm:my-8` marginy

## Akceptačné kritériá

- [x] Verzia 0.9.0 BASIC jasne uvedená v docse
- [x] Security policy explicitne popísaná (reCAPTCHA OFF = vedome rozhodnutie)
- [x] Known limitations zdokumentované (5 bodov)
- [x] HTML lang="sk" nastavený
- [x] Intro modal centrovaný vertikálne
- [x] Žiadne funkčné zmeny v business logike
- [x] Žiadne nové chyby
- [x] Všetky existujúce testy PASS

## QA kroky

1. ✅ Otvor `ADVISOR-HANDOVER-REPORT.md` → over verziu, security policy, known limitations
2. ✅ View Page Source `index.html` → over `<html lang="sk">`
3. ✅ Spusti appku → over že intro je centrovaný (nie na spodku)
4. ✅ Odoslať projekciu → over že správanie sa nezmenilo (klient + agent dostanú emaily)

## Riziko

**Low** – len dokumentácia + 1 HTML attribute + 1 CSS fix pre centrovanie

- Žiadne zmeny v business logike
- Žiadne zmeny vo výpočtoch
- Backward compatible

## Dopad

**High benefit, low risk:**

- Profesionálna dokumentácia verzionovania a bezpečnosti
- Jasné hranice medzi bezpečnými a kritickými zmenami
- Ochrana pred nedorozumeniami o známych limitoch
- Lepší UX (intro centrovaný)
- Lepšia accessibility a SEO (lang="sk")

---

**Po merge: UNOTOP BASIC 0.9.0 PRODUCTION READY** ✅
