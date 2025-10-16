import React from "react";

type Props = {
  onPick: (mode: "basic" | "pro") => void;
  onDismiss: () => void; // nastaví onboardingDismissed=true
};

export default function ModePickerDialog({ onPick, onDismiss }: Props) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Voľba režimu rozhrania"
      data-testid="mode-picker-dialog"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm"
    >
      <div className="mx-3 max-w-md w-full rounded-xl border border-slate-700 bg-slate-950/90 shadow-2xl p-4">
        <h2 className="text-sm font-semibold mb-1">Zvoliť režim</h2>
        <div className="flex gap-3">
          <button
            autoFocus
            aria-description="Jednoduché ovládanie a modrá skin farba posuvníkov"
            className="flex-1 px-3 py-2 rounded-lg border border-indigo-500/70 bg-indigo-600/25 hover:bg-indigo-600/35 text-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            onClick={() => {
              onPick("basic");
              onDismiss();
            }}
            type="button"
          >
            BASIC
          </button>
          <button
            aria-description="Pokročilé ovládanie a zlatá skin farba posuvníkov"
            aria-label="PRO"
            className="flex-1 px-3 py-2 rounded-lg border border-amber-500/70 bg-amber-600/25 hover:bg-amber-600/35 text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
            onClick={() => {
              onPick("pro");
              onDismiss();
            }}
            type="button"
          >
            PRO
          </button>
        </div>

        <div className="mt-3 text-center">
          <button
            aria-label="Zmeniť neskôr"
            className="text-[12px] text-slate-400 underline-offset-2 hover:underline"
            onClick={onDismiss}
            type="button"
          >
            Zmeniť neskôr
          </button>
        </div>
      </div>
    </div>
  );
}
