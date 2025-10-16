import React, { useEffect, useRef } from "react";

type Mode = "basic" | "pro";

export const OnboardingChoice: React.FC<{
  open: boolean;
  onClose: () => void;
  onChoose: (mode: Mode) => void;
}> = ({ open, onClose, onChoose }) => {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const firstBtnRef = useRef<HTMLButtonElement | null>(null);
  const lastBtnRef = useRef<HTMLButtonElement | null>(null);

  // Focus trap and ESC handling
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => firstBtnRef.current?.focus(), 0);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else if (e.key === "Tab") {
        // simple focus trap between the two buttons
        const active = document.activeElement as HTMLElement | null;
        if (!active) return;
        const shift = (e as KeyboardEvent).shiftKey;
        if (shift && active === firstBtnRef.current) {
          e.preventDefault();
          lastBtnRef.current?.focus();
        } else if (!shift && active === lastBtnRef.current) {
          e.preventDefault();
          firstBtnRef.current?.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const choose = (mode: Mode) => {
    try {
      localStorage.setItem("uiMode", mode);
    } catch {}
    try {
      (document?.documentElement as any).dataset.uiMode = mode;
    } catch {}
    onChoose(mode);
  };

  const onBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Voľba režimu rozhrania"
      onMouseDown={onBackdrop}
    >
      <div
        ref={dialogRef}
        className="mx-3 max-w-md w-full rounded-xl border border-slate-700 bg-slate-950/90 shadow-2xl p-4"
      >
        <div className="text-center mb-3 text-slate-200 text-sm">
          Zvoľ si režim rozhrania
        </div>
        <div className="flex gap-3">
          <button
            ref={firstBtnRef}
            type="button"
            className="flex-1 px-3 py-2 rounded-lg border border-indigo-500/70 bg-indigo-600/25 hover:bg-indigo-600/35 text-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            aria-description="Jednoduché ovládanie a modrá skin farba posuvníkov"
            onClick={() => choose("basic")}
          >
            BASIC
          </button>
          <button
            ref={lastBtnRef}
            type="button"
            className="flex-1 px-3 py-2 rounded-lg border border-amber-500/70 bg-amber-600/25 hover:bg-amber-600/35 text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
            aria-description="Pokročilé ovládanie a zlatá skin farba posuvníkov"
            onClick={() => choose("pro")}
          >
            PRO
          </button>
        </div>
        <div className="mt-3 text-center">
          <button
            type="button"
            className="text-[12px] text-slate-400 underline-offset-2 hover:underline"
            onClick={onClose}
            aria-label="Zmeniť neskôr"
          >
            Zmeniť neskôr
          </button>
        </div>
      </div>
    </div>
  );
};
