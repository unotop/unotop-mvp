/**
 * Investment Power Box - BASIC režim (PR-38)
 * Clean UI: Úroveň + Profil + Metriky + Odporúčanie (bez emoji)
 * Expandable porovnanie profilov (správne what-if výpočty)
 */

import React from "react";
import { getPlanLevel, type PlanLevel } from "../portfolio/assetMinima";
import {
  type RiskPref,
  approxYieldAnnualFromMix,
  riskScore0to10,
} from "../mix/assetModel";
import type { MixItem } from "../mix/mix.service";
import { readV3 } from "../../persist/v3";
import { computePortfolioFromInputs } from "../portfolio/portfolioEngine";

interface InvestmentPowerBoxProps {
  lumpSumEur: number;
  monthlyEur: number;
  horizonYears: number;
  goalAssetsEur: number;
  effectivePlanVolume: number;
  riskPref: RiskPref;
}

const PROFILE_LABELS: Record<RiskPref, string> = {
  konzervativny: "Konzervatívny",
  vyvazeny: "Vyvážený",
  rastovy: "Rastový",
};

const PROFILE_DESCRIPTIONS: Record<RiskPref, string> = {
  konzervativny: "najviac stabilný",
  vyvazeny: "zlatý stred",
  rastovy: "najvyšší potenciál",
};

const BAND_DESCRIPTIONS: Record<PlanLevel, string> = {
  Mini: "Začínate, pracujete s menšími sumami a budujete prvý kapitál.",
  Štart: "Máte prvý základ, pravidelne odkladáte a tvoríte rezervu.",
  Štandard: "Budujete majetok systematicky, suma je vhodná na dlhodobé ciele.",
  Silný: "Vyššie vklady, kapitál pracuje naplno pre vaše budúce ciele.",
  Prémiový:
    "Pracujete s kapitálom ako investor, využívate všetky dostupné nástroje.",
};

interface InvestmentPowerBoxProps {
  lumpSumEur: number;
  monthlyEur: number;
  horizonYears: number;
  goalAssetsEur: number;
  effectivePlanVolume: number;
  riskPref: RiskPref;
}

export default function InvestmentPowerBox({
  lumpSumEur,
  monthlyEur,
  horizonYears,
  goalAssetsEur,
  effectivePlanVolume,
  riskPref,
}: InvestmentPowerBoxProps) {
  const [showComparison, setShowComparison] = React.useState(false);

  const safeVolume = effectivePlanVolume || 0;
  const currentLevel = getPlanLevel(safeVolume);

  const v3 = readV3();

  // Načítaj profile data pre adjustments
  const monthlyIncome = (v3.profile?.monthlyIncome || 0) as number;
  const fixedExpenses = (v3.profile?.fixedExp || 0) as number;
  const variableExpenses = (v3.profile?.varExp || 0) as number;
  const reserveEur = (v3.profile?.reserveEur ||
    (v3 as any).reserveEur ||
    0) as number;
  const reserveMonths = (v3.profile?.reserveMonths ||
    (v3 as any).reserveMonths ||
    0) as number;

  // Pomocná funkcia: Vypočítaj metriky pre daný profil (what-if)
  // UI-WIRING: Použiť portfolioEngine pre každý profil (volume-aware C < B < G garantované)
  const calculateProfileMetrics = (
    targetProfile: RiskPref
  ): { yield: number; risk: number } => {
    try {
      // Zavolaj engine pre each profil (what-if) - volume-aware mixy
      const result = computePortfolioFromInputs({
        lumpSumEur: lumpSumEur || 0,
        monthlyVklad: monthlyEur || 0,
        horizonYears: horizonYears || 10,
        reserveEur: reserveEur || 0,
        reserveMonths: reserveMonths || 0,
        riskPref: targetProfile, // ← Testovaný profil (C/B/G)
      });

      return {
        yield: result.yieldPa,
        risk: result.riskScore,
      };
    } catch (error) {
      console.warn(
        `[InvestmentPowerBox] Engine failed for profile ${targetProfile}:`,
        error
      );
      // Fallback: Hard-coded preset mixy (legacy) - malo by sa nikdy nestať
      const presetMixes: Record<RiskPref, MixItem[]> = {
        konzervativny: [
          { key: "gold", pct: 20 },
          { key: "bonds", pct: 50 },
          { key: "etf", pct: 20 },
          { key: "cash", pct: 8 },
          { key: "dyn", pct: 2 },
        ],
        vyvazeny: [
          { key: "gold", pct: 12 },
          { key: "etf", pct: 40 },
          { key: "bonds", pct: 20 },
          { key: "dyn", pct: 20 },
          { key: "cash", pct: 5 },
          { key: "crypto", pct: 2 },
          { key: "real", pct: 1 },
        ],
        rastovy: [
          { key: "gold", pct: 10 },
          { key: "etf", pct: 50 },
          { key: "bonds", pct: 15 },
          { key: "dyn", pct: 20 },
          { key: "cash", pct: 2 },
          { key: "crypto", pct: 2 },
          { key: "real", pct: 1 },
        ],
      };

      const finalMix = presetMixes[targetProfile];
      const yieldAnnual = approxYieldAnnualFromMix(finalMix, targetProfile);
      const risk = riskScore0to10(finalMix, targetProfile);

      return { yield: yieldAnnual, risk };
    }
  };

  // PR-34 FIX: Aktuálny profil metriky (MAIN UI) - RE-ADJUSTUJE mix cez getAdjustedMix
  // Dôvod: v3.mix môže byť neaktuálny (auto-optimize má debounce 1s, fresh edits nemajú ProfileAssetPolicy)
  const calculateCurrentMetrics = (): { yield: number; risk: number } => {
    const actualMix = v3.mix as MixItem[] | undefined;
    const profile = v3.profile || {};

    // KRITICKÉ: Ak máme existujúci mix, re-adjustuj ho cez getAdjustedMix
    // (ak nemáme mix, použij preset a tiež re-adjustuj)
    const presetMixes: Record<RiskPref, MixItem[]> = {
      konzervativny: [
        { key: "gold", pct: 20 },
        { key: "bonds", pct: 50 },
        { key: "etf", pct: 20 },
        { key: "cash", pct: 8 },
        { key: "dyn", pct: 2 },
      ],
      vyvazeny: [
        { key: "gold", pct: 12 },
        { key: "etf", pct: 40 },
        { key: "bonds", pct: 20 },
        { key: "dyn", pct: 20 },
        { key: "cash", pct: 5 },
        { key: "crypto", pct: 2 },
        { key: "real", pct: 1 },
      ],
      rastovy: [
        { key: "gold", pct: 10 },
        { key: "etf", pct: 50 },
        { key: "bonds", pct: 15 },
        { key: "dyn", pct: 20 },
        { key: "cash", pct: 2 },
        { key: "crypto", pct: 2 },
        { key: "real", pct: 1 },
      ],
    };

    const baseMix =
      actualMix && actualMix.length > 0 ? actualMix : presetMixes[riskPref];

    // Použij portfolioEngine (single source of truth - P0.4)
    const result = computePortfolioFromInputs({
      lumpSumEur: lumpSumEur || 0,
      monthlyVklad: monthlyEur || 0,
      horizonYears: horizonYears || 10,
      reserveEur: (profile.reserveEur as number) || 0,
      reserveMonths: (profile.reserveMonths as number) || 0,
      riskPref: riskPref,
    });

    return { yield: result.yieldPa, risk: result.riskScore };
  };

  // Aktuálny profil metriky (MAIN UI - zobrazuje reálny mix)
  const currentMetrics = calculateCurrentMetrics();

  // Rezerva check
  const expenses = monthlyIncome * 0.7; // Estimate
  const recommendedReserveLow = expenses * 3;
  const recommendedReserveHigh = expenses * 6;
  const hasLowReserve = expenses > 0 && reserveEur < recommendedReserveLow;

  // Odporúčanie text
  let recommendationText = "";

  if (hasLowReserve && expenses > 0) {
    recommendationText = `Najprv si vybudujte rezervu 3–6 mesiacov. Odporúčaná rezerva: ${recommendedReserveLow.toLocaleString("sk-SK")}–${recommendedReserveHigh.toLocaleString("sk-SK")} €.`;
  } else if (currentMetrics.risk > 8.5) {
    recommendationText = `Portfólio má vyššie riziko (${currentMetrics.risk.toFixed(1)} / 10). Je vhodné pre ľudí, ktorí zvládajú väčšie výkyvy. V prípade otázok to s vami rád preberiem osobne.`;
  } else {
    recommendationText =
      "Plán je v rovnováhe, portfólio zodpovedá vášmu profilu.";
  }

  // Porovnanie profilov (what-if pre všetky 3)
  const profiles: RiskPref[] = ["konzervativny", "vyvazeny", "rastovy"];
  const profileComparison = profiles.map((prof) => {
    const metrics = calculateProfileMetrics(prof);
    return {
      profile: prof,
      label: PROFILE_LABELS[prof],
      yield: metrics.yield,
      risk: metrics.risk,
      description: PROFILE_DESCRIPTIONS[prof],
      isCurrent: prof === riskPref,
    };
  });

  // Band badge styling
  const bandStyles: Record<
    PlanLevel,
    { bg: string; text: string; border: string }
  > = {
    Mini: {
      bg: "bg-slate-500/20",
      text: "text-slate-400",
      border: "border-slate-500/50",
    },
    Štart: {
      bg: "bg-emerald-500/20",
      text: "text-emerald-400",
      border: "border-emerald-500/50",
    },
    Štandard: {
      bg: "bg-blue-500/20",
      text: "text-blue-400",
      border: "border-blue-500/50",
    },
    Silný: {
      bg: "bg-purple-500/20",
      text: "text-purple-400",
      border: "border-purple-500/50",
    },
    Prémiový: {
      bg: "bg-gradient-to-r from-amber-500/20 to-orange-500/20",
      text: "text-amber-400",
      border: "border-amber-500/50",
    },
  };

  const bandStyle = bandStyles[currentLevel.level];

  return (
    <div
      data-testid="investment-power-box"
      className="rounded-2xl bg-slate-800/50 p-4 shadow-lg ring-1 ring-slate-700/50 relative"
    >
      {/* Nadpis */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="text-base font-semibold text-slate-100">
          Sila vášho plánu
        </h3>
        {/* Band badge (vpravo hore) */}
        <span
          className={`px-2 py-0.5 rounded text-xs font-semibold border ${bandStyle.bg} ${bandStyle.text} ${bandStyle.border} whitespace-nowrap`}
        >
          {currentLevel.level.toUpperCase()}
        </span>
      </div>

      {/* Úroveň plánu */}
      <div className="mb-3">
        <p className="text-sm text-slate-300">
          <span className="font-medium">Úroveň:</span>{" "}
          <span className="font-semibold text-emerald-400">
            {currentLevel.level} plán
          </span>{" "}
          <span className="text-slate-400">
            ({safeVolume.toLocaleString("sk-SK")} €)
          </span>
        </p>
        <p className="text-xs text-slate-400 mt-1">
          {BAND_DESCRIPTIONS[currentLevel.level]}
        </p>
      </div>

      {/* Profil + Metriky */}
      <div className="space-y-1.5 text-sm mb-3">
        <p className="text-slate-300">
          <span className="font-medium">Investičný profil:</span>{" "}
          <span className="font-semibold text-blue-300">
            {PROFILE_LABELS[riskPref]}
          </span>
        </p>
        <p className="text-slate-300">
          <span className="font-medium">Očakávaný výnos:</span>{" "}
          <span className="font-semibold text-green-300">
            ~
            {currentMetrics.yield != null && !isNaN(currentMetrics.yield)
              ? (currentMetrics.yield * 100).toFixed(1)
              : "0.0"}{" "}
            % p.a.
          </span>
        </p>
        <p className="text-slate-300">
          <span className="font-medium">Riziko portfólia:</span>{" "}
          <span className="font-semibold text-amber-300">
            {currentMetrics.risk != null && !isNaN(currentMetrics.risk)
              ? currentMetrics.risk.toFixed(1)
              : "0.0"}{" "}
            / 10
          </span>
        </p>
      </div>

      {/* Odporúčanie */}
      <div className="mb-3 rounded-lg bg-slate-900/60 px-3 py-2.5 ring-1 ring-slate-700/50">
        <p className="text-xs text-slate-300">
          <span className="font-semibold text-slate-200">Odporúčanie:</span>{" "}
          {recommendationText}
        </p>
      </div>

      {/* Toggle porovnanie */}
      <div className="flex justify-end">
        <button
          onClick={() => setShowComparison(!showComparison)}
          className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors underline"
        >
          {showComparison ? "Zavrieť porovnanie" : "Porovnať profily"}
        </button>
      </div>

      {/* Expandable porovnanie */}
      {showComparison && (
        <div className="mt-4 pt-3 border-t border-slate-700/50">
          <p className="text-xs font-semibold text-slate-300 mb-2">
            Porovnanie profilov
          </p>
          <div className="space-y-2">
            {profileComparison.map((pm) => (
              <div
                key={pm.profile}
                className={`rounded-lg px-3 py-2 text-xs ring-1 ${
                  pm.isCurrent
                    ? "bg-blue-500/10 ring-blue-500/30"
                    : "bg-slate-900/40 ring-slate-700/30"
                }`}
              >
                <p className="font-semibold text-slate-200 mb-1">
                  {pm.label} – {pm.description}
                  {pm.isCurrent && (
                    <span className="ml-2 text-blue-400 font-normal">
                      (Aktuálne zvolený)
                    </span>
                  )}
                </p>
                <div className="flex items-center justify-between text-slate-300">
                  <span>
                    Očakávaný výnos: ~
                    {pm.yield != null && !isNaN(pm.yield)
                      ? (pm.yield * 100).toFixed(1)
                      : "0.0"}{" "}
                    % p.a.
                  </span>
                  <span>
                    Riziko:{" "}
                    {pm.risk != null && !isNaN(pm.risk)
                      ? pm.risk.toFixed(1)
                      : "0.0"}{" "}
                    / 10
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
