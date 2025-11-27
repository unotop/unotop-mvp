/**
 * Debug preset yields (PRED adjustments)
 */

import { describe, it } from "vitest";
import { PORTFOLIO_PRESETS } from "../src/features/portfolio/presets";
import { approxYieldAnnualFromMix } from "../src/features/mix/assetModel";

describe("DEBUG: Preset yields PRED adjustments", () => {
  it("Conservative/Balanced/Growth yields v preset definíciách", () => {
    PORTFOLIO_PRESETS.forEach((preset) => {
      const yield_ = approxYieldAnnualFromMix(preset.mix) * 100;
      console.log(`${preset.id}: yield=${yield_.toFixed(2)}%, mix=${JSON.stringify(preset.mix.filter(m => m.pct > 0).map(m => ({ k: m.key, p: m.pct })))}`);
    });
  });
});
