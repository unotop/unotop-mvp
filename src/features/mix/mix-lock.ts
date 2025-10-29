/**
 * PR-4: mixLocked mechanizmus
 * 
 * Po výbere profilu (Konz/Vyváž/Rast) alebo prvom manuálnom ťahu
 * → mixLocked=true → žiadne auto-prepisy mixu (21.4/16.2/11).
 * 
 * Odomknutie: tlačidlo "Zmeniť mix" → mixLocked=false.
 */

import { readV3, writeV3 } from "../../persist/v3";

/**
 * Zamknúť mix (po výbere profilu alebo manuálnej editácii)
 */
export function lockMix(): void {
  writeV3({ mixLocked: true });
}

/**
 * Odomknúť mix (povoliť nové odporúčania)
 */
export function unlockMix(): void {
  writeV3({ mixLocked: false });
}

/**
 * Skontrolovať, či je mix zamknutý
 */
export function isMixLocked(): boolean {
  const state = readV3();
  return state.mixLocked === true;
}

/**
 * Skontrolovať, či môžeme prepísať mix
 * (neprepisujeme, ak je locked)
 */
export function canOverwriteMix(): boolean {
  return !isMixLocked();
}
