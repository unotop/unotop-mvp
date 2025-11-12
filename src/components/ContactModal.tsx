/**
 * ContactModal.tsx - Contact form modal (PR-7 Task 7)
 */

import React from "react";
import { TEST_IDS } from "../testIds";
import {
  validateEmail,
  validatePhone,
  checkRateLimit,
  recordSubmission,
  validateMinTime,
} from "../utils/validate";

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ContactModal({ isOpen, onClose }: ContactModalProps) {
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [honeypot, setHoneypot] = React.useState(""); // Bot trap
  const [consent, setConsent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const mountTimeRef = React.useRef(Date.now());
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);

  // Reset state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      mountTimeRef.current = Date.now();
      setEmail("");
      setPhone("");
      setMessage("");
      setHoneypot("");
      setConsent(false);
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  // ESC key handler
  React.useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  // Focus trap
  React.useEffect(() => {
    if (isOpen && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Bot trap: honeypot field (hidden from users)
    if (honeypot) {
      console.warn("[ContactModal] Bot detected (honeypot filled)");
      onClose();
      return;
    }

    // Min-time check (3s bot trap)
    if (!validateMinTime(mountTimeRef.current, 3)) {
      setError("Vyplňte formulár pozornejšie (príliš rýchle odoslanie)");
      return;
    }

    // Rate limit check
    const rateCheck = checkRateLimit();
    if (!rateCheck.allowed) {
      const mins = Math.ceil((rateCheck.resetMs || 0) / 60000);
      setError(
        `Prekročený limit odoslaní (3 za hodinu). Skúste znova za ${mins} min.`
      );
      return;
    }

    // Email validation
    const emailCheck = validateEmail(email);
    if (!emailCheck.valid) {
      setError(emailCheck.error || "Neplatný email");
      return;
    }

    // Phone validation
    const phoneCheck = validatePhone(phone);
    if (!phoneCheck.valid) {
      setError(phoneCheck.error || "Neplatné telefónne číslo");
      return;
    }

    // Consent check
    if (!consent) {
      setError("Musíte súhlasiť so spracovaním údajov (GDPR)");
      return;
    }

    // Submit (placeholder – will wire to EmailJS or API later)
    setSubmitting(true);

    try {
      // TODO: Replace with actual EmailJS call or API endpoint
      console.log("[ContactModal] Submitting:", {
        email,
        phone,
        message: message || "(prázdna správa)",
      });

      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Record submission for rate limiting
      recordSubmission();

      // Success feedback
      alert(
        "Vaša žiadosť bola odoslaná! Náš poradca vás bude kontaktovať čoskoro."
      );
      onClose();
    } catch (err) {
      console.error("[ContactModal] Submit error:", err);
      setError("Odoslanie zlyhalo. Skúste znova neskôr.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contact-modal-title"
      data-testid={TEST_IDS.CONTACT_MODAL}
    >
      <div className="w-full max-w-md bg-slate-800 rounded-2xl shadow-2xl ring-1 ring-white/10 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2
            id="contact-modal-title"
            className="text-xl font-bold text-slate-100"
          >
            Kontaktujte poradcu
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors"
            aria-label="Zavrieť"
            data-testid={TEST_IDS.CONTACT_MODAL_CLOSE}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24">
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-300">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label
              htmlFor="contact-email"
              className="block text-sm font-medium text-slate-300 mb-1"
            >
              Email <span className="text-red-400">*</span>
            </label>
            <input
              id="contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vas.email@priklad.sk"
              required
              disabled={submitting}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 text-slate-100 ring-1 ring-white/10 focus:ring-2 focus:ring-blue-500 placeholder:text-slate-500 disabled:opacity-50"
              data-testid={TEST_IDS.CONTACT_EMAIL_INPUT}
            />
          </div>

          {/* Phone */}
          <div>
            <label
              htmlFor="contact-phone"
              className="block text-sm font-medium text-slate-300 mb-1"
            >
              Telefón <span className="text-red-400">*</span>
            </label>
            <input
              id="contact-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+421 9XX XXX XXX"
              required
              disabled={submitting}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 text-slate-100 ring-1 ring-white/10 focus:ring-2 focus:ring-blue-500 placeholder:text-slate-500 disabled:opacity-50"
              data-testid={TEST_IDS.CONTACT_PHONE_INPUT}
            />
          </div>

          {/* Message (optional) */}
          <div>
            <label
              htmlFor="contact-message"
              className="block text-sm font-medium text-slate-300 mb-1"
            >
              Správa (voliteľné)
            </label>
            <textarea
              id="contact-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Máte nejakú otázku alebo poznámku?"
              rows={3}
              disabled={submitting}
              className="w-full px-3 py-2 rounded-lg bg-slate-900 text-slate-100 ring-1 ring-white/10 focus:ring-2 focus:ring-blue-500 placeholder:text-slate-500 disabled:opacity-50 resize-none"
              data-testid={TEST_IDS.CONTACT_MESSAGE_INPUT}
            />
          </div>

          {/* Honeypot (hidden from users, bot trap) */}
          <input
            type="text"
            name="website"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
            tabIndex={-1}
            aria-hidden="true"
            className="absolute opacity-0 pointer-events-none"
            autoComplete="off"
          />

          {/* Consent checkbox (GDPR) */}
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              id="contact-consent"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              disabled={submitting}
              className="mt-0.5 w-4 h-4 rounded border-white/20 bg-slate-900 text-blue-500 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              data-testid={TEST_IDS.CONTACT_CONSENT_CHECKBOX}
            />
            <label
              htmlFor="contact-consent"
              className="text-xs text-slate-400"
            >
              Súhlasím so spracovaním osobných údajov na účely kontaktovania
              poradcom (v súlade so{" "}
              <a
                href="/docs/privacy-policy.sk.md"
                target="_blank"
                className="text-blue-400 hover:underline"
              >
                zásadami ochrany súkromia
              </a>
              ).
            </label>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={submitting || !email || !phone || !consent}
            className="w-full px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-semibold transition-colors"
            data-testid={TEST_IDS.CONTACT_SUBMIT_BTN}
          >
            {submitting ? "Odosielam..." : "Odoslať žiadosť"}
          </button>
        </form>

        {/* Footer note */}
        <p className="text-xs text-slate-500 text-center">
          Náš poradca vás kontaktuje do 24 hodín.
        </p>
      </div>
    </div>
  );
}
