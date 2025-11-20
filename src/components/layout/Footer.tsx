/**
 * PR-20: Footer - Copyright & FINEXPERT GROUP / UNIVERSAL + verzia aplikácie
 *
 * Zobrazuje sa na spodku stránky (nie fixed) pod všetkými panelmi.
 * Obsahuje: © 2017–2025 Adam Belohorec, FINEXPERT GROUP (a.s.), UNIVERSAL skupina, verzia
 */

import React from "react";
import { TEST_IDS } from "../../testIds";
import { APP_VERSION } from "../../config/appVersion";

interface FooterProps {
  onPrivacyClick: () => void;
  onContactClick?: () => void;
  // PR-12: onAdminOpen removed - AdminShortcuts riadi otvorenie admin konzoly
}

export const Footer: React.FC<FooterProps> = ({
  onPrivacyClick,
  onContactClick,
}) => {
  return (
    <footer
      data-testid={TEST_IDS.FOOTER}
      className="w-full py-6 px-4 mt-2 border-t border-white/5 bg-slate-950/50"
    >
      <div className="max-w-[1320px] mx-auto space-y-3">
        {/* PR-19: Copyright © 2017–2025 + UNOTOP majetkový plánovač */}
        <div className="flex flex-col items-center justify-center gap-1 text-xs text-slate-400">
          <span className="font-semibold text-slate-300">
            UNOTOP – majetkový plánovač
          </span>
          <span className="text-slate-400">
            © 2017–2025 Ing. Adam Belohorec – UNOTOP. Všetky práva vyhradené.
          </span>
        </div>

        {/* PR-17: FINEXPERT GROUP a.s. + UNIVERSAL skupina */}
        <div className="flex flex-col items-center justify-center gap-1 text-xs text-slate-500">
          <span>
            Projekt FINEXPERT GROUP a. s., člena skupiny UNIVERSAL maklérsky
            dom, a. s.
          </span>
          <a
            href="https://www.finexpertgroup.sk"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-300 underline transition-colors"
          >
            www.finexpertgroup.sk
          </a>
        </div>

        {/* PR-17: Links (Privacy + Contact) */}
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-400 pt-2 border-t border-white/5">
          <button
            onClick={onPrivacyClick}
            data-testid={TEST_IDS.FOOTER_PRIVACY}
            className="hover:text-slate-200 underline transition-colors"
          >
            Zásady ochrany osobných údajov
          </button>
          {onContactClick && (
            <>
              <span className="text-slate-600">|</span>
              <button
                onClick={onContactClick}
                data-testid={TEST_IDS.FOOTER_CONTACT}
                className="hover:text-slate-200 underline transition-colors"
              >
                Kontakt
              </button>
            </>
          )}
        </div>

        {/* PR-20: Verzia aplikácie */}
        <div className="flex items-center justify-center text-xs text-slate-500 pt-1">
          <span>Verzia aplikácie: {APP_VERSION}</span>
        </div>
      </div>
    </footer>
  );
};
