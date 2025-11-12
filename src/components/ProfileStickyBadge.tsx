import React from "react";
import { readV3 } from "../persist/v3";
import { TEST_IDS } from "../testIds";
import type { RiskPref } from "../features/mix/assetModel";

const PROFILE_LABELS: Record<RiskPref, string> = {
  konzervativny: "Konzervatívny",
  vyvazeny: "Vyvážený",
  rastovy: "Rastový",
};

export function ProfileStickyBadge() {
  const [selected, setSelected] = React.useState<RiskPref | null>(null);

  React.useEffect(() => {
    const v3 = readV3();
    const profileSelected = v3.profile?.selected as RiskPref | undefined;
    setSelected(profileSelected || null);

    // Poll for changes
    const interval = setInterval(() => {
      const v3Fresh = readV3();
      const freshSelected = v3Fresh.profile?.selected as RiskPref | undefined;
      if (freshSelected !== selected) {
        setSelected(freshSelected || null);
      }
    }, 200);

    return () => clearInterval(interval);
  }, [selected]);

  if (!selected) return null;

  return (
    <div
      data-testid={TEST_IDS.PROFILE_STICKY_BADGE}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 ring-1 ring-blue-500/30 text-blue-300 text-xs font-medium"
    >
      <span aria-hidden="true">✓</span>
      <span>Profil: {PROFILE_LABELS[selected]}</span>
    </div>
  );
}
