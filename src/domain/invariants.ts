import { fairRoundTo100 } from "../domain/finance";

type Mix = Record<string, number>;

const GOLD_KEYS = ["Zlato (fyzické)", "Zlato"];
const DYN_KEYS = ["Dynamické riadenie", "Dynamické"];
const CRYPTO_KEYS = ["Krypto (BTC/ETH)", "Krypto"];

function pickKey(keys: string[], mix: Mix) {
  return keys.find((k) => k in mix) ?? keys[0];
}

export function applyRulesV3(input: Mix): { mix: Mix; goldFloored: boolean; dynCryptoLimited: boolean; sumRounded: boolean } {
  const out: Mix = { ...input };
  const goldKey =
    Object.keys(out).find((k) => k.startsWith("Zlato")) ||
    Object.keys(out).find((k) => /zlato/i.test(k)) ||
    pickKey(GOLD_KEYS, out);
  const dynKey = pickKey(DYN_KEYS, out);
  const cryptoKey = pickKey(CRYPTO_KEYS, out);

  const setVal = (k: string, v: number) => (out[k] = Math.max(0, Math.min(100, v)));

  let goldFloored = false;
  let dynCryptoLimited = false;

  // 1) Gold floor >= 10
  const gold = out[goldKey] ?? 0;
  if (gold < 10) {
    const delta = 10 - gold;
    setVal(goldKey, 10);
    // Take proportionally from others (excluding gold)
    const others = Object.keys(out).filter((k) => k !== goldKey && (out[k] ?? 0) > 0);
    const sumOthers = others.reduce((s, k) => s + (out[k] ?? 0), 0);
    if (sumOthers > 0) {
      others.forEach((k) => setVal(k, (out[k] ?? 0) - delta * ((out[k] ?? 0) / sumOthers)));
    }
    goldFloored = true;
  }

  // 2) Cap on dyn + crypto <= 22
  const dyn = out[dynKey] ?? 0;
  const crypto = out[cryptoKey] ?? 0;
  const dc = dyn + crypto;
  if (dc > 22) {
    const ratio = 22 / dc;
    setVal(dynKey, dyn * ratio);
    setVal(cryptoKey, crypto * ratio);
    dynCryptoLimited = true;
  }

  // 3) Sum to 100
  const normalized = fairRoundTo100(out);
  return { mix: normalized, goldFloored, dynCryptoLimited, sumRounded: true };
}
// This module exposes policy-based invariant helpers expected by App.
// If specific invariant utilities exist elsewhere, re-export them here.
export {}; // Placeholder: App wires invariants internally; this file exists to satisfy imports if used later.
