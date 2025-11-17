/**
 * PR-12: AdminShortcuts - Global keyboard shortcuts pre admin console
 *
 * Funkcie:
 * - Primárna skratka: Ctrl+Shift+P
 * - Fallback skratka: Alt+Shift+A
 * - Triple-click na logo (3× do 1,5s) v DEV/Preview
 * - URL flag ?admin=true v DEV/Preview
 *
 * Guards:
 * - Ak je otvorený GDPR/Privacy modal → všetky skratky ignorované
 * - PROD: vždy vyžaduje heslo (guard v AdminConsole)
 */

import React from "react";
import {
  isDev,
  isPreview,
  hasAdminUrlFlag,
  getEnvName,
} from "../../shared/env";

interface AdminShortcutsProps {
  onOpenAdmin: () => void;
  isPrivacyOpen?: boolean; // GDPR guard
}

export const AdminShortcuts: React.FC<AdminShortcutsProps> = ({
  onOpenAdmin,
  isPrivacyOpen = false,
}) => {
  // Triple-click counter (len v DEV/Preview)
  const tripleClickCountRef = React.useRef(0);
  const tripleClickTimerRef = React.useRef<number | null>(null);

  // URL flag check (len v DEV/Preview)
  React.useEffect(() => {
    if ((isDev() || isPreview()) && hasAdminUrlFlag()) {
      console.log(
        `[AdminShortcuts] ?admin=true detected in ${getEnvName()}, opening admin console`
      );
      onOpenAdmin();
    }
  }, [onOpenAdmin]);

  // Keyboard shortcuts listener
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // GDPR guard: ignoruj všetky skratky ak je Privacy modal otvorený
      if (isPrivacyOpen) {
        console.log(
          "[AdminShortcuts] Skratky ignorované (GDPR modal otvorený)"
        );
        return;
      }

      // Primárna skratka: Ctrl+Shift+P
      if (e.ctrlKey && e.shiftKey && (e.code === "KeyP" || e.key === "P")) {
        e.preventDefault();
        console.log("[AdminShortcuts] Ctrl+Shift+P detected");
        onOpenAdmin();
        return;
      }

      // Fallback skratka: Alt+Shift+A
      if (e.altKey && e.shiftKey && (e.code === "KeyA" || e.key === "A")) {
        e.preventDefault();
        console.log("[AdminShortcuts] Alt+Shift+A detected");
        onOpenAdmin();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    console.log(
      `[AdminShortcuts] Mounted in ${getEnvName()}, listening for shortcuts`
    );

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      console.log("[AdminShortcuts] Unmounted");
    };
  }, [onOpenAdmin, isPrivacyOpen]);

  // Triple-click na logo handler (len v DEV/Preview)
  const handleLogoClick = React.useCallback(() => {
    // GDPR guard
    if (isPrivacyOpen) {
      console.log(
        "[AdminShortcuts] Triple-click ignorovaný (GDPR modal otvorený)"
      );
      return;
    }

    // PROD guard: triple-click nefunguje v PROD
    if (!isDev() && !isPreview()) {
      console.log("[AdminShortcuts] Triple-click ignorovaný (PROD mode)");
      return;
    }

    const currentCount = tripleClickCountRef.current + 1;
    tripleClickCountRef.current = currentCount;

    // Reset timer
    if (tripleClickTimerRef.current) {
      clearTimeout(tripleClickTimerRef.current);
    }

    // 3× do 1,5s → otvor admin
    if (currentCount >= 3) {
      console.log("[AdminShortcuts] Triple-click detected on logo");
      tripleClickCountRef.current = 0;
      onOpenAdmin();
      return;
    }

    // Reset counter po 1,5s inaktivity
    tripleClickTimerRef.current = window.setTimeout(() => {
      tripleClickCountRef.current = 0;
    }, 1500);
  }, [onOpenAdmin, isPrivacyOpen]);

  // Expose handler pre logo (RootLayout ho pripojí na logo element)
  React.useEffect(() => {
    // Pripoj handler na existujúci logo element (ak existuje)
    const logo = document.querySelector('[data-logo="true"]') as HTMLElement;
    if (logo) {
      logo.addEventListener("click", handleLogoClick);
      logo.style.userSelect = "none"; // Pridaj no-select inline (fallback)

      return () => {
        logo.removeEventListener("click", handleLogoClick);
      };
    }
  }, [handleLogoClick]);

  // Component nevracia UI - len globálny listener
  return null;
};
