import React from "react";
import { readV3, type Debt } from "../../persist/v3";
import { ProjectionChart } from "../projection/ProjectionChart";
import { MetricsSection } from "../metrics/MetricsSection";
import type { MixItem } from "../mix/mix.service";

interface ProjectionMetricsPanelProps {
  mix: MixItem[];
  lumpSumEur: number;
  monthlyVklad: number;
  horizonYears: number;
  goalAssetsEur: number;
  riskPref: "konservativny" | "vyvazeny" | "rastovy";
  mode?: "BASIC" | "PRO"; // BASIC = skryť dlhy v grafe
}

/**
 * ProjectionMetricsPanel - spojený sec4 + sec5 (oba režimy)
 * Hore: Projekcia (graf FV), Dole: Metriky (riziko, výnos, progres)
 */
export const ProjectionMetricsPanel: React.FC<ProjectionMetricsPanelProps> = ({
  mix,
  lumpSumEur,
  monthlyVklad,
  horizonYears,
  goalAssetsEur,
  riskPref,
  mode = "PRO", // default PRO (zobraz všetko)
}) => {
  // debts pre ProjectionChart
  const debts = (readV3().debts || []) as Debt[];

  return (
    <div className="space-y-4">
      {/* Hlavička */}
      <h2 className="text-lg font-bold text-slate-100 px-2">
        📈 Projekcia & Metriky
      </h2>

      {/* Projekcia (graf) */}
      <div className="rounded-2xl ring-1 ring-white/5 bg-slate-900/60 p-4">
        <ProjectionChart
          mix={mix}
          debts={debts}
          lumpSumEur={lumpSumEur}
          monthlyVklad={monthlyVklad}
          horizonYears={horizonYears}
          goalAssetsEur={goalAssetsEur}
          riskPref={riskPref}
          hideDebts={mode === "BASIC"}
        />
      </div>

      {/* Metriky */}
      <div className="rounded-2xl ring-1 ring-white/5 bg-slate-900/60 p-4">
        <MetricsSection
          lumpSumEur={lumpSumEur}
          monthlyVklad={monthlyVklad}
          horizonYears={horizonYears}
          goalAssetsEur={goalAssetsEur}
          riskPref={riskPref}
        />
      </div>
    </div>
  );
};
