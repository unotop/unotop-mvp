# fix(email): kompletný klientsky email + agent fallback

## Zmenené súbory
- netlify/functions/send-projection.ts
- .github/instructions/global.instructions.md

## Problém
1. Klient dostával iba úvod a bonusy, chýbali sekcie s projekciou a portfóliom
2. Agent (info.unotop@gmail.com) nedostával žiadny email

## Riešenie
1. Klientsky email rozšírený o detaily projekcie, portfólio, deeplink
2. Agent email fallback na info.unotop@gmail.com
3. Aktualizované globálne inštrukcií - top-tier mindset

## Akceptačné kritériá
- Klient dostane kompletný email
- Agent dostane interný email
- Fallback funguje
- Žiadne chyby

## QA kroky
1. Deploy na Netlify
2. Odoslať projekciu
3. Overiť prijatie emailov
4. Skontrolovať kompletnosť obsahu

## Riziká
Low: Backward compatible zmeny