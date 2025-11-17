import React from "react";
import { readV3 } from "./persist/v3";
import LegacyApp from "./LegacyApp";
import BasicLayout from "./BasicLayout";
import WelcomeModal from "./components/WelcomeModal";
import { PrivacyModal } from "./components/PrivacyModal"; // PR-8: GDPR modal
import { AdminShortcuts } from "./features/admin/AdminShortcuts"; // PR-12: Global admin shortcuts
import { AdminConsole } from "./features/admin/AdminConsole"; // PR-12: Admin console
import { AboutAuthorModal } from "./components/AboutAuthorModal"; // PR-14: O autorovi

const WELCOME_STORAGE_KEY = "unotop:welcome-seen";

/**
 * RootLayout - top-level wrapper
 * Rozhoduje medzi BASIC a PRO režimom
 *
 * Reactive: počúva storage events pre live prepínanie
 */
export default function RootLayout() {
  const [modeUi, setModeUi] = React.useState<"BASIC" | "PRO">(() => {
    try {
      const seed = readV3();
      return (seed.profile?.modeUi as any) || "BASIC";
    } catch (err) {
      console.error("[RootLayout] Failed to read persist:", err);
      return "BASIC";
    }
  });

  // Welcome modal state (show only on first visit OR if hideTour is not set)
  const [showWelcome, setShowWelcome] = React.useState<boolean>(() => {
    try {
      // Check persist v3 first (hideTour flag)
      const v3 = readV3();
      if (v3.profile?.hideTour) return false;

      // Fallback to old localStorage key
      return !localStorage.getItem(WELCOME_STORAGE_KEY);
    } catch {
      return false; // If localStorage fails, don't show modal
    }
  });

  // PR-8: Privacy modal state
  const [showPrivacy, setShowPrivacy] = React.useState(false);

  // PR-12: Tour blocked flag (GDPR otvorený = tour nespúšťať)
  const [tourBlocked, setTourBlocked] = React.useState(false);

  // PR-12: Admin console state (riadi AdminShortcuts)
  const [adminOpen, setAdminOpen] = React.useState(false);

  // PR-14: About author modal state
  const [aboutOpen, setAboutOpen] = React.useState(false);

  // Allow manual reopening of welcome modal
  React.useEffect(() => {
    const handleOpenWelcome = () => setShowWelcome(true);
    window.addEventListener("openWelcomeModal", handleOpenWelcome);
    return () =>
      window.removeEventListener("openWelcomeModal", handleOpenWelcome);
  }, []);

  const handleCloseWelcome = () => {
    try {
      localStorage.setItem(WELCOME_STORAGE_KEY, "true");
    } catch (err) {
      console.error("[RootLayout] Failed to save welcome flag:", err);
    }
    setShowWelcome(false);
  };

  // Listen to storage changes (cross-tab & manual persist writes)
  React.useEffect(() => {
    const handleStorageChange = () => {
      try {
        const seed = readV3();
        const newMode = (seed.profile?.modeUi as any) || "BASIC";
        // Len ak sa MODE skutočne zmenil (nie každá zmena v localStorage)
        if (modeUi !== newMode) {
          console.log("[RootLayout] Mode changed:", modeUi, "→", newMode);
          setModeUi(newMode);
        }
      } catch (err) {
        console.error("[RootLayout] handleStorageChange error:", err);
      }
    };

    // Poll localStorage every 500ms (menej agresívne)
    const interval = setInterval(handleStorageChange, 500);

    // Also listen to storage events (cross-tab sync)
    window.addEventListener("storage", handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [modeUi]);

  return (
    <>
      {/* PR-12: Global admin shortcuts listener */}
      <AdminShortcuts
        onOpenAdmin={() => setAdminOpen(true)}
        isPrivacyOpen={showPrivacy}
      />

      {showWelcome && (
        <WelcomeModal
          onClose={handleCloseWelcome}
          onOpenPrivacy={() => {
            // PR-12 FIX: GDPR nad Introm, tour nespúšťať
            setShowPrivacy(true);
            setTourBlocked(true);
            // Nastav flag pre BasicLayout aby vedel že tour má preskočiť
            sessionStorage.setItem("unotop_skipTourAfterIntro", "true");
            // NEUZATVÁRAME showWelcome - Intro zostáva v pozadí
          }}
        />
      )}
      {/* PR-12 FIX: PrivacyModal overlay nad všetkým (z-[10000]) */}
      <PrivacyModal
        isOpen={showPrivacy}
        onClose={() => {
          setShowPrivacy(false);
          setTourBlocked(false); // Odblokuj tour
          // Vymaž skip flag - užívateľ sa môže vrátiť k Intro a spustiť tour
          sessionStorage.removeItem("unotop_skipTourAfterIntro");
          // Intro ostáva otvorené (showWelcome = true)
        }}
      />

      {/* PR-12: Admin console (global, riadi AdminShortcuts) */}
      <AdminConsole visible={adminOpen} onClose={() => setAdminOpen(false)} />

      {/* PR-14: About Author modal */}
      <AboutAuthorModal
        isOpen={aboutOpen}
        onClose={() => setAboutOpen(false)}
      />

      {modeUi === "BASIC" ? (
        <BasicLayout
          onAboutClick={() => setAboutOpen(true)}
          onAdminOpen={() => setAdminOpen(true)} // PR-16: DEV admin button
        />
      ) : (
        <LegacyApp onAboutClick={() => setAboutOpen(true)} />
      )}
    </>
  );
}
