/**
 * Visual styling configuration for portfolio assets
 * Color-coded for intuitive recognition in PRO mode
 */

import type { MixItem } from "./mix.service";

export type AssetKey = MixItem["key"];

export interface AssetStyle {
  key: AssetKey;
  label: string;
  color: string; // Tailwind color name (amber, emerald, blue, etc.)
  bgGradient: string; // Background gradient classes
  ringColor: string; // Ring color classes
  icon: string; // Emoji icon
  hoverShadow: string; // Shadow color on hover
}

export const ASSET_STYLES: Record<AssetKey, AssetStyle> = {
  gold: {
    key: "gold",
    label: "Zlato (fyzické)",
    color: "amber",
    bgGradient: "from-amber-500/20 to-yellow-500/10",
    ringColor: "ring-amber-500/40 hover:ring-amber-500/60",
    icon: "🥇",
    hoverShadow: "hover:shadow-amber-500/30",
  },
  dyn: {
    key: "dyn",
    label: "Dynamické riadenie",
    color: "emerald",
    bgGradient: "from-emerald-500/20 to-green-500/10",
    ringColor: "ring-emerald-500/40 hover:ring-emerald-500/60",
    icon: "📈",
    hoverShadow: "hover:shadow-emerald-500/30",
  },
  etf: {
    key: "etf",
    label: "ETF (svet – aktívne)",
    color: "blue",
    bgGradient: "from-blue-500/20 to-cyan-500/10",
    ringColor: "ring-blue-500/40 hover:ring-blue-500/60",
    icon: "🌐",
    hoverShadow: "hover:shadow-blue-500/30",
  },
  bonds: {
    key: "bonds",
    label: "Garantovaný dlhopis 7,5% p.a.",
    color: "slate",
    bgGradient: "from-slate-500/20 to-slate-600/10",
    ringColor: "ring-slate-500/40 hover:ring-slate-500/60",
    icon: "🏦",
    hoverShadow: "hover:shadow-slate-500/30",
  },
  cash: {
    key: "cash",
    label: "Hotovosť/rezerva",
    color: "gray",
    bgGradient: "from-gray-500/20 to-gray-600/10",
    ringColor: "ring-gray-500/40 hover:ring-gray-500/60",
    icon: "💵",
    hoverShadow: "hover:shadow-gray-500/30",
  },
  crypto: {
    key: "crypto",
    label: "Krypto (BTC/ETH)",
    color: "purple",
    bgGradient: "from-purple-500/20 to-fuchsia-500/10",
    ringColor: "ring-purple-500/40 hover:ring-purple-500/60",
    icon: "₿",
    hoverShadow: "hover:shadow-purple-500/30",
  },
  real: {
    key: "real",
    label: "Reality (komerčné)",
    color: "orange",
    bgGradient: "from-orange-500/20 to-amber-600/10",
    ringColor: "ring-orange-500/40 hover:ring-orange-500/60",
    icon: "🏢",
    hoverShadow: "hover:shadow-orange-500/30",
  },
  bond3y9: {
    key: "bond3y9",
    label: "Dlhopis 9% p.a. (3r, mesačný CF)",
    color: "teal",
    bgGradient: "from-teal-500/20 to-cyan-600/10",
    ringColor: "ring-teal-500/40 hover:ring-teal-500/60",
    icon: "�",
    hoverShadow: "hover:shadow-teal-500/30",
  },
};

/**
 * Get asset style configuration by key
 */
export function getAssetStyle(key: AssetKey): AssetStyle {
  return ASSET_STYLES[key];
}

/**
 * Generate slider track gradient CSS (visual fill effect)
 */
export function getSliderTrackGradient(
  pct: number,
  color: string
): React.CSSProperties {
  return {
    background: `linear-gradient(to right, 
      hsl(var(--${color}-500) / 0.6) 0%, 
      hsl(var(--${color}-500) / 0.6) ${pct}%, 
      hsl(var(--slate-700) / 0.3) ${pct}%, 
      hsl(var(--slate-700) / 0.3) 100%)`,
  };
}
