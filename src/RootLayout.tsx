import React from "react";
import { readV3 } from "./persist/v3";
import LegacyApp from "./LegacyApp";
import BasicLayout from "./BasicLayout";
import WelcomeModal from "./components/WelcomeModal";

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
      {showWelcome && <WelcomeModal onClose={handleCloseWelcome} />}
      {modeUi === "BASIC" ? <BasicLayout /> : <LegacyApp />}
    </>
  );
}
