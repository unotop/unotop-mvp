/**
 * Serverless API endpoint for sending investment projections via email
 * Deploy: Vercel, Netlify, AWS Lambda, etc.
 * 
 * Required env vars:
 * - RESEND_API_KEY (get from resend.com)
 */

import type { VercelRequest, VercelResponse } from "@vercel/node";

interface ProjectionPayload {
  user: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  projection: {
    lumpSumEur: number;
    monthlyVklad: number;
    horizonYears: number;
    goalAssetsEur: number;
    futureValue: number;
    progressPercent: number;
    yieldAnnual: number;
    mix: Array<{ key: string; pct: number }>;
    deeplink: string;
  };
  bonuses?: string[]; // PR-13: Selected bonuses
  recipients: string[];
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,POST");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const payload: ProjectionPayload = req.body;

    // Validate required fields
    if (
      !payload.user?.firstName ||
      !payload.user?.lastName ||
      !payload.user?.email ||
      !payload.user?.phone
    ) {
      return res.status(400).json({ error: "Missing required user fields" });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(payload.user.email)) {
      return res.status(400).json({ error: "Invalid email format" });
    }

    // Get Resend API key
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return res.status(500).json({ error: "Email service not configured" });
    }

    // Format mix for email
    const mixLabels: Record<string, string> = {
      gold: "🥇 Zlato",
      dyn: "📊 Dyn. riadenie",
      etf: "🌍 ETF svet",
      bonds: "📜 Dlhopisy",
      cash: "💵 Hotovosť",
      crypto: "₿ Krypto",
      real: "🏘️ Reality",
      other: "📦 Ostatné",
    };

    const mixText = payload.projection.mix
      .map((item) => `${mixLabels[item.key] || item.key}: ${item.pct.toFixed(1)}%`)
      .join("\n");

    // PR-13: Format bonuses for email
    const formatBonusLabel = (bonusId: string): string => {
      if (bonusId.startsWith("refi_")) {
        const days = bonusId.split("_")[1];
        return `Refinancovanie úverov (${days})`;
      }
      const labels: Record<string, string> = {
        ufo: "UFO rozhovory (2× ročne zdarma)",
        audit: "Audit portfólia",
        pdf: "PDF kalkulátor (offline)",
        ebook: "E-book: Investovanie pre začiatočníkov",
      };
      return labels[bonusId] || bonusId;
    };

    const bonusesText = payload.bonuses && payload.bonuses.length > 0
      ? payload.bonuses.map(id => `• ${formatBonusLabel(id)}`).join("\n")
      : "";

    // Email HTML template
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: white; padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 30px; }
    .section { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
    .section h3 { margin-top: 0; color: #059669; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
    .metric { background: white; padding: 15px; border-radius: 6px; border-left: 3px solid #059669; }
    .metric-label { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
    .metric-value { font-size: 24px; font-weight: bold; color: #059669; }
    .mix-item { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .cta { display: inline-block; background: #059669; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin-top: 20px; font-weight: 600; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 2px solid #e5e7eb; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📊 Nová investičná projekcia</h1>
    <p>Klient žiada o konzultáciu</p>
  </div>

  <div class="section">
    <h3>👤 Kontaktné údaje klienta</h3>
    <p><strong>Meno:</strong> ${payload.user.firstName} ${payload.user.lastName}</p>
    <p><strong>Email:</strong> <a href="mailto:${payload.user.email}">${payload.user.email}</a></p>
    <p><strong>Telefón:</strong> <a href="tel:${payload.user.phone}">${payload.user.phone}</a></p>
  </div>

  <div class="section">
    <h3>📊 Parametre investície</h3>
    <div class="grid">
      <div class="metric">
        <div class="metric-label">Jednorazový vklad</div>
        <div class="metric-value">${payload.projection.lumpSumEur.toFixed(0)} €</div>
      </div>
      <div class="metric">
        <div class="metric-label">Mesačný vklad</div>
        <div class="metric-value">${payload.projection.monthlyVklad.toFixed(0)} €</div>
      </div>
      <div class="metric">
        <div class="metric-label">Investičný horizont</div>
        <div class="metric-value">${payload.projection.horizonYears} rokov</div>
      </div>
      <div class="metric">
        <div class="metric-label">Cieľ majetku</div>
        <div class="metric-value">${payload.projection.goalAssetsEur.toFixed(0)} €</div>
      </div>
    </div>
  </div>

  <div class="section">
    <h3>💰 Projekcia</h3>
    <div class="grid">
      <div class="metric">
        <div class="metric-label">Hodnota po ${payload.projection.horizonYears} rokoch</div>
        <div class="metric-value" style="color: #10b981;">${payload.projection.futureValue.toFixed(0)} €</div>
      </div>
      <div class="metric">
        <div class="metric-label">Progres k cieľu</div>
        <div class="metric-value" style="color: #f59e0b;">${payload.projection.progressPercent}%</div>
      </div>
    </div>
    <p style="margin-top: 15px;"><strong>Odhad výnosu p.a.:</strong> ${(payload.projection.yieldAnnual * 100).toFixed(1)}%</p>
  </div>

  <div class="section">
    <h3>🎯 Zloženie portfólia</h3>
    ${payload.projection.mix.map(item => `
      <div class="mix-item">
        <span>${mixLabels[item.key] || item.key}</span>
        <strong>${item.pct.toFixed(1)}%</strong>
      </div>
    `).join('')}
  </div>

  ${payload.bonuses && payload.bonuses.length > 0 ? `
  <div class="section" style="background: linear-gradient(to right, rgba(139, 92, 246, 0.1), rgba(217, 70, 239, 0.1)); border-left: 3px solid #8b5cf6;">
    <h3>🎁 Vybrané bonusy (${payload.bonuses.length})</h3>
    ${payload.bonuses.map(id => `
      <div class="mix-item">
        <span>✓ ${formatBonusLabel(id)}</span>
      </div>
    `).join('')}
  </div>
  ` : ''}

  <div style="text-align: center;">
    <a href="${payload.projection.deeplink}" class="cta">
      🔗 Otvoriť interaktívnu projekciu
    </a>
  </div>

  <div class="footer">
    <p><strong>Unotop MVP</strong> - Investičná kalkulačka pre finančných agentov</p>
    <p>Email odoslaný automaticky z formulára na stránke. Klient súhlasil so spracovaním osobných údajov (GDPR).</p>
  </div>
</body>
</html>
`;

    // Plain text fallback
    const textContent = `
NOVÁ INVESTIČNÁ PROJEKCIA
========================

KONTAKTNÉ ÚDAJE KLIENTA
------------------------
Meno: ${payload.user.firstName} ${payload.user.lastName}
Email: ${payload.user.email}
Telefón: ${payload.user.phone}

PARAMETRE INVESTÍCIE
--------------------
Jednorazový vklad: ${payload.projection.lumpSumEur.toFixed(0)} €
Mesačný vklad: ${payload.projection.monthlyVklad.toFixed(0)} €
Investičný horizont: ${payload.projection.horizonYears} rokov
Cieľ majetku: ${payload.projection.goalAssetsEur.toFixed(0)} €

PROJEKCIA
---------
Hodnota po ${payload.projection.horizonYears} rokoch: ${payload.projection.futureValue.toFixed(0)} €
Progres k cieľu: ${payload.projection.progressPercent}%
Odhad výnosu p.a.: ${(payload.projection.yieldAnnual * 100).toFixed(1)}%

ZLOŽENIE PORTFÓLIA
------------------
${mixText}

${bonusesText ? `
VYBRANÉ BONUSY (${payload.bonuses?.length})
------------------
${bonusesText}
` : ''}

Interaktívna projekcia: ${payload.projection.deeplink}

---
Unotop MVP - Investičná kalkulačka
Email odoslaný automaticky. Klient súhlasil so spracovaním údajov (GDPR).
`;

    // Send via Resend API
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Unotop MVP <noreply@unotop.com>", // Change to your verified domain
        to: payload.recipients,
        subject: `📊 Nová projekcia od ${payload.user.firstName} ${payload.user.lastName}`,
        html: htmlContent,
        text: textContent,
        reply_to: payload.user.email,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Resend API error:", errorData);
      throw new Error("Failed to send email via Resend");
    }

    const data = await response.json();
    console.log("Email sent successfully:", data);

    return res.status(200).json({ 
      success: true, 
      message: "Projekcia bola úspešne odoslaná",
      emailId: data.id 
    });

  } catch (error) {
    console.error("Error in send-projection:", error);
    return res.status(500).json({ 
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
