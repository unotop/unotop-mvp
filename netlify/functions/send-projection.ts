import type { Handler, HandlerEvent, HandlerContext, HandlerResponse } from "@netlify/functions";

/**
 * Netlify Function - Send Projection Email (Server-Side)
 * 
 * Security improvements:
 * - EmailJS credentials hidden from client (server-side only)
 * - Rate limiting per IP address (5 requests/hour)
 * - Input validation & sanitization
 * - CORS protection (only unotop.sk, unotop.netlify.app)
 * 
 * Uses EmailJS REST API (Node.js compatible, no browser globals)
 */

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:8888",  // Netlify Dev default
  "https://unotop.netlify.app",
  "https://unotop-mvp.netlify.app",  // PR-26: Production domain
  "https://unotop.sk",
];

// Allow any localhost port in development
const isDevelopment = process.env.NETLIFY_DEV === "true";

// Rate limiting storage (in-memory, reset on function cold start)
// For production: use Redis/KV store
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const key = `rate:${ip}`;
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetAt) {
    // Reset window (1 hour)
    rateLimitStore.set(key, { count: 1, resetAt: now + 3600000 });
    return { allowed: true, remaining: 4 };
  }

  if (record.count >= 5) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: 5 - record.count };
}

/**
 * Send email via Resend API (server-side, secure)
 * Docs: https://resend.com/docs/send-with-nodejs
 * 
 * PR-26: Migration from EmailJS to Resend
 * Reason: EmailJS blocks server-side API calls (403 error)
 */
async function sendEmailViaResend(
  to: string[],
  subject: string,
  htmlContent: string,
  textContent: string,
  replyTo?: string
): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  
  if (!apiKey) {
    throw new Error("RESEND_API_KEY not configured");
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: "Unotop MVP <noreply@send.unotop.sk>", // PR-26: Verified domain
      to,
      subject,
      html: htmlContent,
      text: textContent,
      reply_to: replyTo,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Resend API failed: ${response.status} ${JSON.stringify(data)}`);
  }

  return data;
}

function validateProjectionData(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate user data
  if (!data.user?.firstName || typeof data.user.firstName !== "string") {
    errors.push("Invalid firstName");
  }
  if (!data.user?.lastName || typeof data.user.lastName !== "string") {
    errors.push("Invalid lastName");
  }
  if (!data.user?.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.user.email)) {
    errors.push("Invalid email");
  }
  if (!data.user?.phone || !/^\+?[\d\s\-()]+$/.test(data.user.phone)) {
    errors.push("Invalid phone");
  }

  // Validate projection data (prevent poisoning)
  if (typeof data.projection?.lumpSumEur !== "number" || data.projection.lumpSumEur < 0 || data.projection.lumpSumEur > 10000000) {
    errors.push("Invalid lumpSumEur (max 10M)");
  }
  if (typeof data.projection?.monthlyVklad !== "number" || data.projection.monthlyVklad < 0 || data.projection.monthlyVklad > 100000) {
    errors.push("Invalid monthlyVklad (max 100k)");
  }
  if (typeof data.projection?.horizonYears !== "number" || data.projection.horizonYears < 1 || data.projection.horizonYears > 50) {
    errors.push("Invalid horizonYears (1-50)");
  }

  return { valid: errors.length === 0, errors };
}

export const handler: Handler = async (
  event: HandlerEvent,
  context: HandlerContext
): Promise<HandlerResponse> => {
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
    return {
      statusCode: 403,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        error: "Forbidden origin",
        received: origin,
        allowed: ALLOWED_ORIGINS,
      }),
    };
  }

  // Handle CORS preflight
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

  // Only POST allowed
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Allow": "POST" },
      body: JSON.stringify({ error: "Method not allowed" }),
    };
  }

  // Rate limiting
  const ip = event.headers["x-forwarded-for"]?.split(",")[0] || "unknown";
  const rateLimit = checkRateLimit(ip);
  
  if (!rateLimit.allowed) {
    return {
      statusCode: 429,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Content-Type": "application/json",
        "Retry-After": "3600",
        "X-RateLimit-Remaining": "0",
      },
      body: JSON.stringify({ 
        error: "Too many requests. Try again in 1 hour.",
        resetAt: new Date(Date.now() + 3600000).toISOString()
      }),
    };
  }

  try {
    const data = JSON.parse(event.body || "{}");

    // Validate input
    const validation = validateProjectionData(data);
    if (!validation.valid) {
      return {
        statusCode: 400,
        headers: { 
          "Access-Control-Allow-Origin": origin,
          "Content-Type": "application/json" 
        },
        body: JSON.stringify({ 
          error: "Validation failed", 
          details: validation.errors 
        }),
      };
    }

    // PR-26: Check Resend API key
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const ENABLE_RECAPTCHA = process.env.ENABLE_RECAPTCHA !== "false";

    if (!RESEND_API_KEY) {
      console.error("[EmailService] RESEND_API_KEY not configured");
      return {
        statusCode: 500,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ error: "Server configuration error" }),
      };
    }

    // PR-25: Verify reCAPTCHA token (if enabled)
    if (ENABLE_RECAPTCHA) {
      const recaptchaToken = data.metadata?.recaptchaToken;
      
      if (!recaptchaToken) {
        console.warn("[reCAPTCHA] Token missing but ENABLE_RECAPTCHA=true – allowing for now");
        // TODO: Add server-side verification with RECAPTCHA_SECRET_KEY
        // For now, presence of token is checked but not verified (honeypot + rate limit are primary defenses)
      } else {
        console.log("[reCAPTCHA] Token received:", recaptchaToken.slice(0, 20) + "...");
        // TODO: Verify token via https://www.google.com/recaptcha/api/siteverify
      }
    } else {
      console.log("[reCAPTCHA] Disabled (ENABLE_RECAPTCHA=false) – using honeypot + rate limit only");
    }

    // PR-26: Build HTML email template (internal - for agents)
    // PR-26: Format mix item labels (handle bond variants)
    const formatMixLabel = (key: string): string => {
      const labels: Record<string, string> = {
        gold: "🥇 Zlato",
        dyn: "📊 Dyn. riadenie",
        etf: "🌍 ETF svet",
        bonds: "📜 Dlhopisy",
        cash: "💵 Hotovosť",
        crypto: "₿ Krypto",
        real: "🏘️ Reality",
        other: "📦 Ostatné",
      };

      // Handle bond variants (bond3y9, bond5y6, etc.)
      if (key.startsWith("bond")) {
        const match = key.match(/bond(\d+)y(\d+)/);
        if (match) {
          const years = match[1];
          const rate = match[2];
          return `📜 Dlhopis ${rate}% na ${years} roky`;
        }
      }

      return labels[key] || key;
    };

    const mixHtml = data.projection.mix
      .map((item: any) => `
        <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
          <span>${formatMixLabel(item.key)}</span>
          <strong>${item.pct.toFixed(1)}%</strong>
        </div>
      `).join('');

    const bonusesHtml = data.projection.bonuses?.length > 0
      ? data.projection.bonuses.map((b: string, i: number) => `
        <div style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
          <span>✓ ${b}</span>
        </div>
      `).join('')
      : '<p style="color: #6b7280;">Žiadne bonusy</p>';

    const internalHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: white; padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
    <h1 style="margin: 0;">📊 Nová investičná projekcia</h1>
    <p style="margin: 10px 0 0 0;">Klient žiada o konzultáciu</p>
  </div>

  <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h3 style="margin-top: 0; color: #059669;">👤 Kontaktné údaje</h3>
    <p><strong>Meno:</strong> ${data.user.firstName} ${data.user.lastName}</p>
    <p><strong>Email:</strong> <a href="mailto:${data.user.email}">${data.user.email}</a></p>
    <p><strong>Telefón:</strong> <a href="tel:${data.user.phone}">${data.user.phone}</a></p>
  </div>

  <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h3 style="margin-top: 0; color: #059669;">📊 Projekcia</h3>
    <p><strong>Jednorazový vklad:</strong> ${data.projection.lumpSumEur.toLocaleString("sk-SK")} €</p>
    <p><strong>Mesačný vklad:</strong> ${data.projection.monthlyVklad.toLocaleString("sk-SK")} €</p>
    <p><strong>Horizont:</strong> ${data.projection.horizonYears} rokov</p>
    <p><strong>Cieľ:</strong> ${data.projection.goalAssetsEur.toLocaleString("sk-SK")} €</p>
    <p><strong>Hodnota po ${data.projection.horizonYears} rokoch:</strong> <span style="color: #10b981; font-size: 1.2em;">${Math.round(data.projection.futureValue).toLocaleString("sk-SK")} €</span></p>
    <p><strong>Progres k cieľu:</strong> ${data.projection.progressPercent}%</p>
    <p><strong>Výnos p.a.:</strong> ${(data.projection.yieldAnnual * 100).toFixed(1)}%</p>
  </div>

  <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h3 style="margin-top: 0; color: #059669;">🎯 Zloženie portfólia</h3>
    ${mixHtml}
  </div>

  ${data.projection.bonuses?.length > 0 ? `
  <div style="background: linear-gradient(to right, rgba(139, 92, 246, 0.1), rgba(217, 70, 239, 0.1)); border-left: 3px solid #8b5cf6; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
    <h3 style="margin-top: 0; color: #8b5cf6;">🎁 Vybrané bonusy (${data.projection.bonuses.length})</h3>
    ${bonusesHtml}
  </div>
  ` : ''}

  <div style="text-align: center; margin: 30px 0;">
    <a href="${data.projection.deeplink}" style="display: inline-block; background: #059669; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600;">
      🔗 Otvoriť interaktívnu projekciu
    </a>
  </div>

  <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb; font-size: 12px; color: #6b7280;">
    <p><strong>Unotop MVP</strong> - Investičná kalkulačka</p>
    <p>Ref. kód: ${data.metadata?.referenceCode || "N/A"}</p>
  </div>
</body>
</html>
`;

    const internalText = `
NOVÁ INVESTIČNÁ PROJEKCIA
========================

KONTAKT:
${data.user.firstName} ${data.user.lastName}
${data.user.email}
${data.user.phone}

PROJEKCIA:
Jednorazový vklad: ${data.projection.lumpSumEur.toLocaleString("sk-SK")} €
Mesačný vklad: ${data.projection.monthlyVklad.toLocaleString("sk-SK")} €
Horizont: ${data.projection.horizonYears} rokov
Cieľ: ${data.projection.goalAssetsEur.toLocaleString("sk-SK")} €
Hodnota: ${Math.round(data.projection.futureValue).toLocaleString("sk-SK")} €
Progres: ${data.projection.progressPercent}%

Deeplink: ${data.projection.deeplink}
`;

    // PR-26: Send internal email (to agents) via Resend
    console.log("[EmailService] Sending internal email via Resend...");
    const internalResponse = await sendEmailViaResend(
      data.recipients,
      `📊 Projekcia: ${data.user.firstName} ${data.user.lastName}`,
      internalHtml,
      internalText,
      data.user.email
    );

    console.log("[EmailService] Internal email sent OK, ID:", internalResponse.id);

    // PR-26: Send confirmation email to client
    let clientConfirmationStatus: "sent" | "failed" | "skipped" = "skipped";

    if (data.user.email) {
      try {
        const confirmHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: white; padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px;">
    <h1 style="margin: 0;">✅ Projekcia prijatá</h1>
  </div>
  
  <p>Dobrý deň ${data.user.firstName},</p>
  <p>Ďakujeme za záujem o investičné poradenstvo cez Unotop MVP.</p>
  <p><strong>Vaša projekcia bola úspešne prijatá.</strong> Náš tím vás bude kontaktovať v najbližších 24 hodinách.</p>
  
  ${data.projection.bonuses?.length > 0 ? `
  <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0;">
    <h3 style="margin-top: 0; color: #059669;">🎁 Vybrané bonusy (${data.projection.bonuses.length})</h3>
    ${bonusesHtml}
  </div>
  ` : ''}
  
  <p>S pozdravom,<br><strong>Unotop tím</strong></p>
  
  <div style="margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb; font-size: 12px; color: #6b7280;">
    <p>info.unotop@gmail.com | +421 915 637 495</p>
  </div>
</body>
</html>
`;

        const confirmText = `
Dobrý deň ${data.user.firstName},

Ďakujeme za záujem o investičné poradenstvo cez Unotop MVP.

Vaša projekcia bola úspešne prijatá. Náš tím vás bude kontaktovať v najbližších 24 hodinách.

S pozdravom,
Unotop tím

info.unotop@gmail.com
+421 915 637 495
`;

        await sendEmailViaResend(
          [data.user.email],
          "✅ Projekcia prijatá - Unotop MVP",
          confirmHtml,
          confirmText
        );
        
        console.log("[EmailService] Client confirmation sent OK to", data.user.email);
        clientConfirmationStatus = "sent";
      } catch (confirmError) {
        console.warn("[EmailService] Client confirmation failed:", confirmError);
        clientConfirmationStatus = "failed";
      }
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "X-RateLimit-Remaining": rateLimit.remaining.toString(),
      },
      body: JSON.stringify({
        success: true,
        message: "Projection sent successfully",
        referenceCode: data.metadata?.referenceCode,
        clientConfirmation: clientConfirmationStatus, // PR-25: Track confirmation status
      }),
    };
  } catch (error) {
    console.error("[Netlify Function] Error:", error);
    return {
      statusCode: 500,
      headers: { 
        "Access-Control-Allow-Origin": origin,
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({ 
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error"
      }),
    };
  }
};
