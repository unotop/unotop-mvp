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
  getAdjustedPreset,
  type PortfolioPreset,
  type ProfileForAdjustments,
} from "./presets";
import { writeV3, readV3 } from "../../persist/v3";
import { lockMix } from "../mix/mix-lock"; // PR-4
import {
  riskScore0to10,
  approxYieldAnnualFromMix,
  type RiskPref,
} from "../mix/assetModel";
import { detectStage } from "../policy/stage";
import { getAdaptiveRiskCap } from "../policy/risk";
import { WarningCenter } from "../ui/warnings/WarningCenter";
import { InfoMixLine } from "../../components/InfoMixLine";
import { ProfileStickyBadge } from "../../components/ProfileStickyBadge";
import { RecChangedChip } from "../../components/RecChangedChip";
import type { MixItem } from "../../persist/v3";

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

interface PortfolioSelectorProps {
  mix: MixItem[];
}

export default function PortfolioSelector({ mix }: PortfolioSelectorProps) {
  const [selectedPreset, setSelectedPreset] = React.useState<RiskPref | null>(
    null
  );

  // Read lumpSumEur ONCE at component mount/update (not in render)
  const [showLowDepositInfo, setShowLowDepositInfo] = React.useState(false);

  React.useEffect(() => {
    const v3 = readV3();
    const lumpSumEur = v3.profile?.lumpSumEur || 0;
    setShowLowDepositInfo(lumpSumEur < 2500);
  }, []); // Empty deps = run once on mount

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
      const lumpSum = v3.profile?.lumpSumEur || 0;
      const monthly = (v3 as any).monthly || 0;
      const horizon = v3.profile?.horizonYears || 0;
      const goal = v3.profile?.goalAssetsEur || 0;

      // If income drops to 0 or invalid, clear selection
      if (income <= 0 && selectedPreset) {
        console.log(
          "[PortfolioSelector] Settings invalidated, clearing selection"
        );
        setSelectedPreset(null);

        // PR-14: Clear only riskPref, keep mix for projection continuity
        writeV3({
          profile: {
            ...(v3.profile || {}),
            riskPref: undefined,
          } as any,
        });
      }

      // PR-14 CHANGE: Removed investment params change detection
      // Portfolio selection now persists across lump/monthly/horizon/goal changes
      // Only cleared when income becomes invalid (above) or user manually switches profiles
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
   * Check či je preset dostupný (blokované pri nízkych vkladoch)
   */
  const isPresetAvailable = (presetId: RiskPref): boolean => {
    // All portfolios always available per PR-11
    return true;
  };

  /**
   * Handler pre výber presetu - aplikuje VŠETKY adjustments (lump/monthly/cash/bonds)
   */
  const handleSelectPreset = (preset: PortfolioPreset) => {
    // CRITICAL: Fresh read aby sme dostali latest monthly value (debounce delay fix)
    const v3 = readV3();
    const profile = v3.profile || {};

    // DEBUG PR-12: Log vstupného stavu
    console.log("[PortfolioSelector] ========== SELECT START ==========");
    console.log("[PortfolioSelector] Selecting preset:", {
      presetId: preset.id,
      lumpSumEur: profile.lumpSumEur || 0,
      monthly: (v3 as any).monthly || 0,
      monthlyIncome: profile.monthlyIncome || 0,
      totalFirstYear:
        (profile.lumpSumEur || 0) + ((v3 as any).monthly || 0) * 12,
    });

    // Vytvor profile object pre getAdjustedPreset
    const profileForAdj: ProfileForAdjustments = {
      lumpSumEur: profile.lumpSumEur || 0,
      monthlyEur: (v3 as any).monthly || 0,
      horizonYears: profile.horizonYears || 10,
      monthlyIncome: profile.monthlyIncome || 0,
      fixedExpenses: profile.fixedExp || 0,
      variableExpenses: profile.varExp || 0,
      reserveEur: profile.reserveEur || 0,
      reserveMonths: profile.reserveMonths || 0,
      goalAssetsEur: profile.goalAssetsEur || 0,
      riskPref: preset.id as RiskPref,
    };

    // Aplikuj všetky adjustments (lump sum scaling, monthly capping, cash reserve, bond minimum, stage caps)
    const {
      preset: adjustedPreset,
      warnings,
      info,
    } = getAdjustedPreset(preset, profileForAdj);

    const adjustedMix = adjustedPreset.mix;

    // Detekuj stage pre adaptívny risk cap (PR-8)
    const stage = detectStage(
      profileForAdj.lumpSumEur,
      profileForAdj.monthlyEur,
      profileForAdj.horizonYears,
      profileForAdj.goalAssetsEur
    );

    // Validácia: over adaptive risk cap + low investment warning
    const risk = riskScore0to10(adjustedMix, preset.id);
    const cap = getAdaptiveRiskCap(preset.id as RiskPref, stage);
    const validation = validatePresetRisk(
      adjustedMix,
      preset.id,
      risk,
      cap,
      profileForAdj.lumpSumEur,
      profileForAdj.monthlyEur
    );

    if (!validation.valid) {
      console.error(
        `[PortfolioSelector] ========== VALIDATION FAILED ==========`
      );
      console.error(
        `[PortfolioSelector] Validation failed: ${validation.message}`
      );
      WarningCenter.push({
        type: "error",
        message: validation.message || "Validácia zlyhala",
        scope: "risk",
        dedupeKey: "preset-validation",
      });
      return;
    }

    // PR-13: Zobraz warning ak isWarning=true, ale neprerušuj výber
    if (validation.isWarning && validation.message) {
      WarningCenter.push({
        type: "warning",
        message: validation.message,
        scope: "risk",
        dedupeKey: "preset-risk-warning",
      });
    }

    // PR-13 ULTIMATE: Spracuj adjustment warnings
    if (warnings.includes("risk-target-limited")) {
      WarningCenter.push({
        type: "info",
        message:
          "Cieľové riziko limitované – vyžaduje vyšší vklad alebo menej konzervatívne nastavenia.",
        scope: "risk",
        dedupeKey: "risk-target-limited",
      });
    }

    // Vypočítaj expected yield pre feedback
    const expectedYield = approxYieldAnnualFromMix(adjustedMix, preset.id);

    console.log(`[PortfolioSelector] ========== APPLYING MIX ==========`);
    console.log(
      `[PortfolioSelector] Aplikujem ${preset.label} profil s adjustments:`,
      {
        risk: risk.toFixed(2),
        cap,
        expectedYield: (expectedYield * 100).toFixed(1) + "%",
        warnings,
        finalMix: adjustedMix
          .map((m) => `${m.key}:${m.pct.toFixed(1)}`)
          .join(", "),
      }
    );

    // Aplikuj adjusted mix do persist
    const currentV3 = readV3();
    writeV3({
      mix: adjustedMix,
      profile: {
        ...(currentV3.profile || {}),
        riskPref: preset.id,
        selected: preset.id, // PR-7 Task 4: sticky profile selection
      } as any,
      // PR-12: Mix origin tracking pre lazy reapply
      mixOrigin: "presetAdjusted",
      presetId: preset.id as "konzervativny" | "vyvazeny" | "rastovy",
      profileSnapshot: {
        lumpSum: profileForAdj.lumpSumEur,
        monthly: profileForAdj.monthlyEur,
        horizon: profileForAdj.horizonYears,
        ts: Date.now(),
      },
    });

    // PR-4: Zamknúť mix po výbere profilu
    lockMix();

    // UI feedback
    setSelectedPreset(preset.id);

    // PR-14: Removed snapshot storage (no longer needed)

    // Auto-scroll to metrics + pulse animation
    setTimeout(() => {
      const metricsRoot = document.getElementById("metrics-root");
      if (metricsRoot) {
        metricsRoot.scrollIntoView({ behavior: "smooth", block: "start" });

        // Pulse animation on KPI cards (find scorecards in MetricsSection)
        setTimeout(() => {
          const scorecards = metricsRoot.querySelectorAll("[data-kpi-card]");
          scorecards.forEach((card) => {
            card.classList.add("animate-pulse");
            setTimeout(() => card.classList.remove("animate-pulse"), 600);
          });
        }, 400); // Wait for scroll to complete
      }
    }, 100);
  };

  return (
    <div
      className="space-y-4"
      role="region"
      aria-labelledby="portfolio-selector-title"
    >
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
          <h3
            id="portfolio-selector-title"
            className="text-lg font-semibold text-slate-100"
          >
            Investičný profil
          </h3>
          <div className="flex items-center gap-2">
            <ProfileStickyBadge />
            <RecChangedChip />
          </div>
        </div>
        <p className="text-sm text-slate-300">
          Vyberte profil podľa vašej tolerancie rizika. Mix aktív sa aplikuje
          automaticky.
        </p>
      </div>

      {/* INFO: Upozornenie pri nízkych vkladoch */}
      {showLowDepositInfo && (
        <div className="mb-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1 text-sm">
              <p className="font-semibold text-blue-300 mb-1">
                Tip: Zadajte jednorazový vklad
              </p>
              <p className="text-slate-300">
                Pri jednorazovom vklade pod <strong>2 500 €</strong> niektoré
                aktíva (dlhopisy, dynamické riadenie) nie sú dostupné kvôli
                minimálnym vstupným prahom. Pre plný prístup ku všetkým
                možnostiam zvýšte jednorazový vklad alebo pokračujte s mesačným
                sporením.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Portfolio karty */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PORTFOLIO_PRESETS.map((preset) => {
          const colors = COLOR_CLASSES[preset.color];
          const isSelected = selectedPreset === preset.id;
          const isAvailable = isPresetAvailable(preset.id);

          return (
            <button
              key={preset.id}
              onClick={() => handleSelectPreset(preset)}
              disabled={!isAvailable}
              className={`
                group relative p-6 rounded-2xl border-2 transition-all duration-200
                ${colors.bg} ${colors.border} ${colors.borderHover}
                ${
                  isAvailable
                    ? "hover:shadow-lg hover:-translate-y-1 cursor-pointer"
                    : "opacity-40 cursor-not-allowed"
                }
                focus:outline-none focus:ring-2 ${colors.ring} focus:ring-offset-2
                ${isSelected ? "ring-2 " + colors.ring : ""}
              `}
              aria-pressed={isSelected}
              aria-disabled={!isAvailable}
              aria-label={`${preset.label} profil: ${preset.description}${!isAvailable ? " (nedostupný pri nízkych vkladoch)" : ""}`}
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

              {/* Nedostupné badge */}
              {!isAvailable && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 rounded-2xl">
                  <div className="text-center px-4">
                    <div className="text-2xl mb-2">🔒</div>
                    <p className="text-sm font-semibold text-white mb-1">
                      Nedostupné
                    </p>
                    <p className="text-xs text-slate-300">Min. 2 000 EUR/rok</p>
                  </div>
                </div>
              )}

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

      {/* InfoMixLine: Single-line mix preview (PR-7 Task 3) */}
      <InfoMixLine mix={mix} />
    </div>
  );
}
