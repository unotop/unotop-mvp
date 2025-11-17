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
import { readV3, writeV3 } from "../persist/v3"; // PR-13

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPrivacy?: () => void; // PR-8: Open privacy modal
}

// PR-13 FIX: Správny zoznam bonusov
const BONUS_OPTIONS = [
  {
    id: "ufo",
    label: "UFO – Univerzálny finančný organizér ZDARMA",
    testId: "bonus-ufo",
    disabled: false,
    tooltip: undefined,
  },
  {
    id: "refi",
    label: "Refinancovanie / zníženie splátok hypotéky",
    testId: "bonus-refi",
    disabled: false,
    tooltip: undefined,
  },
  {
    id: "expenses",
    label: "Chcem znížiť/optimalizovať svoje výdavky",
    testId: "bonus-expenses",
    disabled: false,
    tooltip: undefined,
  },
  {
    id: "reserve",
    label: "Chcem pomôcť nastaviť rezervu a investičný plán",
    testId: "bonus-reserve",
    disabled: false,
    tooltip: undefined,
  },
  {
    id: "income",
    label: "Chcem zvýšiť svoj príjem – zaujíma ma spolupráca s UNOTOP",
    testId: "bonus-income",
    disabled: false,
    tooltip: undefined,
  },
  {
    id: "audit",
    label: "Bezplatný audit poistiek a úverov",
    testId: "bonus-audit",
    disabled: false,
    tooltip: undefined,
  },
  {
    id: "pdf",
    label: "PDF report mojej projekcie",
    testId: "bonus-pdf",
    disabled: false,
    tooltip: undefined,
  },
  {
    id: "ebook",
    label: "E-book zdarma (už čoskoro)",
    testId: "bonus-ebook",
    disabled: true,
    tooltip: "Dostupné po vydaní",
  },
] as const;

const REFI_DEADLINE_OPTIONS = [
  { value: "3", label: "3 dni" },
  { value: "7", label: "7 dní" },
  { value: "14", label: "14 dní" },
] as const;

export function ContactModal({
  isOpen,
  onClose,
  onOpenPrivacy,
}: ContactModalProps) {
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [honeypot, setHoneypot] = React.useState(""); // Bot trap
  const [consent, setConsent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  // PR-13 FIX: Bonuses state
  const [selectedBonuses, setSelectedBonuses] = React.useState<string[]>([]);
  const [refiDeadline, setRefiDeadline] = React.useState<string>("7");

  const mountTimeRef = React.useRef(Date.now());
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);

  // PR-8: Lock body scroll and add modal-open class when modal is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.classList.add("modal-open");
      return () => document.body.classList.remove("modal-open");
    }
  }, [isOpen]);

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

      // PR-13 FIX: Load persisted bonuses on open
      const v3 = readV3();
      setSelectedBonuses(v3.contact?.bonuses || []);
      // Extract refi deadline if exists
      const refiBonus = v3.contact?.bonuses?.find((b) =>
        b.startsWith("Refinancovanie")
      );
      if (refiBonus) {
        const match = refiBonus.match(/\(ponuka do (\d+) dní\)/);
        if (match) setRefiDeadline(match[1]);
      }
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

  // PR-13 FIX: Helper functions for bonuses
  const toggleBonus = (bonusId: string) => {
    setSelectedBonuses((prev) =>
      prev.includes(bonusId)
        ? prev.filter((id) => id !== bonusId)
        : [...prev, bonusId]
    );
  };

  const formatBonusForStorage = (bonusId: string): string => {
    const option = BONUS_OPTIONS.find((opt) => opt.id === bonusId);
    if (!option) return bonusId;

    if (bonusId === "refi") {
      return `${option.label} (ponuka do ${refiDeadline} dní)`;
    }
    return option.label;
  };

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

    // PR-13 FIX: Save bonuses to persist before submit
    const formattedBonuses = selectedBonuses.map(formatBonusForStorage);
    writeV3({
      contact: {
        ...readV3().contact,
        bonuses: formattedBonuses,
      },
    });

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

        {/* PR-13 FIX: Old read-only bonuses display removed - now interactive checkboxes in form */}

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

          {/* PR-13 FIX: Bonuses section (directly in form, before GDPR) */}
          <div className="pt-4 border-t border-white/10 space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-200 mb-1">
                Vyberte si bonusy, o ktoré máte záujem
              </h3>
              <p className="text-xs text-slate-400">
                Budú súčasťou vašej požiadavky na projekciu. Neovplyvňujú
                výpočty.
              </p>
            </div>

            <div className="space-y-2">
              {BONUS_OPTIONS.map((option) => (
                <div key={option.id}>
                  <label
                    className={`flex items-start gap-2 p-2.5 rounded-lg hover:bg-slate-800/50 transition-colors ${
                      option.disabled
                        ? "opacity-60 cursor-not-allowed"
                        : "cursor-pointer"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedBonuses.includes(option.id)}
                      onChange={() =>
                        !option.disabled && toggleBonus(option.id)
                      }
                      disabled={option.disabled || submitting}
                      data-testid={option.testId}
                      className="mt-0.5 w-4 h-4 rounded border-slate-600 text-violet-600 focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50"
                    />
                    <span className="text-sm text-slate-300 flex-1 select-none">
                      {option.label}
                      {option.tooltip && (
                        <span
                          className="ml-1.5 text-xs text-slate-500"
                          title={option.tooltip}
                          role="img"
                          aria-label={option.tooltip}
                        >
                          ℹ️
                        </span>
                      )}
                    </span>
                  </label>

                  {/* Refi deadline dropdown (conditional) */}
                  {option.id === "refi" && selectedBonuses.includes("refi") && (
                    <div className="ml-6 mt-1.5 mb-2">
                      <label className="block text-xs text-slate-400 mb-1">
                        Mám záujem o ponuku do:
                      </label>
                      <select
                        value={refiDeadline}
                        onChange={(e) => setRefiDeadline(e.target.value)}
                        disabled={submitting}
                        className="w-full max-w-[150px] px-2.5 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded-lg text-slate-200 focus:ring-2 focus:ring-violet-500 focus:border-violet-500 disabled:opacity-50"
                      >
                        {REFI_DEADLINE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

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
            <label htmlFor="contact-consent" className="text-xs text-slate-400">
              Súhlasím so spracovaním osobných údajov za účelom zaslania
              investičnej projekcie finančnému agentovi. Údaje nebudú uložené
              ani zdieľané s tretími stranami.{" "}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onOpenPrivacy?.();
                }}
                className="text-blue-400 hover:text-blue-300 underline cursor-pointer"
              >
                Zásady ochrany súkromia
              </button>
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
