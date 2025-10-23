/**
 * PortfolioSelector.tsx
 *
 * BASIC režim: 3 vizuálne atraktívne karty pre výber portfólia
 * Užívateľ klikne na profil → aplikuje sa optimalizovaný mix
 */

import React from "react";
import {
  PORTFOLIO_PRESETS,
  adjustPresetForProfile,
  validatePresetRisk,
  type PortfolioPreset,
} from "./presets";
import { writeV3, readV3 } from "../../persist/v3";
import {
  riskScore0to10,
  approxYieldAnnualFromMix,
  getRiskCap,
  type RiskPref,
} from "../mix/assetModel";

/**
 * Farebné Tailwind utility classy pre karty (LIGHT THEME - HIGH CONTRAST)
 */
const COLOR_CLASSES = {
  blue: {
    bg: "bg-blue-50",
    border: "border-blue-300",
    borderHover: "hover:border-blue-500",
    ring: "focus:ring-blue-500",
    text: "text-blue-900",
    icon: "text-blue-600",
  },
  amber: {
    bg: "bg-amber-50",
    border: "border-amber-300",
    borderHover: "hover:border-amber-500",
    ring: "focus:ring-amber-500",
    text: "text-amber-900",
    icon: "text-amber-600",
  },
  green: {
    bg: "bg-green-50",
    border: "border-green-300",
    borderHover: "hover:border-green-500",
    ring: "focus:ring-green-500",
    text: "text-green-900",
    icon: "text-green-600",
  },
};

export default function PortfolioSelector() {
  const [selectedPreset, setSelectedPreset] = React.useState<RiskPref | null>(
    null
  );

  // Detect when component becomes visible/invisible (via parent unmount/remount)
  // Reset selection when user invalidates settings
  React.useEffect(() => {
    const v3 = readV3();
    const storedRiskPref = v3.profile?.riskPref as RiskPref | undefined;
    
    // Sync local state with persist
    if (storedRiskPref && storedRiskPref !== selectedPreset) {
      setSelectedPreset(storedRiskPref);
    }
  }, []); // Run only on mount

  // Watch for validation changes - reset selection if settings become invalid
  React.useEffect(() => {
    const handleStorageChange = () => {
      const v3 = readV3();
      const income = v3.profile?.monthlyIncome || 0;
      
      // If income drops to 0 or invalid, clear selection
      if (income <= 0 && selectedPreset) {
        console.log("[PortfolioSelector] Settings invalidated, clearing selection");
        setSelectedPreset(null);
        
        // Clear from persist too
        writeV3({
          mix: [],
          profile: {
            ...(v3.profile || {}),
            riskPref: undefined,
          } as any,
        });
      }
    };

    // Listen to storage events
    window.addEventListener("storage", handleStorageChange);
    
    // Poll for changes (fallback)
    const interval = setInterval(handleStorageChange, 200);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(interval);
    };
  }, [selectedPreset]);

  /**
   * Handler pre výber presetu
   */
  const handleSelectPreset = (preset: PortfolioPreset) => {
    const v3 = readV3();
    const profile = v3.profile || {};

    // Aplikuj reality filter
    const adjustedMix = adjustPresetForProfile(preset, {
      monthlyIncome: profile.monthlyIncome || 0,
      lumpSumEur: profile.lumpSumEur || 0,
    });

    // Validácia: over risk cap
    const risk = riskScore0to10(adjustedMix, preset.id);
    const cap = getRiskCap(preset.id);
    const validation = validatePresetRisk(adjustedMix, preset.id, risk, cap);

    if (!validation.valid) {
      console.error(
        `[PortfolioSelector] Validation failed: ${validation.message}`
      );
      // V produkcii: zobraziť toast/alert pre užívateľa
      alert(`⚠️ ${validation.message}`);
      return;
    }

    // Vypočítaj expected yield pre feedback
    const expectedYield = approxYieldAnnualFromMix(adjustedMix, preset.id);

    console.log(`[PortfolioSelector] Aplikujem ${preset.label} profil:`, {
      risk: risk.toFixed(2),
      cap,
      expectedYield: (expectedYield * 100).toFixed(1) + "%",
    });

    // Aplikuj mix do persist - PRESERVE všetky existujúce profile hodnoty
    const currentV3 = readV3(); // Fresh read pred zápisom
    writeV3({
      mix: adjustedMix,
      profile: {
        ...(currentV3.profile || {}),
        riskPref: preset.id, // Uložím preferenčný profil
      } as any,
    });

    // UI feedback
    setSelectedPreset(preset.id);

    // Optional: toast notification
    // toast.success(`✅ Aplikovaný ${preset.label} profil!`);
  };

  return (
    <div
      className="space-y-4"
      role="region"
      aria-labelledby="portfolio-selector-title"
    >
      {/* Header */}
      <div className="mb-4">
        <h3
          id="portfolio-selector-title"
          className="text-lg font-semibold text-slate-100 mb-1"
        >
          Investičný profil
        </h3>
        <p className="text-sm text-slate-300">
          Vyberte profil podľa vašej tolerancie rizika. Mix aktív sa aplikuje
          automaticky.
        </p>
      </div>

      {/* Portfolio karty */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PORTFOLIO_PRESETS.map((preset) => {
          const colors = COLOR_CLASSES[preset.color];
          const isSelected = selectedPreset === preset.id;

          return (
            <button
              key={preset.id}
              onClick={() => handleSelectPreset(preset)}
              className={`
                group relative p-6 rounded-2xl border-2 transition-all duration-200
                ${colors.bg} ${colors.border} ${colors.borderHover}
                hover:shadow-lg hover:-translate-y-1
                focus:outline-none focus:ring-2 ${colors.ring} focus:ring-offset-2
                ${isSelected ? "ring-2 " + colors.ring : ""}
              `}
              aria-pressed={isSelected}
              aria-label={`${preset.label} profil: ${preset.description}`}
            >
              {/* Ikona */}
              <div
                className={`text-5xl mb-3 transition-transform group-hover:scale-110 ${colors.icon}`}
              >
                {preset.icon}
              </div>

              {/* Label */}
              <h4 className={`text-xl font-bold mb-2 ${colors.text}`}>
                {preset.label}
              </h4>

              {/* Popis */}
              <p className="text-sm text-gray-700 leading-relaxed">
                {preset.description}
              </p>

              {/* Target risk badge */}
              <div className="mt-4 pt-3 border-t border-gray-300">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">Cieľové riziko:</span>
                  <span className="font-semibold text-gray-900">
                    {preset.targetRisk.min.toFixed(1)} -{" "}
                    {preset.targetRisk.max.toFixed(1)}
                  </span>
                </div>
              </div>

              {/* Selected indicator */}
              {isSelected && (
                <div className="absolute top-3 right-3 text-green-600">
                  <svg
                    className="w-6 h-6"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Help text */}
      <div className="mt-4 p-3 bg-gray-100 rounded-lg border border-gray-300">
        <p className="text-xs text-gray-700">
          💡 <strong>Tip:</strong> V PRO režime môžete upraviť jednotlivé aktíva
          manuálne. Prepnite režim v hornom menu.
        </p>
      </div>
    </div>
  );
}
