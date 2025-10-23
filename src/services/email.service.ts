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

// EmailJS credentials (replace with your own or set in .env)
const EMAILJS_SERVICE_ID = (import.meta as any).env?.VITE_EMAILJS_SERVICE_ID || 'service_unotop';
const EMAILJS_TEMPLATE_ID = (import.meta as any).env?.VITE_EMAILJS_TEMPLATE_ID || 'template_projection';
const EMAILJS_PUBLIC_KEY = (import.meta as any).env?.VITE_EMAILJS_PUBLIC_KEY || 'YOUR_PUBLIC_KEY_HERE';

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
    to_email: data.recipients.join(', '),
    from_name: `${data.user.firstName} ${data.user.lastName}`,
    from_email: data.user.email,
    from_phone: data.user.phone,
    lump_sum: data.projection.lumpSumEur.toLocaleString(),
    monthly_vklad: data.projection.monthlyVklad.toLocaleString(),
    horizon_years: data.projection.horizonYears,
    goal_assets: data.projection.goalAssetsEur.toLocaleString(),
    future_value: data.projection.futureValue.toFixed(0),
    progress_percent: data.projection.progressPercent,
    yield_annual: (data.projection.yieldAnnual * 100).toFixed(1),
    mix: mixFormatted,
    deeplink: data.projection.deeplink,
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
