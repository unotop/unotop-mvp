# PR-23 DIAGNOSTICKÝ REPORT - Netlify Function nefunguje

## Symptómy
- ❌ Po odoslaní formuláru sa otvára Outlook (mailto fallback)
- ❌ Netlify Function sa nevolá
- ❌ ShareSuccessModal sa nezobrazuje (lebo outlook redirect preruší flow)

## Implementované zmeny
### Backend ✅
- `netlify/functions/send-projection.ts` - complete implementation
  - Rate limiting (5 req/h per IP)
  - CORS headers (všetky responses + OPTIONS preflight)
  - Development mode: povolené všetky localhost porty
  - Input validation
  - Dual email (internal + confirmation)

### Frontend ✅
- `src/services/email.service.ts`:
  ```typescript
  const response = await fetch('/.netlify/functions/send-projection', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  ```
- `src/BasicLayout.tsx`: zjednodušený email flow

### Development Setup ✅
- Netlify Dev beží: http://localhost:52750
- Function loaded: `⬥ Loaded function send-projection`
- Env vars: načítané z `.env` (EMAILJS_*)

## Možné príčiny

### 1. FETCH PATH PROBLÉM (najpravdepodobnejšie)
**Hypotéza:** V dev mode Netlify Dev proxuje functions na inú cestu.

**Test:**
- Frontend fetch: `/.netlify/functions/send-projection`
- Actual path v Netlify Dev: možno `/.netlify/functions-serve/send-projection`?
- Alebo: proxy nemusí fungovať správne

**Fix návrhy:**
1. Zmeniť fetch path na relatívnu: `functions/send-projection` (bez `/.netlify/`)
2. Použiť env variable pre path:
   ```typescript
   const FUNCTION_URL = import.meta.env.DEV 
     ? '/api/send-projection'  // vite proxy
     : '/.netlify/functions/send-projection';
   ```
3. Pridať Vite proxy config do `vite.config.ts`:
   ```typescript
   server: {
     proxy: {
       '/api': {
         target: 'http://localhost:52750/.netlify/functions',
         changeOrigin: true,
         rewrite: (path) => path.replace(/^\/api/, ''),
       }
     }
   }
   ```

### 2. CORS PROBLÉM
**Hypotéza:** Origin header chýba alebo je nesprávny.

**Test:** Browser console by mal ukázať CORS error (napr. "No 'Access-Control-Allow-Origin' header").

**Debug:**
- Otvoriť DevTools → Network tab
- Sledovať POST request na `/.netlify/functions/send-projection`
- Skontrolovať:
  - Request headers (Origin)
  - Response status (403 = CORS blocked)
  - Response headers (Access-Control-Allow-Origin)

### 3. NETLIFY DEV PROXY ZLYHÁ
**Hypotéza:** Vite dev server beží na porte 5175, ale Netlify Dev beží na 52750. Frontend robí fetch na 5175, kde nie je proxy.

**Test:**
- Skontrolovať browser URL: ak je `localhost:5175`, fetch ide na 5175 (nie 52750)
- Netlify Dev by mal proxovať Vite server, nie naopak

**Fix:**
- Používať iba Netlify Dev URL: http://localhost:52750
- Zastaviť priame Vite servery (porty 5173, 5174, 5175)

### 4. FUNCTION BUILD PROBLÉM
**Hypotéza:** TypeScript nie je zkompilovaný pre runtime.

**Test:**
- Skontrolovať či `.netlify/functions-serve/send-projection/` existuje
- Pozrieť logy v Netlify Dev terminali (mala by byť správa o compile error)

## Diagnostické kroky (pre usera)

### Krok 1: Skontroluj browser console
1. Otvor http://localhost:52750
2. Otvor DevTools (F12) → Console tab
3. Vyplň formulár a odošli
4. Skopíruj všetky error správy (červené texty)

**Hľadaj:**
- `CORS error`
- `Failed to fetch`
- `404 Not Found`
- `403 Forbidden`
- Akékoľvek chyby od `[EmailService]`

### Krok 2: Skontroluj Network tab
1. DevTools → Network tab
2. Filter: `send-projection`
3. Odošli formulár
4. Pozri sa na request:
   - **URL:** Mala by byť `http://localhost:52750/.netlify/functions/send-projection`
   - **Method:** POST
   - **Status:** ???
   - **Response:** ???

**Ak request chýba úplne** = fetch sa nevolá → problém v `email.service.ts`

**Ak status 404** = nesprávna cesta

**Ak status 403** = CORS problém

**Ak status 500** = server error (pozrieť Netlify Dev logy)

### Krok 3: Skontroluj Netlify Dev logy
V terminali kde beží `npm run dev` hľadaj:
```
[Netlify Function] Request received: { method: 'POST', origin: '...', isDev: true }
```

**Ak táto správa chýba** = function sa nevolá

### Krok 4: Test priameho volania cURL
Otestuj function priamo (bypass frontend):

```powershell
curl -X POST http://localhost:52750/.netlify/functions/send-projection `
  -H "Content-Type: application/json" `
  -H "Origin: http://localhost:52750" `
  -d '{
    "user": {"firstName":"Test","lastName":"User","email":"test@example.com","phone":"0900123456"},
    "projection": {"lumpSumEur":1000,"monthlyVklad":100,"horizonYears":10,"goalAssetsEur":50000,"futureValue":30000,"progressPercent":60,"yieldAnnual":0.05,"mix":[{"key":"gold","pct":10}],"deeplink":"#test"},
    "metadata": {},
    "recipients": ["test@example.com"]
  }'
```

**Očakávaný result:** JSON response `{"success":true,"message":"Projection sent successfully"}`

**Ak funguje** = problém je vo frontende (fetch path / headers)

**Ak nefunguje** = problém v Netlify Function (env vars / EmailJS credentials)

## Quick Fix Attempt (pre Copilot)

### Varianta A: Vite Proxy
Pridať do `vite.config.ts`:
```typescript
server: {
  proxy: {
    '/.netlify/functions': {
      target: 'http://localhost:8888',  // Netlify Dev default port
      changeOrigin: true,
    }
  }
}
```

### Varianta B: Direct URL
Zmeniť `email.service.ts`:
```typescript
const NETLIFY_DEV_URL = 'http://localhost:52750';  // hardcoded pre testing
const response = await fetch(`${NETLIFY_DEV_URL}/.netlify/functions/send-projection`, {
  method: 'POST',
  mode: 'cors',  // explicit CORS
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
});
```

### Varianta C: Fallback na EmailJS client-side (dočasne)
Ak Netlify Function nefunguje v dev mode, dočasne obnoviť client-side EmailJS pre testing:
```typescript
// TEMP: Development fallback
if (import.meta.env.DEV) {
  // Use old client-side EmailJS (credentials still in .env.local)
  const emailjs = await import('@emailjs/browser');
  // ... old implementation
} else {
  // Production: use Netlify Function
  const response = await fetch('/.netlify/functions/send-projection', ...);
}
```

## Odporúčanie pre Advisora

**Otázka:**
"Netlify Function je implementovaná a loaded v Netlify Dev, ale frontend fetch zlyhá a padá na mailto fallback. Možné príčiny:
1. Fetch path `/.netlify/functions/send-projection` nefunguje v dev mode
2. Vite dev server (port 5175) nevie proxovať na Netlify Dev (port 52750)
3. CORS headers sú OK, ale Origin header chýba v requeste

Aká je best practice pre lokálny development s Netlify Functions + Vite? Potrebujem Vite proxy config alebo iný approach?"

**Pripojené info:**
- `netlify dev` beží OK, function loaded
- Frontend fetch kód: [ukázať email.service.ts snippet]
- Browser console errors: [user doplní po Kroku 1]
- Network tab status: [user doplní po Kroku 2]

---

**Status:** BLOCKED - potrebujem user diagnostiku (Console + Network tab) alebo Advisor guidance.
