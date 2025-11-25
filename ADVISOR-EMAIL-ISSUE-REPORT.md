# 🚨 Kritický problém: Emailová projekcia nefunguje

## Symptómy

- Klient odošle projekciu cez formulár
- Klientovi **NEpríde email** (konfirmácia)
- Agentovi **NEpríde email** (notifikácia s projekciou)
- Chyba NIE JE viditeľná v UI (formulár hlási úspech, ale reálne zlyháva)

## Root Cause

**Netlify Environment Variables nie sú nastavené** → EmailJS API nemá credentials → zlyhá server-side odoslanie.

## Technické detaily

### Funkcia: `netlify/functions/send-projection.ts`

Táto serverless funkcia volá EmailJS REST API na odoslanie 2 emailov:

1. **Internal email** (pre agenta) - projekcia + kontakt klienta
2. **Confirmation email** (pre klienta) - "Ďakujeme, kontaktujeme vás"

### Chýbajúce env variables v Netlify UI:

```bash
EMAILJS_SERVICE_ID = ""                    # ❌ PRÁZDNE
EMAILJS_INTERNAL_TEMPLATE_ID = ""          # ❌ CHÝBA úplne (nie je ani v netlify.toml)
EMAILJS_CONFIRMATION_TEMPLATE_ID = ""      # ❌ PRÁZDNE
EMAILJS_PUBLIC_KEY = ""                    # ❌ PRÁZDNE
EMAILJS_PRIVATE_KEY = ""                   # ❌ PRÁZDNE (optional, ale odporúčané pre server-side)
```

### Kde nastaviť (Netlify Dashboard):

1. **Otvor**: https://app.netlify.com/sites/unotop-mvp/settings/deploys#environment
2. **Sekcia**: "Environment variables"
3. **Pridaj** každú premennú s hodnotou z EmailJS dashboard

### Kde získať hodnoty (EmailJS):

1. **Login**: https://dashboard.emailjs.com/admin
2. **Service ID**: https://dashboard.emailjs.com/admin/integration
3. **Template IDs**: https://dashboard.emailjs.com/admin/templates
   - **INTERNAL** template (pre agenta) - obsahuje kontakt klienta + projekciu
   - **CONFIRMATION** template (pre klienta) - "Ďakujeme, kontaktujeme vás"
4. **Public Key**: https://dashboard.emailjs.com/admin/account
5. **Private Key**: https://dashboard.emailjs.com/admin/account (tab "API Keys")

---

## Kontrolný checklist pre advisora

### 1. Skontroluj EmailJS Templates

Potrebujeme **2 šablóny**:

#### A) Internal Template (pre agenta)

- **Meno**: napr. "Projection to Agent"
- **ID**: napr. `template_xyz123` → uložiť do `EMAILJS_INTERNAL_TEMPLATE_ID`
- **Premenné** v šablóne (musí obsahovať):
  ```
  {{user_firstName}}
  {{user_lastName}}
  {{user_email}}
  {{user_phone}}
  {{projection_lumpSumEur}}
  {{projection_monthlyVklad}}
  {{projection_horizonYears}}
  {{projection_futureValue}}
  {{projection_yieldAnnual}}
  {{projection_deeplink}}
  {{bonuses_html}}  // HTML formatted bonuses
  ```

#### B) Confirmation Template (pre klienta)

- **Meno**: napr. "Confirmation to Client"
- **ID**: napr. `template_abc456` → uložiť do `EMAILJS_CONFIRMATION_TEMPLATE_ID`
- **Premenné** v šablóne:
  ```
  {{user_firstName}}
  ```
- **Text**: jednoduché "Ďakujeme, kontaktujeme vás do 24h"

### 2. Nastav Environment Variables v Netlify

**Netlify Dashboard → Site settings → Environment variables**

```bash
# Z EmailJS Integration page
EMAILJS_SERVICE_ID = "service_xxxxxx"

# Z EmailJS Templates (2 templates)
EMAILJS_INTERNAL_TEMPLATE_ID = "template_internal_xyz"
EMAILJS_CONFIRMATION_TEMPLATE_ID = "template_confirm_abc"

# Z EmailJS Account page
EMAILJS_PUBLIC_KEY = "xxxxxxxxxxxxxxxxxx"
EMAILJS_PRIVATE_KEY = "yyyyyyyyyyyyyyyyyyyy"  # Optional ale odporúčané
```

**DÔLEŽITÉ:**

- Po nastavení env vars **redeploy site** (Netlify → Deploys → Trigger deploy)
- Environment variables sa načítajú len pri novom deploye (nie live reload)

### 3. Overenie funkcionality

Po nastavení env vars + redeploy:

1. Otvor app: https://unotop-mvp.netlify.app
2. Vyplň projekciu
3. Klikni "Odoslať projekciu agentovi"
4. **Skontroluj**:
   - ✅ Klientovi príde confirmation email (check spam)
   - ✅ Agentovi príde internal email s projekciou

### 4. Debugging (ak stále nefunguje)

**Netlify Function Logs:**

```
Netlify Dashboard → Functions → send-projection → Logs
```

Hľadaj chyby typu:

- `Missing required credentials: EMAILJS_SERVICE_ID`
- `EmailJS API failed: 401 Unauthorized`
- `EmailJS API failed: 400 Bad Request`

**EmailJS Logs:**

```
EmailJS Dashboard → Email history
```

Skontroluj, či sa vôbec volá API (ak nie → problém v Netlify env vars).

---

## Fallback riešenie (ak EmailJS zlyhá)

Ak EmailJS nefunguje, môžeme prepnúť na **Resend API** (profesionálnejšie):

1. **Vytvor účet**: https://resend.com
2. **Verifikuj doménu**: unotop.sk (alebo použiť Resend domain)
3. **Získaj API key**
4. **Zmeň Netlify function** na volanie Resend API (už máme kód v `api/send-projection.ts`)

Resend výhody:

- ✅ Delivery rate 99.9%
- ✅ Email tracking & analytics
- ✅ HTML emails s attachments
- ✅ Free tier: 3000 emails/month

---

## Akcie (priority)

### 🔴 CRITICAL (urob HNEĎ)

1. Nastav `EMAILJS_INTERNAL_TEMPLATE_ID` v Netlify (chybá úplne!)
2. Nastav ostatné env vars (`EMAILJS_SERVICE_ID`, `EMAILJS_PUBLIC_KEY`, atď.)
3. Trigger Netlify redeploy

### 🟡 MEDIUM (po critical fix)

4. Otestuj odoslanie projekcie (E2E test)
5. Skontroluj EmailJS usage limits (free tier: 200 emails/month)

### 🟢 LOW (budúcnosť)

6. Zvážiť migráciu na Resend API (lepšia deliverability)
7. Pridať client-side error handling (zobraziť chybu, ak email zlyhá)

---

## Kontakt pre otázky

Ak niečo nie je jasné alebo potrebuješ detailnejší walkthrough:

- Screenshot Netlify env vars setup
- Screenshot EmailJS template setup
- Live debugging cez Netlify function logs

---

## Súvisiace súbory

- **Netlify funkcia**: `netlify/functions/send-projection.ts` (LINE 215-225 - env vars check)
- **Config**: `netlify.toml` (LINE 14-20 - env vars placeholder)
- **Frontend**: `src/features/share/ShareModal.tsx` (volá `/.netlify/functions/send-projection`)
- **Vercel verzia** (backup): `api/send-projection.ts` (používa Resend API)

---

**Status**: 🚨 **BLOCKER** - produkčná funkcionalita úplne nefunguje

**ETA fix**: 10-15 min (po nastavení env vars + redeploy)
