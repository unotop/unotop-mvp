import React from "react";
import { readV3 } from "./persist/v3";
import LegacyApp from "./LegacyApp";
import BasicLayout from "./BasicLayout";

/**
 * RootLayout - top-level wrapper
 * Rozhoduje medzi BASIC a PRO režimom
 */
export default function RootLayout() {
  const seed = readV3();
  const modeUi = (seed.profile?.modeUi as any) || "BASIC";

  if (modeUi === "BASIC") {
    return <BasicLayout />;
  }
  
  return <LegacyApp />;
}
