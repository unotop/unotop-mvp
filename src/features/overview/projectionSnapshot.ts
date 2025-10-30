/**
 * PR-4 Task 5: Snapshot mechanizmus pre projekciu
 * 
 * Variant B: Metriky live, projekcia/graf na CTA
 * 
 * Snapshot = frozen state inputov pre projekciu (FV, graf)
 * Live = aktuálne hodnoty pre metriky (Riziko, Výnos)
 */

import { readV3 } from "../../persist/v3";

export interface ProjectionSnapshot {
  lumpSumEur: number;
  monthlyVklad: number;
  horizonYears: number;
  goalAssetsEur: number;
  timestamp: number;
}

const SNAPSHOT_KEY = "unotop:projectionSnapshot";

export const getSnapshot = (): ProjectionSnapshot | null => {
  try {
    const stored = localStorage.getItem(SNAPSHOT_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as ProjectionSnapshot;
  } catch {
    return null;
  }
};

export const saveSnapshot = (): ProjectionSnapshot => {
  const v3 = readV3();
  const snapshot: ProjectionSnapshot = {
    lumpSumEur: (v3.profile?.lumpSumEur as any) || 0,
    monthlyVklad: (v3 as any).monthly || 0,
    horizonYears: (v3.profile?.horizonYears as any) || 10,
    goalAssetsEur: (v3.profile?.goalAssetsEur as any) || 0,
    timestamp: Date.now(),
  };
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
  return snapshot;
};

export const isDirty = (): boolean => {
  const v3 = readV3();
  const snap = getSnapshot();
  
  if (!snap) return false; // Žiadny snapshot = nie je dirty (prvý load)

  const current = {
    lumpSumEur: (v3.profile?.lumpSumEur as any) || 0,
    monthlyVklad: (v3 as any).monthly || 0,
    horizonYears: (v3.profile?.horizonYears as any) || 10,
    goalAssetsEur: (v3.profile?.goalAssetsEur as any) || 0,
  };

  return (
    current.lumpSumEur !== snap.lumpSumEur ||
    current.monthlyVklad !== snap.monthlyVklad ||
    current.horizonYears !== snap.horizonYears ||
    current.goalAssetsEur !== snap.goalAssetsEur
  );
};

export const clearSnapshot = () => {
  localStorage.removeItem(SNAPSHOT_KEY);
};
