# Netlify Environment Variables - EmailJS Setup

## Problém

Formulár "Odoslať projekciu" nefunguje na Netlify - emaily nechodia.

## Príčina

Netlify nemá EmailJS credentials v environment variables.

## Riešenie

### 1. Vojdi do Netlify Dashboard

- Choď na https://app.netlify.com/
- Prihlás sa
- Vyber site: **unotop** (alebo presný názov tvojej site)

### 2. Otvor Environment Variables

- Klikni na site
- Ľavé menu: **Site configuration** → **Environment variables**

### 3. Pridaj 3 premenné

**Premenná 1:**

- Key: `VITE_EMAILJS_SERVICE_ID`
- Value: `service_r2eov4s`
- Klikni **Add variable**

**Premenná 2:**

- Key: `VITE_EMAILJS_TEMPLATE_ID`
- Value: `template_bmcskm8`
- Klikni **Add variable**

**Premenná 3:**

- Key: `VITE_EMAILJS_CONFIRMATION_TEMPLATE_ID`
- Value: `template_xxxxx` *(vytvor nový template v EmailJS pre klientov - PR-21)*
- Klikni **Add variable**

**Premenná 4:**

- Key: `VITE_EMAILJS_PUBLIC_KEY`
- Value: `1hx6DPz-diYTb9Bzf`
- Klikni **Add variable**

### 4. Trigger Redeploy

Po pridaní všetkých 4 premenných:

- Ľavé menu: **Deploys**
- Pravý horný roh: **Trigger deploy** → **Deploy site**

### 5. Test

Po deployi (1-2 min):

1. Otvor https://unotop.netlify.app
2. Vyplň formulár "Odoslať projekciu"
3. Odošli
4. Skontroluj email: **info.unotop@gmail.com** a **adam.belohorec@universal.sk**

## Poznámky

- Lokálne funguje (credentials sú v `.env.local`)
- Netlify potrebuje env vars nastavené cez UI
- Po pridaní vars MUSÍŠ triggerovať redeploy
- Credentials NIKDY necommituj do gitu
