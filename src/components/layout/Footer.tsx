/**
 * PR-7: Footer - Mini footer s GDPR odkazom
 * 
 * Zobrazuje sa na spodku aplikácie (mimo sticky bottom bar).
 * Obsahuje copyright a link na privacy policy.
 */

import React from "react";
import { TEST_IDS } from "../../testIds";

interface FooterProps {
  onPrivacyClick: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onPrivacyClick }) => {
  return (
    <footer className="w-full py-6 px-4 mt-12 border-t border-white/5 bg-slate-950/50">
      <div className="max-w-[1320px] mx-auto flex flex-col sm:flex-row items-center justify-center gap-2 text-xs text-slate-500">
        <span>© {new Date().getFullYear()} UNOTOP</span>
        <span className="hidden sm:inline">•</span>
        <button
          onClick={onPrivacyClick}
          data-testid={TEST_IDS.FOOTER_PRIVACY_LINK}
          className="text-blue-400 hover:text-blue-300 hover:underline transition-colors"
        >
          Zásady ochrany súkromia
        </button>
      </div>
    </footer>
  );
};
