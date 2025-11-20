import type { Handler, HandlerEvent, HandlerContext, HandlerResponse } from "@netlify/functions";
import emailjs from "@emailjs/browser";

/**
 * Netlify Function - Send Projection Email (Server-Side)
 * 
 * Security improvements:
 * - EmailJS credentials hidden from client (server-side only)
 * - Rate limiting per IP address (5 requests/hour)
 * - Input validation & sanitization
 * - CORS protection (only unotop.sk, unotop.netlify.app)
 */

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "https://unotop.netlify.app",
  "https://unotop.sk",
];

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
  // CORS check
  const origin = event.headers.origin || "";
  if (!ALLOWED_ORIGINS.includes(origin)) {
    return {
      statusCode: 403,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Forbidden origin" }),
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          error: "Validation failed", 
          details: validation.errors 
        }),
      };
    }

    // Get EmailJS credentials from env (server-side only!)
    const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID;
    const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID;
    const EMAILJS_CONFIRMATION_TEMPLATE_ID = process.env.EMAILJS_CONFIRMATION_TEMPLATE_ID;
    const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY;

    if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
      console.error("[Netlify Function] Missing EmailJS credentials");
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Server configuration error" }),
      };
    }

    // Format data for EmailJS
    const mixFormatted = data.projection.mix
      .map((item: any) => `${item.key}: ${item.pct.toFixed(1)}%`)
      .join(", ");

    const bonusesFormatted = data.projection.bonuses?.length > 0
      ? data.projection.bonuses.map((b: string, i: number) => `${i + 1}. ${b}`).join("\n")
      : "";

    const templateParams = {
      user_name: `${data.user.firstName} ${data.user.lastName}`,
      first_name: data.user.firstName,
      last_name: data.user.lastName,
      user_email: data.user.email,
      user_phone: data.user.phone,
      lump_sum: data.projection.lumpSumEur.toLocaleString("sk-SK"),
      monthly: data.projection.monthlyVklad.toLocaleString("sk-SK"),
      years: data.projection.horizonYears,
      goal: data.projection.goalAssetsEur.toLocaleString("sk-SK"),
      future_value: Math.round(data.projection.futureValue).toLocaleString("sk-SK"),
      progress: data.projection.progressPercent,
      yield: (data.projection.yieldAnnual * 100).toFixed(1),
      deeplink: data.projection.deeplink,
      risk_pref: data.metadata?.riskPref || "N/A",
      client_type: data.metadata?.clientType || "N/A",
      version: data.metadata?.version || "N/A",
      utm_source: data.metadata?.utm_source || "",
      utm_medium: data.metadata?.utm_medium || "",
      utm_campaign: data.metadata?.utm_campaign || "",
      reference_code: data.metadata?.referenceCode || "",
      reserve_help: data.metadata?.reserveHelp ? "Áno" : "Nie",
      expenses: data.metadata?.expenses ? data.metadata.expenses.toLocaleString("sk-SK") : "N/A",
      reserve_low: data.metadata?.reserveLow ? data.metadata.reserveLow.toLocaleString("sk-SK") : "N/A",
      reserve_high: data.metadata?.reserveHigh ? data.metadata.reserveHigh.toLocaleString("sk-SK") : "N/A",
      surplus: data.metadata?.surplus ? data.metadata.surplus.toLocaleString("sk-SK") : "N/A",
      stage: data.metadata?.stage || "N/A",
      mix_formatted: mixFormatted,
      bonuses_formatted: bonusesFormatted,
    };

    // Send internal email (to agents)
    const internalResponse = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams,
      EMAILJS_PUBLIC_KEY
    );

    if (internalResponse.status !== 200) {
      throw new Error(`EmailJS failed with status ${internalResponse.status}`);
    }

    // Send confirmation email to client (non-blocking)
    if (data.user.email && EMAILJS_CONFIRMATION_TEMPLATE_ID) {
      try {
        await emailjs.send(
          EMAILJS_SERVICE_ID,
          EMAILJS_CONFIRMATION_TEMPLATE_ID,
          {
            client_email: data.user.email,
            first_name: data.user.firstName,
            bonuses_formatted: bonusesFormatted,
          },
          EMAILJS_PUBLIC_KEY
        );
      } catch (confirmError) {
        console.warn("[Netlify Function] Client confirmation failed:", confirmError);
        // Don't fail the request - internal email is priority
      }
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Remaining": rateLimit.remaining.toString(),
      },
      body: JSON.stringify({
        success: true,
        message: "Projection sent successfully",
        referenceCode: data.metadata?.referenceCode,
      }),
    };
  } catch (error) {
    console.error("[Netlify Function] Error:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error"
      }),
    };
  }
};
