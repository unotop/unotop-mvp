import { type ReactNode } from "react";

interface SubmissionWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  remaining: number;
  resetDate: string;
}

/**
 * Warning modal shown before submission when rate limit is active
 */
export default function SubmissionWarningModal({
  isOpen,
  onClose,
  onConfirm,
  remaining,
  resetDate,
}: SubmissionWarningModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="warning-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-2xl ring-1 ring-white/10 p-6 space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
          <div className="flex-1">
            <h2 id="warning-title" className="text-lg font-semibold text-white">
              Ste si istý?
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Odoslanie projekcie sa počíta do vášho mesačného limitu.
            </p>
          </div>
        </div>

        {/* Info */}
        <div className="bg-slate-800/50 rounded-lg p-4 space-y-2 ring-1 ring-white/5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Zostávajúce pokusy:</span>
            <span className="font-semibold text-white">{remaining} / 3</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Reset limitu:</span>
            <span className="text-slate-300 text-xs">{resetDate}</span>
          </div>
        </div>

        {/* Warning message */}
        {remaining === 1 && (
          <div className="bg-amber-500/10 ring-1 ring-amber-500/30 rounded-lg p-3">
            <p className="text-xs text-amber-200">
              💡 <strong>Toto je váš posledný pokus tento mesiac.</strong> Po
              odoslaní nebudete môcť poslať ďalšiu projekciu až do {resetDate}.
            </p>
          </div>
        )}

        {remaining === 2 && (
          <div className="bg-blue-500/10 ring-1 ring-blue-500/30 rounded-lg p-3">
            <p className="text-xs text-blue-200">
              💡 Môžete poslať <strong>max. 2 projekcie mesačne</strong>, aby
              sme predišli spamu.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium text-sm transition-colors"
          >
            Zrušiť
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 hover:shadow-lg hover:shadow-emerald-500/30 text-white font-medium text-sm transition-all"
          >
            Áno, odoslať
          </button>
        </div>
      </div>
    </div>
  );
}
