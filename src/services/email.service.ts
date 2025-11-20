import emailjs from '@emailjs/browser';

/**
 * Email service for sending projections
 * Uses EmailJS for client-side sending
 * 
 * Setup:
 * 1. Create account at https://www.emailjs.com/
 * 2. Create email service (Gmail/Outlook)
 * 3. Create email template
 * 4. Get Service ID, Template ID, Public Key
 * 5. Create .env.local file with credentials (see .env.local.example)
 * 
 * Security:
 * - Credentials are loaded from environment variables
 * - Enable rate limiting in EmailJS dashboard (max 200/day)
 * - Whitelist only your domains (unotop.sk, unotop.netlify.app)
 */

// PR-13: Load from environment variables (NOT hardcoded)
const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || '';
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '';
const EMAILJS_CONFIRMATION_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_CONFIRMATION_TEMPLATE_ID || '';
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || '';

// Validate credentials on load
if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
  console.error('[EmailJS] ⚠️ Missing credentials - email service disabled. Check .env.local file.');
}

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
 * Send projection email via EmailJS
 */
export async function sendProjectionEmail(data: ProjectionData): Promise<void> {
  // Format mix for email
  const mixFormatted = data.projection.mix
    .map(item => `${item.key}: ${item.pct.toFixed(1)}%`)
    .join(', ');

  // PR-13 HOTFIX: Format bonuses for email
  const bonusesFormatted = data.projection.bonuses && data.projection.bonuses.length > 0
    ? data.projection.bonuses.map((b, i) => `${i + 1}. ${b}`).join('\n')
    : '';

  // Prepare template params for EmailJS
  const templateParams = {
    user_name: `${data.user.firstName} ${data.user.lastName}`,
    first_name: data.user.firstName,
    last_name: data.user.lastName,
    user_email: data.user.email,
    user_phone: data.user.phone,
    lump_sum: data.projection.lumpSumEur.toLocaleString('sk-SK'),
    monthly: data.projection.monthlyVklad.toLocaleString('sk-SK'),
    years: data.projection.horizonYears,
    goal: data.projection.goalAssetsEur.toLocaleString('sk-SK'),
    future_value: Math.round(data.projection.futureValue).toLocaleString('sk-SK'),
    progress: data.projection.progressPercent,
    yield: (data.projection.yieldAnnual * 100).toFixed(1),
    deeplink: data.projection.deeplink,
    // Metadata (PR-7 Task 10)
    risk_pref: data.metadata?.riskPref || 'N/A',
    client_type: data.metadata?.clientType || 'N/A',
    version: data.metadata?.version || 'N/A',
    utm_source: data.metadata?.utm_source || '',
    utm_medium: data.metadata?.utm_medium || '',
    utm_campaign: data.metadata?.utm_campaign || '',
    reference_code: data.metadata?.referenceCode || '',
    // PR-13B: Reserve context
    reserve_help: data.metadata?.reserveHelp ? 'Áno' : 'Nie',
    expenses: data.metadata?.expenses ? data.metadata.expenses.toLocaleString('sk-SK') : 'N/A',
    reserve_low: data.metadata?.reserveLow ? data.metadata.reserveLow.toLocaleString('sk-SK') : 'N/A',
    reserve_high: data.metadata?.reserveHigh ? data.metadata.reserveHigh.toLocaleString('sk-SK') : 'N/A',
    surplus: data.metadata?.surplus ? data.metadata.surplus.toLocaleString('sk-SK') : 'N/A',
    stage: data.metadata?.stage || 'N/A',
    mix_formatted: mixFormatted,
    // PR-13 HOTFIX: Bonuses
    bonuses_formatted: bonusesFormatted,
  };

  try {
    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams,
      EMAILJS_PUBLIC_KEY
    );

    if (response.status !== 200) {
      throw new Error(`EmailJS failed with status ${response.status}`);
    }

    console.log('[EmailService] Projection sent successfully', response);
  } catch (error) {
    console.error('[EmailService] Failed to send projection:', error);
    throw error;
  }
}

/**
 * PR-21: Send confirmation email to client
 * Simple text confirmation that projection was received
 */
export async function sendClientConfirmationEmail(
  clientEmail: string,
  firstName: string,
  bonuses?: string[]
): Promise<void> {
  if (!clientEmail || !EMAILJS_CONFIRMATION_TEMPLATE_ID) {
    console.warn('[EmailService] Client confirmation email skipped - missing email or template ID');
    return;
  }

  // Format bonuses for email
  const bonusesFormatted = bonuses && bonuses.length > 0
    ? bonuses.map((b, i) => `${i + 1}. ${b}`).join('\n')
    : '';

  const templateParams = {
    client_email: clientEmail,
    first_name: firstName,
    bonuses_formatted: bonusesFormatted,
  };

  try {
    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_CONFIRMATION_TEMPLATE_ID,
      templateParams,
      EMAILJS_PUBLIC_KEY
    );

    if (response.status !== 200) {
      throw new Error(`EmailJS confirmation failed with status ${response.status}`);
    }

    console.log('[EmailService] Client confirmation sent successfully', response);
  } catch (error) {
    console.error('[EmailService] Failed to send client confirmation:', error);
    // Don't throw - client confirmation is not critical
  }
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
