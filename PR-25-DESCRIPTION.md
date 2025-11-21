# PR-25: Fix Client Confirmation Email + reCAPTCHA Feature Flag

## 🎯 Cieľ

**Oprava kritických produkčných bugov:**

1. **Client confirmation emails** nie sú doručované (users reportovali missing emails)
2. **Win11 Tracking Prevention** spôsobuje console spam pri reCAPTCHA load
3. **BASIC mode (0.9.0)** nemá potrebovať reCAPTCHA (honeypot + rate limit stačí)

---

## 📋 Zmenené súbory

### 1. `netlify/functions/send-projection.ts`

**Zmeny:**

- ✅ Rename `EMAILJS_TEMPLATE_ID` → `EMAILJS_INTERNAL_TEMPLATE_ID` (clarity)
- ✅ Add `EMAILJS_CONFIRMATION_TEMPLATE_ID` (separate client email template)
- ✅ **Hard requirement**: Internal email (500 error if missing)
- ✅ **Soft requirement**: Confirmation email (warn if missing, don't fail request)
- ✅ Add `ENABLE_RECAPTCHA` flag (skip verification if `false`)
- ✅ Enhanced logging:
  ```typescript
  console.log("[EmailService] Internal email sent OK");
  console.log("[EmailService] Client confirmation email sent OK to", email);
  console.warn("[EmailService] Client confirmation email failed:", error);
  ```
- ✅ Return `clientConfirmation` status in response body (`sent` | `failed` | `skipped`)

**Dôvod:**

- Users reportovali že confirmation emails neprichádzajú
- Root cause: Template ID nebol explicitne definovaný/missing v env vars
- Fix: Jasné rozdelenie internal (critical) vs confirmation (optional)

---

### 2. `.env.local.example`

**Zmeny:**

- ✅ Jasné sekcie: **SERVER-SIDE** (bez `VITE_` prefixu) vs **CLIENT-SIDE** (deprecated)
- ✅ Add `ENABLE_RECAPTCHA` + `VITE_ENABLE_RECAPTCHA` flags (default: `false`)
- ✅ Dokumentácia template IDs:

  ```bash
  # Internal email template (to agents) - CRITICAL (hard requirement)
  EMAILJS_INTERNAL_TEMPLATE_ID=template_bmcskm8

  # Client confirmation email template - OPTIONAL (soft requirement)
  EMAILJS_CONFIRMATION_TEMPLATE_ID=template_xxxxx
  ```

**Dôvod:**

- Developer confusion medzi client-side a server-side credentials
- reCAPTCHA má byť OFF v BASIC mode (version 0.9.0)

---

### 3. `index.html`

**Zmeny:**

- ✅ Add `id="recaptcha-script"` to script tag (for dynamic removal)
- ✅ Comment: "PR-25: reCAPTCHA v3 - CONDITIONAL loading"

**Dôvod:**

- Umožniť dynamické odstránenie scriptu cez `main.tsx` ak je reCAPTCHA disabled

---

### 4. `src/main.tsx`

**Zmeny:**

- ✅ Check `VITE_ENABLE_RECAPTCHA` flag at boot
- ✅ If `false`: Remove `#recaptcha-script` + hide `.grecaptcha-badge`
- ✅ Logging:
  ```typescript
  console.log("[reCAPTCHA] Script removed (VITE_ENABLE_RECAPTCHA=false)");
  ```

**Dôvod:**

- Win11 Tracking Prevention blokuje reCAPTCHA → console spam
- V BASIC mode nechceme load external scripts ak nie sú potrebné

---

### 5. `src/hooks/useReCaptcha.ts`

**Zmeny:**

- ✅ Check `VITE_ENABLE_RECAPTCHA !== "false"` at hook init
- ✅ If disabled: Skip `grecaptcha.ready()` check, return `isReady=false`
- ✅ `execute()` returns empty string `""` if disabled (graceful degradation)
- ✅ Logging:
  ```typescript
  console.log("[reCAPTCHA] Disabled via VITE_ENABLE_RECAPTCHA flag");
  console.log("[reCAPTCHA] Execution skipped (disabled)");
  ```

**Dôvod:**

- Graceful degradation ak je reCAPTCHA vypnutá
- No console errors, clean logs

---

## ✅ Akceptačné kritériá

### Email Flow (kritické)

- [ ] **Internal email** odchádza na `info.unotop@gmail.com` + `adam.belohorec@universal.sk`
- [ ] **Client confirmation email** odchádza na email zadaný vo formulári
- [ ] Netlify Function logs ukazujú:
  ```
  [EmailService] Internal email sent OK
  [EmailService] Client confirmation email sent OK to client@example.com
  ```
- [ ] Ak `EMAILJS_CONFIRMATION_TEMPLATE_ID` chýba → warn log, ale request prejde (200 OK)
- [ ] Ak `EMAILJS_INTERNAL_TEMPLATE_ID` chýba → 500 error, abort

### reCAPTCHA Feature Flag

- [ ] **BASIC mode** (`VITE_ENABLE_RECAPTCHA=false`):
  - Script tag `#recaptcha-script` je removed z DOM
  - Badge `.grecaptcha-badge` je hidden
  - Console log: `[reCAPTCHA] Script removed (VITE_ENABLE_RECAPTCHA=false)`
  - Žiadne Tracking Prevention errors v konzole
  - Form submission funguje (honeypot + rate limit protection)

- [ ] **PRO mode** (`VITE_ENABLE_RECAPTCHA=true`):
  - Script sa načíta normálne
  - reCAPTCHA token sa generuje
  - Badge je viditeľný (alebo hidden cez CSS, podľa privacy policy)

### Build & TypeScript

- [x] `npm run build` → PASS (no compile errors)
- [x] ESLint → PASS (no linting errors)

---

## 🧪 QA scenáre

### Scenár 1: Email delivery (lokálne + Netlify)

**Kroky:**

1. Nastav lokálne `.env.local`:
   ```bash
   EMAILJS_SERVICE_ID=service_r2eov4s
   EMAILJS_INTERNAL_TEMPLATE_ID=template_bmcskm8
   EMAILJS_CONFIRMATION_TEMPLATE_ID=<real_template_id>  # Adam poskytne
   EMAILJS_PUBLIC_KEY=1hx6DPz-diYTb9Bzf
   EMAILJS_PRIVATE_KEY=<secret>
   ENABLE_RECAPTCHA=false
   VITE_ENABLE_RECAPTCHA=false
   ```
2. Run `npm run dev`
3. Vyplň formulár ShareModal, odošli projekciu
4. **Expected:**
   - Console log: `[EmailService] Internal email sent OK`
   - Console log: `[EmailService] Client confirmation email sent OK to ...`
   - Internal email prišiel na `info.unotop@gmail.com`
   - Confirmation email prišiel na zadaný client email

**Netlify:**

1. Nastav Netlify env vars (Site settings → Environment variables):
   - `EMAILJS_SERVICE_ID`
   - `EMAILJS_INTERNAL_TEMPLATE_ID`
   - `EMAILJS_CONFIRMATION_TEMPLATE_ID`
   - `EMAILJS_PUBLIC_KEY`
   - `EMAILJS_PRIVATE_KEY`
   - `ENABLE_RECAPTCHA=false`
   - `VITE_ENABLE_RECAPTCHA=false`
2. Deploy branch `fix/email-confirmation-and-recaptcha`
3. Test na production URL
4. Check Netlify Function logs pre `[EmailService]` entries

---

### Scenár 2: reCAPTCHA OFF (Win11 Edge Tracking Prevention)

**Kroky:**

1. Set `VITE_ENABLE_RECAPTCHA=false` v Netlify env vars
2. Open app na Win11 + Edge (Tracking Prevention = Balanced/Strict)
3. Open Developer Console (F12)
4. Odošli projekciu

**Expected:**

- ✅ Žiadne `Tracking Prevention blocked access...` errors
- ✅ Žiadne `Failed to "removeChild"` errors
- ✅ Console log: `[reCAPTCHA] Script removed (VITE_ENABLE_RECAPTCHA=false)`
- ✅ Form submission funguje (honeypot + rate limit active)

---

### Scenár 3: reCAPTCHA ON (PRO mode, budúca verzia)

**Kroky:**

1. Set `VITE_ENABLE_RECAPTCHA=true` v env vars
2. Reload app
3. Odošli projekciu

**Expected:**

- ✅ Script sa načíta: `https://www.google.com/recaptcha/api.js?render=...`
- ✅ Console log: `[reCAPTCHA] Token generated: ...`
- ✅ Token je includnutý v API call (metadata.recaptchaToken)

---

## 🚨 Riziká & Rollback

### Riziko 1: Missing template ID v Netlify

**Problém:** Ak `EMAILJS_CONFIRMATION_TEMPLATE_ID` nie je nastavený v Netlify env vars  
**Impact:** Client confirmation emails nebudú odchádzať  
**Mitigácia:**

- Function loguje WARN: `[EmailService] EMAILJS_CONFIRMATION_TEMPLATE_ID missing – client emails disabled`
- Internal email stále funguje (kritický flow nie je broken)

**Rollback:** Set template ID v Netlify dashboard, redeploy (no code change needed)

---

### Riziko 2: reCAPTCHA script removal breaks existing flows

**Problém:** Ak script removal má bug, môže to ovplyvniť iné integrácie  
**Impact:** Low (reCAPTCHA je jediná third-party integrácia v index.html)  
**Mitigácia:**

- Script sa removne len ak `VITE_ENABLE_RECAPTCHA=false`
- Graceful fallback: `useReCaptcha` hook vráti empty token (`""`)
- Server akceptuje prázdny token ak `ENABLE_RECAPTCHA=false`

**Rollback:** Set `VITE_ENABLE_RECAPTCHA=true` v Netlify env vars → script ostane

---

### Riziko 3: EmailJS REST API quota exceeded

**Problém:** Free tier = 200 emails/month, môžeme presiahnuť  
**Impact:** Emails prestanú fungovať (403 error)  
**Mitigácia:**

- Rate limiting: 5 submissions/hour/IP (už implementované)
- Monitor EmailJS dashboard pre usage stats

**Rollback:** Upgrade EmailJS plan alebo temporárne znížiť rate limit

---

## 📊 Implementačné kroky (Completed ✅)

1. ✅ Create branch `fix/email-confirmation-and-recaptcha`
2. ✅ Refactor `send-projection.ts`:
   - Rename `EMAILJS_TEMPLATE_ID` → `EMAILJS_INTERNAL_TEMPLATE_ID`
   - Add `EMAILJS_CONFIRMATION_TEMPLATE_ID`
   - Add `ENABLE_RECAPTCHA` flag + verification skip
   - Enhanced logging
3. ✅ Update `.env.local.example` (server-side vs client-side sections)
4. ✅ Add `id="recaptcha-script"` to `index.html`
5. ✅ Update `main.tsx` (script removal logic)
6. ✅ Update `useReCaptcha.ts` (feature flag check)
7. ✅ Build verification: `npm run build` → PASS
8. ✅ Commit + push: `fix(email): client confirmation email + recaptcha feature flag`

---

## 📝 Next Steps (Post-Merge)

1. **Netlify env vars setup** (Adam to provide real template IDs):

   ```bash
   EMAILJS_SERVICE_ID=service_r2eov4s
   EMAILJS_INTERNAL_TEMPLATE_ID=template_bmcskm8
   EMAILJS_CONFIRMATION_TEMPLATE_ID=<real_template_id>
   EMAILJS_PUBLIC_KEY=1hx6DPz-diYTb9Bzf
   EMAILJS_PRIVATE_KEY=<secret>
   ENABLE_RECAPTCHA=false
   VITE_ENABLE_RECAPTCHA=false
   ```

2. **Manual testing** (after deploy):
   - Submit test projection
   - Verify internal email received
   - Verify client confirmation email received
   - Check Netlify Function logs

3. **Monitor production** (first 24h after deploy):
   - Check Netlify Function logs for `[EmailService]` entries
   - Monitor user feedback (missing emails?)
   - Check EmailJS dashboard for delivery stats

4. **Future improvement** (optional, Phase 2):
   - Add server-side reCAPTCHA verification (call Google API with `RECAPTCHA_SECRET_KEY`)
   - Add email delivery confirmation UI ("Email sent to your.email@...")
   - Add retry logic if EmailJS API fails (temporary network issues)

---

## 🏷️ Labels

- `bug` (fixes production issues)
- `security` (email delivery, anti-spam)
- `priority: high` (users reporting missing emails)

---

## 🔗 Related Issues

- User report: "Potvrdzovacie emaily neprichádzajú"
- User report: "Win11 Edge console spam (Tracking Prevention blocked access)"

---

**Ready for review & merge.**  
**Deploy blocking:** Need real `EMAILJS_CONFIRMATION_TEMPLATE_ID` from Adam.
