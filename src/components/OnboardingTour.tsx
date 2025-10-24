import React from "react";

/**
 * OnboardingTour - Ľahký tooltip sprievodca (bez overlay)
 * Zobrazuje malé tooltips priamo pri sekciách
 */

interface OnboardingStep {
  id: number;
  title: string;
  description: string;
  targetId: string;
  position: "top" | "bottom" | "left" | "right";
}

const TOUR_STEPS: OnboardingStep[] = [
  {
    id: 1,
    title: "📝 Začnite s cashflow",
    description: "Vyplňte príjem a výdavky",
    targetId: "sec1",
    position: "right", // Ľavý panel → tooltip vpravo
  },
  {
    id: 2,
    title: "🎯 Investičné ciele",
    description: "Nastavte vklad, horizont a cieľ",
    targetId: "sec2",
    position: "right", // Ľavý panel → tooltip vpravo
  },
  {
    id: 3,
    title: "💼 Vyberte portfólio",
    description: "Zvoľte si rizikový profil",
    targetId: "sec3",
    position: "right", // Ľavý panel → tooltip vpravo
  },
  {
    id: 4,
    title: "📊 Sledujte projekciu",
    description: "Tu vidíte rast vášho majetku",
    targetId: "projection-panel",
    position: "left", // Pravý panel → tooltip vľavo
  },
  {
    id: 5,
    title: "🚀 Zrealizujte plán",
    description: "Odošlite projekciu agentovi",
    targetId: "share-section",
    position: "left", // Pravý panel → tooltip vľavo
  },
];

interface OnboardingTourProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  currentStep: number;
}

export const OnboardingTour: React.FC<OnboardingTourProps> = ({
  isOpen,
  onClose,
  onComplete,
  currentStep: propStep,
}) => {
  const [tooltipPosition, setTooltipPosition] = React.useState({
    top: 0,
    left: 0,
  });
  const [isPositioned, setIsPositioned] = React.useState(false);

  const step = TOUR_STEPS[propStep - 1];

  // Vypočítaj pozíciu tooltipu s clampingom do viewportu
  React.useEffect(() => {
    if (!isOpen || !step) {
      setIsPositioned(false);
      return;
    }

    // Log len pri prvom otvorení kroku
    console.log("[OnboardingTour] Opening step:", step.id, step.title);
    console.log("[OnboardingTour] Looking for targetId:", step.targetId);

    const updatePosition = () => {
      const targetEl = document.getElementById(step.targetId);

      if (!targetEl) {
        console.error(
          "[OnboardingTour] ❌ Target element NOT FOUND:",
          step.targetId
        );
        console.log(
          "[OnboardingTour] Available IDs in DOM:",
          Array.from(document.querySelectorAll("[id]"))
            .map((el) => el.id)
            .join(", ")
        );
        return;
      }

      console.log("[OnboardingTour] ✅ Target element found:", step.targetId);

      const rect = targetEl.getBoundingClientRect();
      const tooltipWidth = 320; // max-w-xs = 320px
      const tooltipHeight = 180; // estimate
      const offset = 20;

      let top = 0;
      let left = 0;

      // Pozícia podľa step.position
      switch (step.position) {
        case "bottom":
          top = rect.bottom + offset;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          break;
        case "top":
          top = rect.top - tooltipHeight - offset;
          left = rect.left + rect.width / 2 - tooltipWidth / 2;
          break;
        case "left":
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.left - tooltipWidth - offset;
          break;
        case "right":
          top = rect.top + rect.height / 2 - tooltipHeight / 2;
          left = rect.right + offset;
          break;
      }

      // Clamp do viewportu
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const padding = 16;

      left = Math.max(
        padding,
        Math.min(left, viewportWidth - tooltipWidth - padding)
      );
      top = Math.max(
        padding,
        Math.min(top, viewportHeight - tooltipHeight - padding)
      );

      setTooltipPosition({ top, left });
      if (!isPositioned) {
        console.log("[OnboardingTour] Positioned at:", { top, left });
      }
      setIsPositioned(true);

      // Scroll do view
      targetEl.scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "nearest",
      });
    };

    // Delay aby DOM stihol render
    const timer = setTimeout(updatePosition, 100);

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, step, propStep]);

  if (!isOpen || !step) return null;

  const handleSkip = () => {
    onClose();
  };

  return (
    <>
      {/* Ľahký semi-transparent overlay (nie čierny) */}
      <div
        className="fixed inset-0 bg-slate-900/20 backdrop-blur-[2px] z-[9998] transition-opacity"
        onClick={handleSkip}
        aria-hidden="true"
      />

      {/* Malý tooltip (nie modal) */}
      <div
        className="fixed z-[9999] pointer-events-auto max-w-xs"
        style={{
          top: `${tooltipPosition.top}px`,
          left: `${tooltipPosition.left}px`,
          opacity: isPositioned ? 1 : 0,
          transition: "opacity 0.2s ease-in-out",
        }}
      >
        <div
          className="bg-gradient-to-br from-emerald-600 to-emerald-700 text-white rounded-xl shadow-2xl p-4 border border-emerald-400/30"
          role="dialog"
          aria-modal="false"
          aria-labelledby="tour-title"
          aria-describedby="tour-description"
        >
          {/* Header s progress */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-100 uppercase tracking-wider">
              {propStep} / {TOUR_STEPS.length}
            </span>
            <button
              onClick={handleSkip}
              className="text-white/70 hover:text-white transition-colors"
              aria-label="Zavrieť"
            >
              <svg
                className="w-4 h-4"
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

          {/* Title */}
          <h3 id="tour-title" className="text-sm font-bold mb-1 text-white">
            {step.title}
          </h3>

          {/* Description */}
          <p
            id="tour-description"
            className="text-xs text-emerald-50 mb-3 leading-relaxed"
          >
            {step.description}
          </p>

          {/* Action button */}
          <button
            onClick={onComplete}
            className="w-full px-3 py-1.5 rounded-lg bg-white text-emerald-700 text-xs font-semibold hover:bg-emerald-50 transition-colors shadow-md"
          >
            Rozumiem ✓
          </button>
        </div>

        {/* Šípka (pointer) */}
        <div
          className={`absolute w-0 h-0 ${
            step.position === "bottom"
              ? "top-0 left-1/2 -translate-x-1/2 -translate-y-full border-l-8 border-r-8 border-b-8 border-transparent border-b-emerald-600"
              : step.position === "top"
                ? "bottom-0 left-1/2 -translate-x-1/2 translate-y-full border-l-8 border-r-8 border-t-8 border-transparent border-t-emerald-600"
                : step.position === "left"
                  ? "right-0 top-1/2 translate-x-full -translate-y-1/2 border-t-8 border-b-8 border-l-8 border-transparent border-l-emerald-600"
                  : "left-0 top-1/2 -translate-x-full -translate-y-1/2 border-t-8 border-b-8 border-r-8 border-transparent border-r-emerald-600"
          }`}
        />
      </div>
    </>
  );
};
