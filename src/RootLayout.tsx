import React from "react";
import { readV3 } from "./persist/v3";
import LegacyApp from "./LegacyApp";

/**
 * RootLayout - top-level wrapper
 * Rozhoduje medzi BASIC a PRO režimom
 * 
 * TODO: Implementovať BASIC layout (Phase 2)
 * Momentálne len passthrough na LegacyApp (PRO)
 */
export default function RootLayout() {
  const seed = readV3();
  const modeUi = (seed.profile?.modeUi as any) || "BASIC";

  // TODO Phase 2: Conditional rendering
  // if (modeUi === "BASIC") return <BasicLayout />;
  
  return <LegacyApp />;
}
