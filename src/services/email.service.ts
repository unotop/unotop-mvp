/**
 * Email service for sending projections
 * 
 * TEMPORARY ROLLBACK (PR-23):
 * EmailJS blokuje server-side API calls (403 error).
 * Vraciam client-side volanie až kým nenájdeme iné riešenie (Resend.com, SendGrid, atď).
 * 
 * TODO: Migrovať na Resend.com alebo SendGrid pre skutočný server-side email
 */

import emailjs from "@emailjs/browser";

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
  };
  recipients: string[];
}

/**
 * Send projection email via EmailJS (CLIENT-SIDE - temporary rollback)
 * 
 * ROLLBACK REASON: EmailJS blokuje server-side API (403 error)
 * Next: Migrovať na Resend.com alebo SendGrid
 */
export async function sendProjectionEmail(data: ProjectionData): Promise<void> {
  // Get client-side credentials from env
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
  const confirmTemplateId = import.meta.env.VITE_EMAILJS_CONFIRMATION_TEMPLATE_ID;
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

  if (!serviceId || !templateId || !publicKey) {
    throw new Error("Missing EmailJS credentials in environment");
  }

  // Format mix for email template
  const mixFormatted = data.projection.mix
    .map((item) => `${item.key}: ${item.pct.toFixed(1)}%`)
    .join("\n");

  const bonusesFormatted = data.projection.bonuses
    ? data.projection.bonuses.map((b, i) => `${i + 1}. ${b}`).join("\n")
    : "Žiadne bonusy";

  const templateParams = {
    first_name: data.user.firstName,
    last_name: data.user.lastName,
    client_email: data.user.email,
    phone: data.user.phone,
    lump_sum: data.projection.lumpSumEur.toLocaleString("sk-SK"),
    monthly_vklad: data.projection.monthlyVklad.toLocaleString("sk-SK"),
    horizon_years: data.projection.horizonYears,
    goal_assets: data.projection.goalAssetsEur.toLocaleString("sk-SK"),
    future_value: Math.round(data.projection.futureValue).toLocaleString("sk-SK"),
    progress_percent: data.projection.progressPercent.toFixed(0),
    yield_annual: data.projection.yieldAnnual.toFixed(1),
    mix_formatted: mixFormatted,
    bonuses_formatted: bonusesFormatted,
    deeplink: data.projection.deeplink,
    to_emails: data.recipients.join(", "),
  };

  console.log("[EmailService] Sending via client-side EmailJS...");

  try {
    // Send internal email (to agents)
    await emailjs.send(serviceId, templateId, templateParams, publicKey);
    console.log("✅ Internal email sent");

    // Send confirmation email to client
    if (data.user.email && confirmTemplateId) {
      try {
        await emailjs.send(
          serviceId,
          confirmTemplateId,
          {
            client_email: data.user.email,
            first_name: data.user.firstName,
            bonuses_formatted: bonusesFormatted,
          },
          publicKey
        );
        console.log("✅ Confirmation email sent");
      } catch (confirmError) {
        console.warn("⚠️ Confirmation email failed (non-critical):", confirmError);
      }
    }
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
