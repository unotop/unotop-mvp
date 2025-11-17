# SECURITY AUDIT REPORT - UNOTOP MVP

**Dátum:** 2025-11-14  
**Audítor:** GitHub Copilot  
**Status:** 🔴 KRITICKÉ ZRANITEĽNOSTI NÁJDENÉ

---

## 🔴 KRITICKÉ (Immediate Fix Required)

### 1. **Hardcoded EmailJS Credentials**

**Súbor:** `src/services/email.service.ts:14-16`  
**Riziko:** VYSOKÉ - Credential leak, API abuse, spam attack  
**Problém:**

```typescript
const EMAILJS_SERVICE_ID = "service_r2eov4s";
const EMAILJS_TEMPLATE_ID = "template_bmcskm8";
const EMAILJS_PUBLIC_KEY = "1hx6DPz-diYTb9Bzf";
```

- Ktokoľvek môže vidieť credentials v source code
- Útočník môže spamovať cez vašu EmailJS account
- EmailJS môže blokovať account kvôli abuse

**Riešenie:**

```typescript
// .env.local (NIKDY necommituj do git!)
VITE_EMAILJS_SERVICE_ID=service_r2eov4s
VITE_EMAILJS_TEMPLATE_ID=template_bmcskm8
VITE_EMAILJS_PUBLIC_KEY=1hx6DPz-diYTb9Bzf

// src/services/email.service.ts
const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || '';
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '';
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || '';

// Validate on init
if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
  console.error('[EmailJS] Missing credentials - email service disabled');
}
```

**Dodatočné zabezpečenie:**

- Zapni **EmailJS rate limiting** v dashboarde (max 100 emails/deň)
- Povoľ len whitelisted domény (napr. `unotop.sk`, `unotop.netlify.app`)
- Zapni **CAPTCHA verifikáciu** v EmailJS šablóne

---

### 2. **XSS Zraniteľnosť v PrivacyModal**

**Súbor:** `src/components/PrivacyModal.tsx:91,102`  
**Riziko:** STREDNÉ - Cross-Site Scripting (XSS)  
**Problém:**

```tsx
dangerouslySetInnerHTML={{ __html: content }}
```

- Ak by content obsahoval `<script>alert('XSS')</script>`, spustilo by sa
- Momentálne je content zo statického SK textu (relatívne bezpečné)
- Ale ak niekedy pridáte dynamický obsah = RIZIKO

**Riešenie:**

```typescript
import DOMPurify from 'dompurify';

// Sanitize before rendering
const sanitizedContent = DOMPurify.sanitize(content, {
  ALLOWED_TAGS: ['strong', 'em', 'p', 'li', 'ul', 'ol', 'br'],
  ALLOWED_ATTR: []
});

<div dangerouslySetInnerHTML={{ __html: sanitizedContent }} />
```

**Install:**

```bash
npm install dompurify
npm install --save-dev @types/dompurify
```

---

## 🟠 VYSOKÉ (Fix Soon)

### 3. **Žiadny Content Security Policy (CSP)**

**Riziko:** XSS, clickjacking, code injection  
**Problém:** Stránka nemá CSP headers

**Riešenie - Netlify:**
Vytvor `public/_headers`:

```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.emailjs.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://api.emailjs.com; frame-ancestors 'none';
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()
```

---

### 4. **Rate Limiting len na frontend**

**Súbor:** `src/services/submission-limits.ts`  
**Riziko:** Ľahko obíditeľné (clear localStorage)  
**Problém:**

```typescript
// Útočník môže jednoducho:
localStorage.removeItem("unotop:submission_count");
localStorage.removeItem("unotop:last_submission");
```

**Riešenie:**

- Backend rate limiting (Netlify Functions + KV store alebo Supabase)
- IP-based throttling
- CAPTCHA pre každý submit (už máte, ale overujete len na FE)

**Dočasné zlepšenie:**

```typescript
// Kombinuj localStorage + sessionStorage + cookie
const getSubmitCount = () => {
  const ls = parseInt(localStorage.getItem("unotop:submission_count") || "0");
  const ss = parseInt(sessionStorage.getItem("unotop:submission_count") || "0");
  return Math.max(ls, ss); // Použiť vyššiu hodnotu
};
```

---

### 5. **CAPTCHA validácia len na frontend**

**Súbor:** `src/BasicLayout.tsx:507`  
**Riziko:** Útočník môže modifikovať JS kód  
**Problém:**

```typescript
if (formData.captchaAnswer !== "4") {
  // Útočník môže:
  // 1. Modifikovať kód v DevTools
  // 2. Poslať POST request priamo na API
  // 3. Ignorovať toto
}
```

**Riešenie:**

- Backend validácia CAPTCHA (napr. hCaptcha, reCAPTCHA v3)
- Alebo aspoň send CAPTCHA answer do EmailJS šablóny a manually review

---

## 🟡 STREDNÉ (Good to Have)

### 6. **Honeypot pole je viditeľné v DOM**

**Súbor:** `src/BasicLayout.tsx:1070-1090`  
**Riziko:** Sofistikovaný bot ho môže detekovať  
**Problém:**

```tsx
<input
  type="text"
  name="website"
  style={{ position: "absolute", left: "-9999px" }}
/>
```

- Sofistikovaný bot vie, že pole s `left: -9999px` je honeypot

**Zlepšenie:**

```tsx
<div
  style={{
    opacity: 0,
    position: "absolute",
    top: 0,
    left: 0,
    height: 0,
    width: 0,
    zIndex: -1,
  }}
  aria-hidden="true"
>
  <input
    type="text"
    name="company_website"
    tabIndex={-1}
    autoComplete="off"
    value={formData.honeypot}
    onChange={(e) => setFormData({ ...formData, honeypot: e.target.value })}
  />
</div>
```

---

### 7. **localStorage sa používa pre citlivé dáta**

**Súbor:** `src/persist/v3.ts`  
**Riziko:** XSS môže čítať localStorage  
**Problém:**

- Ak by útočník vložil XSS, môže ukradnúť všetky user data
- localStorage nie je šifrovaný

**Riešenie:**

- Pre citlivé dáta používaj **sessionStorage** (mazané pri zatvorení tabu)
- Alebo IndexedDB s encryption
- NIKDY neukládaj heslá, tokeny do localStorage

**Aktuálny stav:** ✅ OK - ukládaš len finančné plánovacie dáta (nie PII)

---

### 8. **Žiadna HTTPS enforcia v kóde**

**Riziko:** Man-in-the-middle attack

**Riešenie - Netlify:**
V `netlify.toml`:

```toml
[[redirects]]
  from = "http://unotop.netlify.app/*"
  to = "https://unotop.netlify.app/:splat"
  status = 301
  force = true
```

---

## ✅ DOBRÉ PRAKTIKY (Already Implemented)

1. ✅ **Honeypot field** - bot detection
2. ✅ **GDPR consent** - user must check
3. ✅ **Email/phone validation** - regex patterns
4. ✅ **CAPTCHA** - simple math (ale len FE)
5. ✅ **No `eval()`** - žiadne nebezpečné funkcie
6. ✅ **No inline event handlers** - používaš React onClick
7. ✅ **No user-supplied data in dangerouslySetInnerHTML** - len statický SK text

---

## 📋 ACTION PLAN (Priority Order)

### Immediate (Dnes/Zajtra)

1. ✅ **Move EmailJS credentials to .env** ← KRITICKÉ
2. ✅ **Enable EmailJS rate limiting** in dashboard
3. ✅ **Add CSP headers** via Netlify `_headers`

### This Week

4. ✅ **Install DOMPurify** a sanitizuj PrivacyModal HTML
5. ✅ **Improve honeypot hiding**
6. ✅ **Add HTTPS redirect** in netlify.toml

### Next Sprint

7. 🔄 **Backend rate limiting** (Netlify Functions)
8. 🔄 **Server-side CAPTCHA** (hCaptcha/reCAPTCHA)
9. 🔄 **Security headers test** (securityheaders.com)

---

## 🛡️ ODPORÚČANIA PRE DEPLOYMENT

### Netlify Setup

```toml
# netlify.toml
[build]
  publish = "dist"
  command = "npm run build"

[build.environment]
  NODE_VERSION = "18"

[[headers]]
  for = "/*"
  [headers.values]
    X-Frame-Options = "DENY"
    X-Content-Type-Options = "nosniff"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Permissions-Policy = "geolocation=(), microphone=(), camera=()"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[[redirects]]
  from = "http://unotop.netlify.app/*"
  to = "https://unotop.netlify.app/:splat"
  status = 301
  force = true
```

### .gitignore (Ensure these are ignored)

```
.env
.env.local
.env.production
*.log
dist/
node_modules/
```

---

## 🔥 DDoS Protection

**Problém:** Ak útočník spamuje form submissions → EmailJS limit vyčerpaný

**Riešenie:**

1. **Netlify Rate Limiting** (Enterprise plan alebo Cloudflare)
2. **EmailJS Dashboard:**
   - Limit: 100-200 emails/deň
   - Auto-block pri >50 emails/hodinu
   - Whitelisted domains only
3. **Frontend debouncing:**

```typescript
let lastSubmit = 0;
const SUBMIT_COOLDOWN = 5000; // 5s between submits

if (Date.now() - lastSubmit < SUBMIT_COOLDOWN) {
  alert("Príliš rýchle pokusy. Počkajte 5 sekúnd.");
  return;
}
lastSubmit = Date.now();
```

---

## 📊 RISK SCORE

| Kategória               | Score | Status                   |
| ----------------------- | ----- | ------------------------ |
| **Credential Security** | 2/10  | 🔴 Hardcoded credentials |
| **XSS Protection**      | 6/10  | 🟠 DOMPurify chýba       |
| **CSRF Protection**     | 8/10  | ✅ EmailJS má built-in   |
| **Rate Limiting**       | 4/10  | 🟠 Len frontend          |
| **Data Privacy**        | 9/10  | ✅ GDPR OK               |
| **Input Validation**    | 8/10  | ✅ Regex patterns OK     |

**Overall:** 🟠 **6.2/10** - Needs immediate attention

---

## 📞 KONTAKT PRE INCIDENT RESPONSE

Ak zistíš aktívny útok:

1. Disable EmailJS service v dashboarde
2. Clear localStorage na `unotop.netlify.app`
3. Check EmailJS logs pre spam patterns
4. Report abuse to Netlify support

---

**Pripravil:** GitHub Copilot Security Audit  
**Reviewed:** Pending (odporúčam review od security experta)
