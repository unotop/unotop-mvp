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
 * 5. Set env variables or hardcode here
 */

// EmailJS credentials - UNOTOP Production
const EMAILJS_SERVICE_ID = 'service_r2eov4s';
const EMAILJS_TEMPLATE_ID = 'template_bmcskm8';
const EMAILJS_PUBLIC_KEY = '1hx6DPz-diYTb9Bzf';

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
  };
  metadata?: {
    riskPref?: string;
    clientType?: string;
    version?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    referenceCode?: string;
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
    mix_formatted: mixFormatted,
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
 * Fallback: Send via mailto (opens user's email client)
 * Use this if EmailJS fails or is not configured
 */
export function sendViaMailto(data: ProjectionData): void {
  const subject = `UNOTOP Projekcia - ${data.user.firstName} ${data.user.lastName}`;
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

=== DEEPLINK ===
${data.projection.deeplink}
  `.trim();

  const mailtoLink = `mailto:${data.recipients.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  
  window.location.href = mailtoLink;
}
