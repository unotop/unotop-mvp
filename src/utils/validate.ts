/**
 * validate.ts - Contact form validation utilities (PR-7 Task 7)
 */

/**
 * Disposable email denylist (top 50 providers)
 */
const DISPOSABLE_DOMAINS = [
  "mailinator.com",
  "yopmail.com",
  "guerrillamail.com",
  "temp-mail.org",
  "10minutemail.com",
  "throwaway.email",
  "fakeinbox.com",
  "tempmail.com",
  "trashmail.com",
  "maildrop.cc",
  "getnada.com",
  "dispostable.com",
  "sharklasers.com",
  "guerrillamailblock.com",
  "pokemail.net",
  "spam4.me",
  "mintemail.com",
  "mytrashmail.com",
  "mailnesia.com",
  "mailtemp.info",
];

/**
 * Email validation (basic regex + disposable check)
 */
export function validateEmail(email: string): {
  valid: boolean;
  error?: string;
} {
  const trimmed = email.trim().toLowerCase();

  // Basic format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: "Neplatný formát emailu" };
  }

  // Disposable domain check
  const domain = trimmed.split("@")[1];
  if (DISPOSABLE_DOMAINS.includes(domain)) {
    return {
      valid: false,
      error: "Dočasné emaily nie sú povolené. Použite trvalú adresu.",
    };
  }

  return { valid: true };
}

/**
 * SK Phone validation (E.164 format: +421 9XX XXX XXX or 09XX XXX XXX)
 */
export function validatePhone(phone: string): {
  valid: boolean;
  error?: string;
} {
  const trimmed = phone.trim().replace(/\s+/g, "");

  // SK E.164: +421 9XX XXX XXX (mobile) or local 09XX XXX XXX
  const skE164Regex = /^(\+421|0)9\d{8}$/;
  if (!skE164Regex.test(trimmed)) {
    return {
      valid: false,
      error: "Neplatné číslo. Formát: +421 9XX XXX XXX alebo 09XX XXX XXX",
    };
  }

  return { valid: true };
}

/**
 * Rate limiting (localStorage-based, 3 submissions per hour)
 */
const RATE_LIMIT_KEY = "unotop:contact-rate-limit";
const MAX_SUBMISSIONS = 3;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

export function checkRateLimit(): {
  allowed: boolean;
  remaining: number;
  resetMs?: number;
} {
  try {
    const stored = localStorage.getItem(RATE_LIMIT_KEY);
    const now = Date.now();

    if (!stored) {
      return { allowed: true, remaining: MAX_SUBMISSIONS - 1 };
    }

    const timestamps: number[] = JSON.parse(stored);
    const recent = timestamps.filter((ts) => now - ts < WINDOW_MS);

    if (recent.length >= MAX_SUBMISSIONS) {
      const oldest = Math.min(...recent);
      const resetMs = WINDOW_MS - (now - oldest);
      return { allowed: false, remaining: 0, resetMs };
    }

    return { allowed: true, remaining: MAX_SUBMISSIONS - recent.length - 1 };
  } catch {
    return { allowed: true, remaining: MAX_SUBMISSIONS - 1 };
  }
}

export function recordSubmission(): void {
  try {
    const stored = localStorage.getItem(RATE_LIMIT_KEY);
    const now = Date.now();
    const timestamps: number[] = stored ? JSON.parse(stored) : [];

    // Add current timestamp + filter old ones
    const updated = [...timestamps, now].filter(
      (ts) => now - ts < WINDOW_MS
    );

    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn("[validate] Failed to record submission:", err);
  }
}

/**
 * Min-time check (3s from mount to submit, bot trap)
 */
export function validateMinTime(mountTime: number, minSeconds = 3): boolean {
  const elapsed = (Date.now() - mountTime) / 1000;
  return elapsed >= minSeconds;
}
