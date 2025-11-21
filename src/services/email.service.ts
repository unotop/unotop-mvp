/**
 * Email service for sending projections
 * 
 * PR-26: Server-side email via Netlify Function
 * Environment variables configured in Netlify UI (not exposed to client)
 */

export interface ProjectionData {
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
    bonuses?: string[]; // PR-13 HOTFIX: Bonusy pre email
  };
  metadata?: {
    riskPref?: string;
    clientType?: string;
    version?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    referenceCode?: string;
    // PR-13B: Reserve & financial context
    reserveHelp?: boolean;
    collabOptIn?: boolean; // Spolupráca / zvýšiť príjem
    expenses?: number;
    reserveLow?: number;
    reserveHigh?: number;
    surplus?: number;
    stage?: string;
    // PR-23: reCAPTCHA v3
    recaptchaToken?: string;
  };
  recipients: string[];
}

/**
 * Send projection email via Netlify Function (SERVER-SIDE - secure)
 * 
 * Netlify Function endpoint: /.netlify/functions/send-projection
 * Sends both internal (to agents) and confirmation (to client) emails
 */
export async function sendProjectionEmail(data: ProjectionData): Promise<void> {
  console.log("[EmailService] Sending via Netlify Function (server-side)...");

  try {
    const response = await fetch("/.netlify/functions/send-projection", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[EmailService] Netlify Function error:", errorText);
      throw new Error(`Email service failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    console.log("✅ Emails sent via Netlify Function:", result);
  } catch (error) {
    console.error("[EmailService] Failed to send emails:", error);
    throw error;
  }
}

/**
 * PR-23: Client confirmation email now handled server-side by Netlify Function
 * This function is deprecated - confirmation is sent automatically when sendProjectionEmail() succeeds
 * @deprecated Use sendProjectionEmail() instead - it sends both internal and client confirmation emails
 */
export async function sendClientConfirmationEmail(
  clientEmail: string,
  firstName: string,
  bonuses?: string[]
): Promise<void> {
  // No-op: Server-side Netlify Function handles confirmation automatically
  console.log('[EmailService] Client confirmation handled by Netlify Function (server-side)');
}

/**
 * Fallback: Send via mailto (opens user's email client)
 * Use this if EmailJS fails or is not configured
 */
export function sendViaMailto(data: ProjectionData): void {
  const subject = `UNOTOP Projekcia - ${data.user.firstName} ${data.user.lastName}`;
  
  // PR-13 HOTFIX: Bonuses section for mailto
  const bonusesSection = data.projection.bonuses && data.projection.bonuses.length > 0
    ? `\n\n=== BONUSY ===\n${data.projection.bonuses.map((b, i) => `${i + 1}. ${b}`).join('\n')}`
    : '';
  
  const body = `
Nová investičná projekcia od klienta:

=== KONTAKT ===
Meno: ${data.user.firstName} ${data.user.lastName}
Email: ${data.user.email}
Telefón: ${data.user.phone}

=== PROJEKCIA ===
Jednorazový vklad: ${data.projection.lumpSumEur.toLocaleString()} €
Mesačný vklad: ${data.projection.monthlyVklad.toLocaleString()} €
Investičný horizont: ${data.projection.horizonYears} rokov
Cieľ majetku: ${data.projection.goalAssetsEur.toLocaleString()} €

Projektovaná hodnota: ${data.projection.futureValue.toFixed(0)} €
Progress: ${data.projection.progressPercent}%
Očakávaný výnos: ${(data.projection.yieldAnnual * 100).toFixed(1)}% p.a.

=== PORTFÓLIO ===
${data.projection.mix.map(item => `${item.key}: ${item.pct.toFixed(1)}%`).join('\n')}
${bonusesSection}

=== DEEPLINK ===
${data.projection.deeplink}
  `.trim();

  const mailtoLink = `mailto:${data.recipients.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  
  window.location.href = mailtoLink;
}
