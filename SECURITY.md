# Security Policy – UNOTOP MVP

**Verzia:** 1.0  
**Platné od:** 20.11.2025  
**Zodpovedná osoba:** Ing. Adam Belohorec (adam.belohorec@universal.sk)

---

## 🛡️ Prehľad zabezpečenia

UNOTOP MVP je finančná kalkulačka s dôrazom na ochranu osobných údajov a prevenciu zneužitia. Táto dokumentácia popisuje implementované bezpečnostné opatrenia a best practices.

---

## ✅ Implementované bezpečnostné funkcie

### 1. **Bot Protection (reCAPTCHA v3)**

**Čo:** Google reCAPTCHA v3 – invisible AI ochrana pred botmi  
**Kde:** Formulár "Odoslať projekciu agentovi"  
**Ako funguje:**
- Analyzuje správanie používateľa na pozadí (bez vyrušovania)
- Generuje token pred každým odoslaním formulára
- Server-side verifikácia: SKIP (EmailJS rollback – plánovaná migrácia na Resend.com)

**Threshold:** 0.5 (Google default)  
**GDPR compliance:** ✅ Uvedené v Zásadách ochrany osobných údajov  
**Badge:** Skrytý (allowed ak je "Protected by reCAPTCHA" text v privacy policy)

**Súbory:**
- `src/hooks/useReCaptcha.ts` – React hook pre token generation
- `index.html` – reCAPTCHA script tag
- `src/BasicLayout.tsx` – integrácia pred submit

**Príklad:**
```typescript
const { execute } = useReCaptcha();
const token = await execute('submit_projection');
// Token sa posiela v ProjectionData.metadata.recaptchaToken
```

---

### 2. **Honeypot (skrytá pasca na boty)**

**Čo:** Neviditeľné pole v formulári  
**Kde:** ShareModal (formulár na odoslanie projekcie)  
**Ako funguje:**
- Pole je skryté CSS (`position: absolute; left: -9999px`)
- Ľudskí používatelia ho nevidia a nevypĺňajú
- Boty ho automaticky vyplnia → submission je blokovaný

**Kód:**
```tsx
// Honeypot field (hidden from humans, visible to bots)
<input
  type="text"
  name="website"
  value={formData.honeypot}
  onChange={(e) => setFormData({ ...formData, honeypot: e.target.value })}
  tabIndex={-1}
  autoComplete="off"
  style={{ position: 'absolute', left: '-9999px' }}
  aria-hidden="true"
/>

// Validation
if (formData.honeypot !== "") {
  console.warn("[Security] Honeypot triggered - blocking submission");
  return; // Block submission
}
```

---

### 3. **Rate Limiting (3 požiadavky/hodina)**

**Čo:** Obmedzenie počtu odoslaní formulára z jednej IP/browsera  
**Kde:** `src/utils/rate-limiter.ts`  
**Limity:**
- **3 submissions** za hodinu
- In-memory tracking (localStorage)
- Reset: každú hodinu (rolling window)

**API:**
```typescript
import { canSubmit, recordSubmission } from './utils/rate-limiter';

if (!canSubmit()) {
  alert('Presiahli ste limit 3 odoslaní za hodinu. Skúste neskôr.');
  return;
}

// Po úspešnom odoslaní
recordSubmission();
```

**Poznámka:** In-memory solution (nemá backend). Pre produkciu odporúčame server-side rate limiting (Netlify Functions + Redis).

---

### 4. **Input Validation (LocalStorage poisoning prevention)**

**Čo:** Automatická validácia a korekcia dát z localStorage  
**Kde:** `src/persist/v3.ts` – funkcia `validateV3Data()`  
**Limity:**
- `lumpSumEur` ≤ 10M (clamp to 10M)
- `monthly` ≤ 100k (clamp to 100k)
- `horizonYears`: 1–50 (clamp to range)
- `mix sum` ≈ 100% (normalize alebo reset na default)

**Správanie:**
```typescript
// Tampered localStorage (útočník zmenili hodnotu):
{ lumpSumEur: 999999999, monthly: 500000, horizonYears: 150 }

// Po validácii (auto-correct):
{ lumpSumEur: 10000000, monthly: 100000, horizonYears: 50 }

// Console warning:
[v3] LocalStorage validation warnings: [
  "lumpSumEur exceeded 10M (999999999), clamping to 10M",
  "monthly exceeded 100k (500000), clamping to 100k",
  "horizonYears exceeded 50 (150), clamping to 50"
]
```

**Prečo:** Používateľ nemôže poisonovať localStorage extrémne vysokými hodnotami, ktoré by mohli spôsobiť DoS alebo nesprávne výpočty.

---

### 5. **XSS Prevention (DOMPurify sanitization)**

**Čo:** Ochrana pred Cross-Site Scripting útokmi  
**Kde:** `src/components/PrivacyModal.tsx`  
**Použité nástroje:** DOMPurify v3.2.2

**Riziko (pred opravou):**
```tsx
// VULNERABLE CODE:
<li dangerouslySetInnerHTML={{ __html: content }} />
```

**Riešenie:**
```tsx
import DOMPurify from 'dompurify';

const sanitized = DOMPurify.sanitize(content);
<li dangerouslySetInnerHTML={{ __html: sanitized }} />
```

**Čo DOMPurify blokuje:**
- `<script>` tagy
- `onclick`, `onerror` handlery
- `javascript:` URLs
- `data:` URLs (ak nie sú whitelisted)
- Všetky potenciálne XSS vektory

**Testovanie:**
```bash
# Pridaj do privacy-policy.sk.md:
<script>alert('XSS')</script>

# Výsledok: script tag je odstránený, alert sa nespustí
```

---

### 6. **CORS Policy (email endpoint)**

**Čo:** Whitelist povolených origins pre email odosielanie  
**Kde:** Netlify Function `send-projection.ts` (INACTIVE – EmailJS rollback)  
**Povolené domény:**
- `http://localhost:*` (DEV)
- `https://unotop.netlify.app` (Netlify preview)
- `https://unotop.sk` (produkcia)

**Poznámka:** Momentálne SKIP (client-side EmailJS). Po migrácii na Resend.com/SendGrid bude CORS validácia aktívna.

---

### 7. **HTTPS Only (produkcia)**

**Čo:** Všetka komunikácia cez šifrovaný HTTPS  
**Kde:** Netlify automaticky enforcuje HTTPS  
**Certifikát:** Let's Encrypt (auto-renewal)

**Prínos:**
- Ochrana pred Man-in-the-Middle útokmi
- Dátová integrita
- Browser security features (autocomplete, reCAPTCHA fungujú len cez HTTPS)

---

### 8. **No Sensitive Data in LocalStorage**

**Čo:** V localStorage neuchovávame citlivé údaje  
**Uložené dáta:**
- ✅ Investičné parametre (lumpSum, monthly, horizon)
- ✅ Portfolio mix (percentá)
- ✅ Kontaktné údaje (meno, email) – len pre prefill, GDPR súhlas
- ❌ Heslá, tokeny, platobné údaje – NIE

**Poznámka:** Všetky dáta sú len lokálne, neodosielajú sa na server (okrem formulára "Odoslať projekciu").

---

## 🔴 Známe limitácie

### 1. **Client-side EmailJS (temporary)**

**Problém:** EmailJS credentials sú exponované v client-side kóde  
**Riziko:** Útočník môže získať public key a odosielať spam/abuse emails  
**Mitigation:**
- Rate limiting (3 req/hour)
- reCAPTCHA v3
- Honeypot

**Plánované riešenie:** Migrácia na Resend.com alebo SendGrid (server-side Netlify Function)

---

### 2. **In-memory Rate Limiting**

**Problém:** Rate limit je v localStorage → používateľ môže vymazať a obísť limit  
**Riziko:** Stredné (reCAPTCHA + honeypot stále fungujú)  
**Plánované riešenie:** Server-side rate limiting (Netlify Functions + Redis/Upstash)

---

### 3. **No Server-side reCAPTCHA Verification**

**Problém:** reCAPTCHA token sa negeneruje, ale neverifikuje server-side  
**Dôvod:** EmailJS rollback (Netlify Function neaktívna)  
**Plánované riešenie:** Po migrácii na Resend.com pridať server-side verifikáciu

---

### 4. **Deeplink Encryption**

**Problém:** Deeplinky nie sú šifrované (dáta sú v plain JSON)  
**Riziko:** Nízke (nie sú citlivé údaje, len investičné parametre)  
**Rozhodnutie:** SKIP v MVP (Phase 2/P3)  
**Dôvod:** Client-side AES = obfuscation, nie skutočné šifrovanie

---

## 🚨 Vulnerability Reporting

Ak objavíte bezpečnostnú zraniteľnosť, prosím **NEOTVÁRAJTE** verejný GitHub issue.

**Kontakt pre bezpečnostné hlásenia:**
- **Email:** info.unotop@gmail.com
- **Subject:** `[SECURITY] Vulnerability Report`

**Prosíme uveďte:**
1. Popis zraniteľnosti
2. Kroky na reprodukciu
3. Potenciálny dopad
4. Ak je možné, návrh riešenia

**Reakcie:**
- **Critical:** < 24 hodín
- **High:** < 48 hodín
- **Medium/Low:** < 7 dní

---

## 📋 Security Checklist (pre deployment)

Pred nasadením novej verzie overte:

- [ ] `npm audit` – žiadne critical/high vulnerabilities
- [ ] `npm run typecheck` – žiadne TypeScript errors
- [ ] `npm run lint` – žiadne ESLint warnings
- [ ] `npm test` – všetky testy PASS
- [ ] reCAPTCHA funguje (console log: `[reCAPTCHA] Token generated`)
- [ ] Rate limiting funguje (4. submission → blocked)
- [ ] LocalStorage validácia (tamper test → auto-correct)
- [ ] XSS test (inject `<script>` do privacy policy → sanitized)
- [ ] HTTPS certifikát platný (Netlify auto-renewal)

---

## 🔐 Best Practices (pre vývojárov)

### 1. **Nikdy nevkladať tajomstvá do kódu**

❌ **ZLÉ:**
```typescript
const API_KEY = 'sk_live_123456789';
```

✅ **DOBRÉ:**
```typescript
const API_KEY = import.meta.env.VITE_API_KEY; // .env.local
```

### 2. **Vždy sanitizovať user input**

❌ **ZLÉ:**
```tsx
<div dangerouslySetInnerHTML={{ __html: userInput }} />
```

✅ **DOBRÉ:**
```tsx
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(userInput) }} />
```

### 3. **Validovať všetky vstupy (client + server)**

```typescript
// Client-side (UX)
if (lumpSum > 10_000_000) {
  alert('Maximálna jednorazová investícia je 10M €');
  return;
}

// Server-side (security)
if (body.lumpSum > 10_000_000) {
  return new Response('Invalid input', { status: 400 });
}
```

### 4. **Používať TypeScript strict mode**

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true
  }
}
```

### 5. **Dependencies audit (pravidelne)**

```bash
npm audit
npm outdated
npm update
```

---

## 🔮 Budúce vylepšenia (Roadmap)

### Priorita 1 (Q1 2026)
- [ ] Migrácia na Resend.com/SendGrid (server-side email)
- [ ] Server-side reCAPTCHA verification
- [ ] Server-side rate limiting (Netlify Functions + Upstash Redis)

### Priorita 2 (Q2 2026)
- [ ] Content Security Policy (CSP) headers
- [ ] Subresource Integrity (SRI) pre external scripts
- [ ] Security headers audit (HSTS, X-Frame-Options, atď.)

### Priorita 3 (Q3 2026)
- [ ] Penetration testing (externý audit)
- [ ] Bug bounty program
- [ ] WAF (Web Application Firewall) – Cloudflare/Netlify

---

## 📚 Súvisiace dokumenty

- [Zásady ochrany osobných údajov](docs/privacy-policy.sk.md) – GDPR compliance
- [SECURITY-AUDIT-REPORT.md](SECURITY-AUDIT-REPORT.md) – Detailný audit (75/100 skóre)
- [PR-23 Security Roadmap](docs/PR-23-SECURITY-ROADMAP.md) – Implementačný plán

---

## 📞 Kontakt

**Security lead:** Ing. Adam Belohorec  
**Email:** adam.belohorec@universal.sk  
**Tel:** +421 915 637 495  
**GDPR kontakt:** info.unotop@gmail.com

---

**Posledná aktualizácia:** 20.11.2025  
**Verzia dokumentu:** 1.0  
**Schválené:** Ing. Adam Belohorec
