/**
 * PR-7: PrivacyModal - GDPR zásady ochrany súkromia
 * 
 * Modal načítava privacy-policy.sk.md a zobrazuje obsah.
 * Spúšťa sa z Intro (OnboardingTour) aj z Footer.
 */

import React from "react";
import { TEST_IDS } from "../testIds";

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [content, setContent] = React.useState<string>("");
  const closeButtonRef = React.useRef<HTMLButtonElement>(null);

  // Load privacy policy markdown
  React.useEffect(() => {
    if (isOpen) {
      fetch("/docs/privacy-policy.sk.md")
        .then((res) => res.text())
        .then((text) => setContent(text))
        .catch(() =>
          setContent("❌ Nepodarilo sa načítať dokument. Kontaktujte info.unotop@gmail.com")
        );
    }
  }, [isOpen]);

  // Focus trap + ESC close
  React.useEffect(() => {
    if (!isOpen) return;

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEsc);
    closeButtonRef.current?.focus();

    return () => document.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Simple markdown rendering (headings, lists, bold)
  const renderMarkdown = (md: string) => {
    return md.split("\n").map((line, i) => {
      // Headings
      if (line.startsWith("# ")) {
        return (
          <h1 key={i} className="text-2xl font-bold text-slate-100 mb-4 mt-6">
            {line.slice(2)}
          </h1>
        );
      }
      if (line.startsWith("## ")) {
        return (
          <h2 key={i} className="text-xl font-semibold text-slate-200 mb-3 mt-5">
            {line.slice(3)}
          </h2>
        );
      }
      // Lists
      if (line.startsWith("- ")) {
        return (
          <li key={i} className="text-sm text-slate-300 ml-4 mb-1">
            {line.slice(2).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")}
          </li>
        );
      }
      // Bold text
      if (line.includes("**")) {
        const html = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
        return (
          <p
            key={i}
            className="text-sm text-slate-300 mb-2"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      }
      // Regular paragraph
      if (line.trim()) {
        return (
          <p key={i} className="text-sm text-slate-300 mb-2">
            {line}
          </p>
        );
      }
      return null;
    });
  };

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-modal-title"
      data-testid={TEST_IDS.PRIVACY_MODAL}
    >
      <div
        className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl bg-slate-900 ring-1 ring-white/10 shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          ref={closeButtonRef}
          onClick={onClose}
          data-testid={TEST_IDS.PRIVACY_CLOSE_BTN}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors"
          aria-label="Zavrieť"
        >
          ×
        </button>

        {/* Content */}
        <div id="privacy-modal-title" className="prose prose-invert max-w-none">
          {renderMarkdown(content)}
        </div>
      </div>
    </div>
  );
};
