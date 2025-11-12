import React from "react";
import { readV3 } from "../persist/v3";
import { TEST_IDS } from "../testIds";
import type { RiskPref } from "../features/mix/assetModel";

export function RecChangedChip() {
  const [showChip, setShowChip] = React.useState(false);

  React.useEffect(() => {
    const check = () => {
      const v3 = readV3();
      const selected = v3.profile?.selected as RiskPref | undefined;
      const current = v3.profile?.riskPref as RiskPref | undefined;

      // Show chip if selected exists but differs from current (user changed inputs → preset recalculated)
      if (selected && current && selected !== current) {
        setShowChip(true);
      } else {
        setShowChip(false);
      }
    };

    check();

    // Poll for changes
    const interval = setInterval(check, 200);
    return () => clearInterval(interval);
  }, []);

  if (!showChip) return null;

  return (
    <div
      data-testid={TEST_IDS.REC_CHANGED_CHIP}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 ring-1 ring-amber-500/30 text-amber-300 text-xs font-medium"
    >
      <span aria-hidden="true">⚠️</span>
      <span>Odporúčaný preset sa zmenil</span>
    </div>
  );
}
