/**
 * Email validation helpers
 */

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

export function validatePhone(phone: string): boolean {
  // Slovak phone formats: +421 XXX XXX XXX, 0XXX XXX XXX, +421XXXXXXXXX
  const cleaned = phone.replace(/\s+/g, '');
  const phoneRegex = /^(\+421|0)[0-9]{9}$/;
  return phoneRegex.test(cleaned);
}

export function formatPhone(phone: string): string {
  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');
  return cleaned;
}

export interface ValidationErrors {
  email?: string;
  phone?: string;
  captcha?: string; // PR-13
}

export function validateFormData(data: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  gdprConsent: boolean;
}): ValidationErrors {
  const errors: ValidationErrors = {};

  if (!validateEmail(data.email)) {
    errors.email = 'Neplatný formát emailu';
  }

  if (!validatePhone(data.phone)) {
    errors.phone = 'Neplatný formát telefónneho čísla (napr. +421 900 123 456)';
  }

  return errors;
}
