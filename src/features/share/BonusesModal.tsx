import React, { useState, useRef, useEffect } from "react";

/**
 * BonusesModal.tsx - PR-13 BONUSY v "Vaša projekcia"
 *
 * Modal pre výber bonusov, ktoré užívateľ chce získať.
 * Bonusy sa ukladajú do persist v3 (contact.bonuses) a zobrazujú v ContactModal.
 */

interface BonusesModalProps {
  visible: boolean;
  onClose: () => void;
  initialBonuses?: string[];
  onApply: (bonuses: string[]) => void;
}

const BONUS_OPTIONS = [
  { id: "ufo", label: "UFO rozhovory (2× ročne zdarma)" },
  { id: "refi", label: "Refinancovanie úverov" },
  { id: "audit", label: "Audit portfólia" },
  { id: "pdf", label: "PDF kalkulátor (offline)" },
  { id: "ebook", label: "E-book: Investovanie pre začiatočníkov" },
] as const;

const REFI_OPTIONS = [
  { value: "3", label: "3 dni" },
  { value: "7", label: "7 dní" },
  { value: "14", label: "14 dní" },
] as const;

export function BonusesModal({
  visible,
  onClose,
  initialBonuses = [],
  onApply,
}: BonusesModalProps) {
  const [selectedBonuses, setSelectedBonuses] =
    useState<string[]>(initialBonuses);
  const [refiDeadline, setRefiDeadline] = useState<string>("7");
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (visible) {
      setSelectedBonuses(initialBonuses);
      // Focus na Zavrieť tlačidlo po otvorení
      setTimeout(() => closeButtonRef.current?.focus(), 100);
    }
  }, [visible, initialBonuses]);

  // Esc close
  useEffect(() => {
    if (!visible) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [visible, onClose]);

  const toggleBonus = (bonusId: string) => {
    setSelectedBonuses((prev) =>
      prev.includes(bonusId)
        ? prev.filter((id) => id !== bonusId)
        : [...prev, bonusId]
    );
  };

  const handleApply = () => {
    // Ak je refinancovanie vybrané, pridaj deadline ako suffix
    const finalBonuses = selectedBonuses.map((id) => {
      if (id === "refi") {
        return `refi_${refiDeadline}d`;
      }
      return id;
    });
    onApply(finalBonuses);
    onClose();
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bonuses-modal-title"
    >
      <div className="bg-slate-900 rounded-2xl shadow-2xl max-w-md w-full border border-white/10 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-4 flex items-center justify-between">
          <h2
            id="bonuses-modal-title"
            className="text-xl font-bold text-white flex items-center gap-2"
          >
            🎁 Výber bonusov
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Zavrieť"
            className="text-white/80 hover:text-white transition-colors p-1"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          <p className="text-sm text-slate-300">
            Vyberte si bonusy, o ktoré máte záujem. Budú súčasťou vašej
            požiadavky na projekciu.
          </p>

          {/* Checkbox list */}
          <div className="space-y-3">
            {BONUS_OPTIONS.map((option) => (
              <div key={option.id}>
                <label className="flex items-start gap-3 p-3 rounded-lg hover:bg-slate-800/50 cursor-pointer transition-colors">
                  <input
                    type="checkbox"
                    checked={selectedBonuses.includes(option.id)}
                    onChange={() => toggleBonus(option.id)}
                    className="mt-0.5 w-5 h-5 rounded border-slate-600 text-indigo-600 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                  />
                  <span className="text-sm text-slate-200 flex-1">
                    {option.label}
                  </span>
                </label>

                {/* Refi deadline dropdown (conditional) */}
                {option.id === "refi" && selectedBonuses.includes("refi") && (
                  <div className="ml-8 mt-2">
                    <label className="block text-xs text-slate-400 mb-1">
                      Termín spracovania:
                    </label>
                    <select
                      value={refiDeadline}
                      onChange={(e) => setRefiDeadline(e.target.value)}
                      className="w-full px-3 py-1.5 text-sm bg-slate-800 border border-slate-600 rounded-lg text-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      {REFI_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Summary */}
          {selectedBonuses.length > 0 && (
            <div className="mt-4 p-3 bg-indigo-900/20 border border-indigo-500/30 rounded-lg">
              <p className="text-xs text-indigo-300">
                ✓ Vybrané: <strong>{selectedBonuses.length}</strong>{" "}
                {selectedBonuses.length === 1
                  ? "bonus"
                  : selectedBonuses.length < 5
                    ? "bonusy"
                    : "bonusov"}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-800/50 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
          >
            Zrušiť
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-5 py-2 text-sm font-semibold bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-lg hover:from-indigo-500 hover:to-violet-500 transition-all shadow-lg shadow-indigo-500/20"
          >
            Použiť ({selectedBonuses.length})
          </button>
        </div>
      </div>
    </div>
  );
}
