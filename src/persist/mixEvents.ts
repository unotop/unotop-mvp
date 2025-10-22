/**
 * Event-based synchronization for mix changes
 * Replaces 500ms polling with CustomEvent API
 */

export const MIX_CHANGE_EVENT = "unotop:mix:changed";

/**
 * Emit event when mix changes in localStorage
 * Call this after writeV3({ mix: ... })
 */
export function emitMixChangeEvent(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(MIX_CHANGE_EVENT));
  }
}

/**
 * Create event listener for mix changes
 * Usage in useEffect:
 *   useEffect(() => {
 *     return createMixListener(() => setMix(newMix));
 *   }, []);
 */
export function createMixListener(onMixChange: (newMix: any[]) => void): () => void {
  if (typeof window === "undefined") {
    return () => {}; // No-op in SSR
  }

  const handleMixChange = () => {
    // Defer to next tick to avoid sync issues
    setTimeout(() => {
      try {
        const stored = localStorage.getItem("unotop:v3");
        if (!stored) return;
        
        const parsed = JSON.parse(stored);
        const newMix = parsed.mix || [];
        onMixChange(newMix);
      } catch (err) {
        console.warn("[createMixListener] Failed to parse mix from localStorage", err);
      }
    }, 0);
  };

  window.addEventListener(MIX_CHANGE_EVENT, handleMixChange);
  
  // Return cleanup function
  return () => {
    window.removeEventListener(MIX_CHANGE_EVENT, handleMixChange);
  };
}
