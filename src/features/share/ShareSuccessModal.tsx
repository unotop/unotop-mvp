import React, { useRef, useEffect } from "react";

/**
 * ShareSuccessModal.tsx - PR-21 Thank-you window
 *
 * Zobrazí sa po úspešnom odoslaní projekcie.
 * Informuje používateľa, že projekcia je odoslaná a čo bude ďalej.
 */

interface ShareSuccessModalProps {
  visible: boolean;
  onClose: () => void;
}

export function ShareSuccessModal({
  visible,
  onClose,
}: ShareSuccessModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus na tlačidlo "Rozumiem" po otvorení
  useEffect(() => {
    if (visible) {
      setTimeout(() => closeButtonRef.current?.focus(), 100);
    }
  }, [visible]);

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

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-[1100]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-success-title"
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[1110] 
                   bg-white rounded-2xl shadow-2xl p-8 max-w-md w-[90vw]"
      >
        {/* Nadpis */}
        <h2
          id="share-success-title"
          className="text-2xl font-bold text-green-600 mb-4 flex items-center gap-2"
        >
          Ďakujeme, projekcia je odoslaná ✅
        </h2>

        {/* Text */}
        <div className="text-gray-700 space-y-3 mb-6">
          <p>
            Vašu projekciu sme úspešne prijali.
          </p>
          <p>
            Do <strong>24 hodín</strong> sa vám ozve náš finančný maklér, ktorý s vami:
          </p>
          <ul className="list-disc list-inside pl-2 space-y-1">
            <li>prejde výsledky vašej projekcie,</li>
            <li>vysvetlí jednotlivé možnosti,</li>
            <li>pomôže nastaviť portfólio a znížiť zbytočné náklady podľa vašej situácie.</li>
          </ul>
          <p className="text-sm text-gray-600 mt-4">
            Na váš e-mail sme poslali aj krátke potvrdenie s ďalšími informáciami.
          </p>
        </div>

        {/* Tlačidlo */}
        <button
          ref={closeButtonRef}
          onClick={onClose}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold 
                     py-3 px-6 rounded-lg transition-colors duration-200"
          aria-label="Zavrieť potvrdenie"
        >
          Rozumiem
        </button>
      </div>
    </>
  );
}
