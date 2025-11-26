/**
 * Investment Power Box - UX komponent pre Phase B (PR-28)
 */

import {
  getPlanLevel,
  getNextPlanLevel,
  checkAssetEligibility,
  type PlanLevel,
} from "../portfolio/assetMinima";

interface InvestmentPowerBoxProps {
  effectivePlanVolume: number;
  horizonYears: number;
  monthlyEur: number;
}

const ASSET_LABELS: Record<string, string> = {
  gold: "Zlato",
  etf: "ETF",
  crypto: "Krypto",
  cash: "IAD depozitné konto",
  dyn: "Dynamické riadenie",
  bonds: "Dlhopisy",
  bond3y9: "Dlhopisy 3-9r",
  real: "Reality",
};

const LEVEL_COLORS: Record<
  PlanLevel,
  { bg: string; text: string; ring: string }
> = {
  Mini: { bg: "bg-gray-700", text: "text-gray-300", ring: "ring-gray-600" },
  Štart: { bg: "bg-blue-700", text: "text-blue-200", ring: "ring-blue-600" },
  Štandard: {
    bg: "bg-green-700",
    text: "text-green-200",
    ring: "ring-green-600",
  },
  Silný: {
    bg: "bg-purple-700",
    text: "text-purple-200",
    ring: "ring-purple-600",
  },
  Prémiový: {
    bg: "bg-amber-700",
    text: "text-amber-200",
    ring: "ring-amber-600",
  },
};

export default function InvestmentPowerBox({
  effectivePlanVolume,
  horizonYears,
  monthlyEur,
}: InvestmentPowerBoxProps) {
  const safeVolume = effectivePlanVolume || 0;
  const safeHorizon = horizonYears || 0;

  const currentLevel = getPlanLevel(safeVolume);
  const nextLevel = getNextPlanLevel(safeVolume);
  const assetEligibility = checkAssetEligibility(safeVolume);

  const deltaToNext = nextLevel ? nextLevel.min - safeVolume : 0;
  const deltaMonthly = safeHorizon > 0 ? deltaToNext / (safeHorizon * 12) : 0;

  const levelStyle = LEVEL_COLORS[currentLevel.level];

  return (
    <div
      data-testid="investment-power-box"
      className="rounded-2xl bg-slate-800/50 p-6 shadow-lg ring-1 ring-slate-700/50"
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-100">
          💪 Sila vášho plánu
        </h3>
        <div
          className={`rounded-full px-4 py-1.5 text-sm font-bold ring-2 ${levelStyle.bg} ${levelStyle.text} ${levelStyle.ring}`}
        >
          {currentLevel.level}
        </div>
      </div>

      <p className="mb-4 text-sm text-slate-400">
        <span className="font-medium text-slate-300">
          {safeVolume.toLocaleString("sk-SK")}{" "}
        </span>{" "}
        — {currentLevel.description}
      </p>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {assetEligibility
          .filter((a) => ASSET_LABELS[a.key])
          .map((asset) => {
            const isEligible = asset.eligible;
            return (
              <div
                key={asset.key}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                  isEligible
                    ? "bg-green-900/30 text-green-300 ring-1 ring-green-800/50"
                    : "bg-slate-700/30 text-slate-500 ring-1 ring-slate-700/50"
                }`}
                title={
                  isEligible
                    ? `${ASSET_LABELS[asset.key]} dostupné`
                    : `${ASSET_LABELS[asset.key]} od ${asset.minVolume.toLocaleString("sk-SK")} `
                }
              >
                <span className="text-base">{isEligible ? "✅" : "🔒"}</span>
                <span className="font-medium">{ASSET_LABELS[asset.key]}</span>
              </div>
            );
          })}
      </div>

      {nextLevel && deltaToNext > 0 && (
        <div className="rounded-lg bg-blue-900/20 px-4 py-3 text-sm ring-1 ring-blue-800/30">
          <p className="text-slate-300">
            <span className="font-semibold text-blue-300">💡 Tip:</span> Chýba
            vám{" "}
            <span className="font-bold text-blue-200">
              {deltaToNext.toLocaleString("sk-SK")}{" "}
            </span>{" "}
            k úrovni <span className="font-bold">{nextLevel.level}</span>
            {deltaMonthly > 0 && (
              <>
                , to je{" "}
                <span className="font-bold text-blue-200">
                  +{Math.ceil(deltaMonthly).toLocaleString("sk-SK")} /mes
                </span>{" "}
                pri {safeHorizon} rokoch
              </>
            )}
            .
          </p>
        </div>
      )}

      {currentLevel.level === "Mini" && (
        <div className="mt-3 rounded-lg bg-amber-900/20 px-4 py-3 text-sm ring-1 ring-amber-800/30">
          <p className="text-amber-200">
            <span className="font-semibold">⚠️ Odporúčame navýšiť vklady.</span>{" "}
            Pri tomto objeme ide skôr o symbolické sporenie – portfólio má
            obmedzené možnosti.
          </p>
        </div>
      )}
    </div>
  );
}
