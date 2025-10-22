# 📧 Email API Setup - Deployment Guide

## **Čo je implementované (frontend)**

1. ✅ **Formulár v ShareModal**:
   - Meno, Priezvisko, Email, Telefón
   - GDPR checkbox (povinný súhlas)
   - Validácie (všetky polia required)
   - Status messages (úspech/chyba)

2. ✅ **API call na `/api/send-projection`**:
   - POST request s JSON payload
   - Obsahuje: user data, projection data, recipients
   - Automaticky generuje deeplink

3. ✅ **Serverless function** (`api/send-projection.ts`):
   - Vercel/Netlify compatible
   - Validuje vstup
   - Odošle profesionálny HTML email cez Resend API
   - GDPR compliant (dáta sa neukládajú)

---

## **Ako to funguje (production workflow)**

```
User vyplní formulár → Submit
         ↓
Frontend: POST /api/send-projection
         ↓
Serverless function (Vercel/Netlify)
         ↓
Resend API → Email na info.unotop@gmail.com + adam.belohorec@universal.sk
         ↓
Success → Modal zobrazí ✅ "Projekcia bola úspešne odoslaná"
```

**Lokálne (development):**

- API endpoint zatím neexistuje → zobrazí sa chyba ❌
- Po deployi bude fungovať automaticky

---

## **Deployment Steps**

### **1. Registrácia na Resend.com**

1. Ísť na https://resend.com
2. Vytvoriť free účet (100 emailov/deň)
3. Verifikovať doménu (napr. `unotop.com`):
   - Settings → Domains → Add Domain
   - Pridať DNS záznamy (SPF, DKIM, DMARC)
   - Čakať na verifikáciu (~10 min)

4. Vytvoriť API Key:
   - Settings → API Keys → Create API Key
   - Skopírovať kľúč (zobrazí sa len raz!)

---

### **2. Nastavenie Vercel (ak deployment cez Vercel)**

#### **A) Lokálny .env (pre testing)**

Vytvoriť súbor `.env.local` v root:

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
```

**⚠️ NIKDY necommituj `.env.local` do gitu!**

Pridať do `.gitignore`:

```
.env.local
.env*.local
```

#### **B) Production env vars na Vercel**

1. Ísť na https://vercel.com/dashboard
2. Vybrať projekt `unotop-mvp`
3. Settings → Environment Variables
4. Pridať:
   - **Key:** `RESEND_API_KEY`
   - **Value:** `re_xxxxxxxxxxxxxxxxxxxx` (API key z Resend)
   - **Environment:** Production + Preview + Development
5. Redeploy projekt (Deployments → Redeploy)

---

### **3. Nastavenie Netlify (ak deployment cez Netlify)**

1. Ísť na https://app.netlify.com
2. Vybrať projekt
3. Site settings → Environment variables
4. Add variable:
   - **Key:** `RESEND_API_KEY`
   - **Value:** `re_xxxxxxxxxxxxxxxxxxxx`
5. Redeploy (Deploys → Trigger deploy)

---

### **4. Testovanie (po deployi)**

1. Otvoriť production URL (napr. `https://unotop-mvp.vercel.app`)
2. BASIC režim → Klik na "Zdieľať agentovi"
3. Vyplniť formulár:
   - Meno: Test
   - Priezvisko: Používateľ
   - Email: tvoj@email.sk
   - Telefón: +421 900 123 456
   - ✅ Súhlas GDPR
4. Klik "Odoslať projekciu"
5. Očakávané:
   - Modal zobrazí ✅ "Projekcia bola úspešne odoslaná"
   - Na `info.unotop@gmail.com` a `adam.belohorec@universal.sk` príde email

---

## **Zmena "from" emailu**

V `api/send-projection.ts` na riadku ~209:

```typescript
from: "Unotop MVP <noreply@unotop.com>", // ← Zmeniť na vlastnú doménu
```

**Možnosti:**

1. **S vlastnou doménou** (napr. `unotop.com`):

   ```typescript
   from: "Unotop Projekcie <projekcie@unotop.com>";
   ```

   → Vyzerá profesionálne, vyžaduje DNS setup

2. **Bez vlastnej domény** (Resend sandbox):
   ```typescript
   from: "onboarding@resend.dev";
   ```
   → Funguje okamžite, ale menej dôveryhodné (môže skončiť v spame)

---

## **GDPR Compliance**

✅ **Implementované opatrenia:**

1. **Explicitný súhlas**: Checkbox "Súhlasím so spracovaním..."
2. **Účel**: Jasne definovaný ("zaslanie projekcie agentovi")
3. **Žiadne ukládanie**: Dáta sa odosielajú len emailom, neukládajú sa do DB
4. **Tretie strany**: Jasne uvedené ("nebudú zdieľané s tretími stranami")
5. **Právo na informácie**: Email obsahuje zdroj ("odoslaný z formulára na stránke")

**Pre plnú GDPR compliance pridaj:**

- Link na Privacy Policy
- Možnosť odvolať súhlas (napr. kontaktný email)
- Data retention policy (ak by sa dáta niekedy ukládali)

---

## **Troubleshooting**

### **Problém: Email sa neodosiela (production)**

1. **Skontroluj Vercel logs:**

   ```bash
   vercel logs [deployment-url]
   ```

   Hľadaj: "RESEND_API_KEY not configured" alebo "Failed to send email"

2. **Skontroluj Resend dashboard:**
   - Logs → Pozri či prišiel request
   - Ak nie → problém vo frontend (neodosiela sa fetch)
   - Ak áno, ale failed → problém s API key alebo doménou

3. **Testuj API endpoint priamo:**
   ```bash
   curl -X POST https://unotop-mvp.vercel.app/api/send-projection \
     -H "Content-Type: application/json" \
     -d '{"user": {"firstName":"Test","lastName":"User","email":"test@example.com","phone":"+421900123456"}, "projection": {...}, "recipients": ["info.unotop@gmail.com"]}'
   ```

### **Problém: Email skončí v spame**

1. **Verifikuj doménu** v Resend (SPF, DKIM záznamy)
2. **Zmeň `from` email** na vlastnú doménu (nie `@resend.dev`)
3. **Pridaj `reply_to`** (už implementované: user email)
4. **Testuj spam score**: https://www.mail-tester.com

### **Problém: "CORS error" v konzole**

- API endpoint má CORS headers (už implementované)
- Ak problém pretrváva, skontroluj Vercel/Netlify rewrites config

---

## **Náklady (Resend pricing)**

- **Free tier**: 100 emailov/deň, 3000/mesiac
- **Pro**: $20/mesiac = 50,000 emailov
- **Unlimited**: Vlastná cena

Pre MVP je free tier dostačujúci.

---

## **Alternatívne riešenia (ak Resend nefunguje)**

1. **SendGrid**: https://sendgrid.com (free 100 emailov/deň)
   - Zmeniť API endpoint v `send-projection.ts`
   - Podobný setup ako Resend

2. **Nodemailer + Gmail SMTP**:
   - Jednoduchšie, ale menej robustné
   - Vyžaduje 2FA app password z Gmail

3. **Formspree**: https://formspree.io
   - Najjednoduchšie (žiadny backend)
   - Limitované na 50 submits/mesiac (free)

---

## **Súbory na commit**

```bash
git add api/send-projection.ts
git add src/BasicLayout.tsx
git add docs/EMAIL_API_SETUP.md
git commit -m "feat(share): GDPR-compliant email form + Resend API

- User form: Meno, Priezvisko, Email, Tel, GDPR checkbox
- Serverless endpoint: /api/send-projection (Vercel/Netlify)
- HTML email template with projection data + deeplink
- Recipients: info.unotop@gmail.com + adam.belohorec@universal.sk
- No data storage (GDPR compliant)

Setup required: RESEND_API_KEY env var"
```

---

## **Next Steps (po deployi)**

1. ✅ Test production email flow
2. ✅ Verifikuj že emaily prichádzajú na oba účty
3. ✅ Skontroluj spam folder (ak áno → SPF/DKIM setup)
4. 📄 Pridaj Privacy Policy page (pre GDPR)
5. 📊 (Optional) Google Analytics tracking pre submit event

---

**Otázky? Problémy?** Skontroluj Vercel logs alebo Resend dashboard.
