# ADVISOR REQUEST - Netlify Function Integration Issue

## Priority: HIGH - Blocking PR-23 Security Improvements

---

## Problem Statement

Netlify Function for server-side email handling is implemented and loaded, but **frontend fetch fails with ERR_CONNECTION_REFUSED**. This blocks all security improvements (hiding EmailJS credentials from client bundle).

---

## Current Implementation

### Backend (Netlify Function) ✅ WORKING

**File:** `netlify/functions/send-projection.ts`

```typescript
export const handler: Handler = async (event, context): Promise<HandlerResponse> => {
  console.log('[Netlify Function] Request received:', {
    method: event.httpMethod,
    origin: event.headers.origin,
    isDev: isDevelopment,
  });

  // CORS check
  const origin = event.headers.origin || "";
  const isOriginAllowed = ALLOWED_ORIGINS.includes(origin) ||
    (isDevelopment && origin.startsWith("http://localhost:"));

  if (!isOriginAllowed) {
    console.error('[Netlify Function] Forbidden origin:', origin);
    return { statusCode: 403, ... };
  }

  // OPTIONS preflight handler
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
      body: "",
    };
  }

  // Rate limiting (5 req/hour per IP)
  const ip = event.headers["x-forwarded-for"]?.split(",")[0] || "unknown";
  const rateLimit = checkRateLimit(ip);
  if (!rateLimit.allowed) return { statusCode: 429, ... };

  // Input validation
  const validation = validateProjectionData(data);
  if (!validation.valid) return { statusCode: 400, ... };

  // Send emails (internal + confirmation) via EmailJS
  await emailjs.send(...);

  return {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": origin,
      ...
    },
    body: JSON.stringify({ success: true, ... }),
  };
};
```

**Status:**

- ✅ Function compiles without errors
- ✅ Netlify Dev loads function: `⬥ Loaded function send-projection`
- ✅ Env vars injected: `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`, etc.
- ❌ **NO requests reach the function** (no console logs from function)

---

### Frontend (Fetch) ❌ FAILING

**File:** `src/services/email.service.ts`

```typescript
export async function sendProjectionEmail(data: ProjectionData): Promise<void> {
  const netlifyDevUrl =
    import.meta.env.VITE_NETLIFY_DEV_URL || "http://localhost:8888";
  const isDev = import.meta.env.DEV;

  const functionUrl = isDev
    ? `${netlifyDevUrl}/.netlify/functions/send-projection`
    : "/.netlify/functions/send-projection";

  console.log("[EmailService] Calling Netlify Function:", functionUrl);

  try {
    const response = await fetch(functionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    // ...
  } catch (error) {
    console.error("[EmailService] Failed to send projection:", error);
    throw error;
  }
}
```

**Status:**

- ✅ Code compiles without errors
- ✅ Console shows correct URL: `http://localhost:9999/.netlify/functions/send-projection`
- ❌ **fetch() fails with ERR_CONNECTION_REFUSED**
- ❌ Falls back to `sendViaMailto()` (opens Outlook)

---

### Development Environment

**Netlify Dev Config (`netlify.toml`):**

```toml
[dev]
  port = 9999
  targetPort = 5173  # Vite dev server port
  framework = "#custom"
  command = "npm run dev:vite"
```

**Environment Variables (`.env.local`):**

```bash
VITE_NETLIFY_DEV_URL=http://localhost:9999
```

**Terminal Output:**

```
⬥ Injected .env file env vars: EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, ...
⬥ Injected .env.local file env vars: VITE_EMAILJS_*, VITE_NETLIFY_DEV_URL
⬥ Starting #custom dev server
✔ #custom dev server ready on port 5173

   ╭─────────────────────── ⬥  ────────────────────────╮
   │   Local dev server ready: http://localhost:9999   │
   ╰───────────────────────────────────────────────────╯

⬥ Loaded function send-projection
```

**Browser Console Error:**

```
[EmailService] Calling Netlify Function: http://localhost:9999/.netlify/functions/send-projection
:9999/.netlify/functions/send-projection:1  Failed to load resource: net::ERR_CONNECTION_REFUSED
```

---

## What We've Tried

### Attempt 1: Relative Path

```typescript
fetch('/.netlify/functions/send-projection', ...)
```

❌ Result: 404 (path not found on Vite server port 5175)

### Attempt 2: Full URL with Dynamic Port

```typescript
const functionUrl = `http://localhost:${dynamicPort}/.netlify/functions/send-projection`;
```

❌ Result: Port changes on every restart (53755 → 54218 → 54897)

### Attempt 3: Fixed Port in netlify.toml

```toml
[dev]
  port = 9999
```

❌ Result: ERR_CONNECTION_REFUSED (current state)

### Attempt 4: CORS Headers

Added comprehensive CORS headers to all responses + OPTIONS preflight handler.
❌ Result: No change (request never reaches function)

---

## Diagnostics

### Network Tab Analysis

- **Request URL:** `http://localhost:9999/.netlify/functions/send-projection`
- **Status:** `(failed)` - net::ERR_CONNECTION_REFUSED
- **Type:** `fetch`
- **No request is actually sent** (fails before network layer)

### Key Observations

1. ✅ Netlify Dev IS running on port 9999
2. ✅ Function IS loaded by Netlify CLI
3. ✅ Frontend CAN reach http://localhost:9999 (page loads)
4. ❌ Frontend CANNOT reach http://localhost:9999/.netlify/functions/send-projection
5. ❌ **Function handler logs NEVER appear** (no requests reach backend)

### Hypothesis

**Netlify Dev proxy is not forwarding `/.netlify/functions/*` requests to the function runtime.**

Possible causes:

- `targetPort = 5173` might be incorrect (Vite restarts on 5177 due to port conflicts)
- `framework = "#custom"` might not enable function proxying
- Vite HMR server (5177) is not connected to Netlify Dev (9999)
- Function path might need different routing in dev mode

---

## Questions for Advisor

### Q1: Correct Netlify Dev Setup for Vite + Functions

**What is the proper `netlify.toml` config for:**

- Vite dev server (runs on dynamic port due to conflicts)
- Netlify Functions (must be accessible via `/.netlify/functions/*`)
- Fixed Netlify Dev port (9999)

Should we:

- A) Use `framework = "vite"` instead of `#custom`?
- B) Remove `targetPort` and let Netlify Dev start Vite directly?
- C) Use a different approach (e.g., `vite.config.ts` proxy)?

### Q2: Development vs Production URL Strategy

**Current approach:**

```typescript
const functionUrl = isDev
  ? `${process.env.VITE_NETLIFY_DEV_URL}/.netlify/functions/send-projection`
  : "/.netlify/functions/send-projection";
```

Is this correct, or should we:

- Use Vite proxy config to forward `/.netlify/functions/*` to Netlify Dev?
- Always use relative paths and fix the dev server routing?
- Use a different env var pattern?

### Q3: Function Proxying in Netlify Dev

**Expected behavior:**
When I visit `http://localhost:9999` → Netlify Dev proxies to Vite (5173/5177)
When I POST to `http://localhost:9999/.netlify/functions/send-projection` → Netlify Dev routes to function handler

**Current behavior:**

- Page load works ✅
- Function route fails ❌ (ERR_CONNECTION_REFUSED)

**Question:** Does Netlify Dev automatically proxy function requests, or do we need additional config?

---

## Desired Outcome

**Development:**

```
http://localhost:9999                              → Vite dev server (React app)
http://localhost:9999/.netlify/functions/*         → Netlify Functions runtime
```

**Production:**

```
https://unotop.netlify.app                         → Static build (dist/)
https://unotop.netlify.app/.netlify/functions/*    → Netlify Functions (serverless)
```

---

## Code References

**Repository:** unotop/unotop-mvp  
**Branch:** feat/security-hardening  
**Files:**

- `netlify/functions/send-projection.ts` (function implementation)
- `src/services/email.service.ts` (frontend fetch)
- `netlify.toml` (dev config)
- `.env.local` (VITE_NETLIFY_DEV_URL=http://localhost:9999)

**Commits:**

- `e91c2d3` - Initial Netlify Function implementation
- `4bca882` - CORS headers fix
- `bb7f2b0` - Dev URL with env var
- `7fdf9be` - Fixed port 9999

---

## Additional Context

This is **Task 1 of 8** in PR-23 (Security Hardening). Remaining tasks are blocked until Netlify Function works:

**Blocked Tasks:**

- Task 2: ReCAPTCHA v3 (needs function endpoint)
- Task 3: LocalStorage validation (independent)
- Task 4: Deeplink encryption (independent)
- Task 5: XSS audit (independent)
- Task 6: Security docs (needs completed implementation)
- Task 7: Testing (needs working function)
- Task 8: Commit & push (needs all tasks complete)

**Impact:**

- EmailJS credentials currently exposed in client bundle (security risk)
- Cannot implement server-side rate limiting
- Cannot validate inputs on server
- Cannot deploy to production safely

---

## Request

Please provide guidance on:

1. Correct `netlify.toml` configuration for Vite + Functions dev environment
2. Proper URL/proxy strategy for development vs production
3. Any missing setup steps for Netlify Dev function proxying

Thank you!

---

**Reported by:** GitHub Copilot Agent  
**Date:** 2025-01-20  
**Project:** UNOTOP MVP - Investment Projection Calculator
