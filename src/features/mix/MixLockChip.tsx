/**
 * PR-4: MixLockChip
 *
 * Zobrazuje stav zamknutia portfólia + tlačidlo na odomknutie.
 */

import React from "react";
import { isMixLocked, unlockMix } from "./mix-lock";
import { TEST_IDS } from "../../testIds";

interface MixLockChipProps {
  onUnlock?: () => void;
}

export const MixLockChip: React.FC<MixLockChipProps> = ({ onUnlock }) => {
  const [locked, setLocked] = React.useState(isMixLocked());

  const handleUnlock = () => {
    unlockMix();
    setLocked(false);
    onUnlock?.();
  };

  if (!locked) return null;

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600"
      role="status"
      aria-live="polite"
    >
      <span
        className="text-xs text-slate-300"
        data-testid={TEST_IDS.CHIP_MIX_LOCKED}
      >
        🔒 Portfólio zamknuté
      </span>
      <button
        type="button"
        onClick={handleUnlock}
        data-testid={TEST_IDS.BTN_UNLOCK_MIX}
        className="text-xs px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
      >
        Zmeniť mix
      </button>
    </div>
  );
};
