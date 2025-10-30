/**
 * PR-4 Task 5: Chip "Zmeny čakajú..." + CTA "Prepočítať projekciu"
 * 
 * Zobrazuje sa, keď sú zmeny v inputoch, ktoré ešte neboli aplikované na projekciu
 */

import React from "react";
import { TEST_IDS } from "../../testIds";
import { isDirty, saveSnapshot } from "../overview/projectionSnapshot";

interface DirtyChangesChipProps {
  onRecompute: () => void;
}

export const DirtyChangesChip: React.FC<DirtyChangesChipProps> = ({
  onRecompute,
}) => {
  const [dirty, setDirty] = React.useState(false);

  // Check dirty state pri mount a pri zmene (cez polling alebo event)
  React.useEffect(() => {
    const checkDirty = () => setDirty(isDirty());
    checkDirty();

    // Poll každých 500ms (simple solution)
    const interval = setInterval(checkDirty, 500);
    return () => clearInterval(interval);
  }, []);

  if (!dirty) return null;

  const handleRecompute = () => {
    saveSnapshot(); // Uloží aktuálny stav ako snapshot
    setDirty(false);
    onRecompute(); // Notify parent (refresh projekcie)
  };

  return (
    <div
      data-testid={TEST_IDS.CHIP_DIRTY_CHANGES}
      className="flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-amber-900/20 ring-1 ring-amber-500/30"
    >
      <div className="flex items-center gap-2">
        <span className="text-amber-400 text-lg">⏳</span>
        <span className="text-sm text-amber-300 font-medium">
          Zmeny čakajú na prepočítanie
        </span>
      </div>
      <button
        type="button"
        data-testid={TEST_IDS.CTA_RECOMPUTE}
        onClick={handleRecompute}
        className="px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition-colors"
      >
        Prepočítať projekciu
      </button>
    </div>
  );
};
