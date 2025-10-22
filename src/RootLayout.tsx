import React from "react";
import { readV3 } from "./persist/v3";
import LegacyApp from "./LegacyApp";
import BasicLayout from "./BasicLayout";

/**
 * RootLayout - top-level wrapper
 * Rozhoduje medzi BASIC a PRO režimom
 *
 * Reactive: počúva storage events pre live prepínanie
 */
export default function RootLayout() {
  const [modeUi, setModeUi] = React.useState<"BASIC" | "PRO">(() => {
    const seed = readV3();
    return (seed.profile?.modeUi as any) || "BASIC";
  });

  // Listen to storage changes (cross-tab & manual persist writes)
  React.useEffect(() => {
    const handleStorageChange = () => {
      const seed = readV3();
      const newMode = (seed.profile?.modeUi as any) || "BASIC";
      console.log("[RootLayout] Mode check:", {
        current: modeUi,
        detected: newMode,
      });
      // Len ak sa MODE skutočne zmenil (nie každá zmena v localStorage)
      setModeUi((prevMode) => (prevMode !== newMode ? newMode : prevMode));
    };

    // Poll localStorage every 100ms (simple & reliable)
    const interval = setInterval(handleStorageChange, 100);

    // Also listen to storage events (cross-tab sync)
    window.addEventListener("storage", handleStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  if (modeUi === "BASIC") {
    return <BasicLayout />;
  }

  return <LegacyApp />;
}
