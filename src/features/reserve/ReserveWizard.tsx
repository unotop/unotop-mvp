import React from "react";
import { TEST_IDS } from "../../testIds";
import { writeV3 } from "../../persist/v3";

interface Props {
  open: boolean;
  onClose: () => void;
  onApply: () => void;
  needsReserve: boolean;
  needsGold: boolean;
}

export function ReserveWizard({
  open,
  onClose,
  onApply,
  needsReserve,
  needsGold,
}: Props) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mini-wizard odporúčania"
      data-testid={TEST_IDS.WIZARD_DIALOG}
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[1100]"
    >
      <div className="bg-slate-900 rounded-xl p-5 w-[320px] space-y-4 ring-1 ring-white/10">
        <h2 className="text-sm font-semibold">Mini-wizard odporúčania</h2>
        <div className="text-xs space-y-1">
          {needsReserve && <div>Rezerva pod minimom – upraviť.</div>}
          {needsGold && <div>Zlato pod 12 % – dorovnať.</div>}
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          {(needsReserve || needsGold) && (
            <button
              data-testid={TEST_IDS.WIZARD_ACTION_APPLY}
              onClick={onApply}
              className="px-3 py-1.5 rounded bg-emerald-600 text-xs"
            >
              Použiť odporúčanie
            </button>
          )}
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded bg-slate-700 text-xs"
          >
            Zavrieť
          </button>
        </div>
      </div>
    </div>
  );
}
