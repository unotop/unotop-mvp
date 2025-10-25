/**
 * WarningCenter - Centrálny systém pre warnings, info a error hlásenia
 * 
 * Pravidlá:
 * - Žiadne modálne window.alert
 * - Deduplikácia (rovnaký dedupeKey v rámci 5s → ignore)
 * - Auto-dismiss po 6s (aria-live polite/assertive)
 * - Scope: 'mix', 'risk', 'global'
 */

export type WarningType = 'info' | 'warning' | 'error';
export type WarningScope = 'mix' | 'risk' | 'global';

export interface Warning {
  id: string;
  type: WarningType;
  message: string;
  scope: WarningScope;
  dedupeKey?: string;
  timestamp: number;
}

type WarningListener = (warnings: Warning[]) => void;

class WarningCenterClass {
  private warnings: Warning[] = [];
  private listeners: Set<WarningListener> = new Set();
  private dedupeMap: Map<string, number> = new Map(); // dedupeKey → timestamp
  private idCounter = 0;

  /**
   * Pridaj nové warning/info/error hlásenie
   * 
   * @param options - Warning konfigurácia
   * @returns Warning ID (pre manuálne dismiss ak treba)
   */
  push(options: {
    type: WarningType;
    message: string;
    scope?: WarningScope;
    dedupeKey?: string;
  }): string {
    const now = Date.now();
    const scope = options.scope ?? 'global';
    const dedupeKey = options.dedupeKey;

    // Deduplikácia: ak rovnaký dedupeKey v posledných 5s → ignore
    if (dedupeKey) {
      const lastTimestamp = this.dedupeMap.get(dedupeKey);
      if (lastTimestamp && now - lastTimestamp < 5000) {
        // Duplikát v rámci 5s → ignore (ale vráť existujúci ID)
        const existing = this.warnings.find((w) => w.dedupeKey === dedupeKey);
        return existing?.id ?? '';
      }
      this.dedupeMap.set(dedupeKey, now);
    }

    // Vytvor nové warning
    const id = `warning-${++this.idCounter}`;
    const warning: Warning = {
      id,
      type: options.type,
      message: options.message,
      scope,
      dedupeKey,
      timestamp: now,
    };

    this.warnings.push(warning);
    this.notifyListeners();

    // Auto-dismiss po 6s
    setTimeout(() => {
      this.dismiss(id);
    }, 6000);

    return id;
  }

  /**
   * Odstráň warning podľa ID
   */
  dismiss(id: string): void {
    const index = this.warnings.findIndex((w) => w.id === id);
    if (index !== -1) {
      this.warnings.splice(index, 1);
      this.notifyListeners();
    }
  }

  /**
   * Získaj všetky aktívne warnings
   */
  getAll(): Warning[] {
    return [...this.warnings];
  }

  /**
   * Získaj warnings pre konkrétny scope
   */
  getByScope(scope: WarningScope): Warning[] {
    return this.warnings.filter((w) => w.scope === scope);
  }

  /**
   * Vyčisti všetky warnings
   */
  clear(): void {
    this.warnings = [];
    this.dedupeMap.clear();
    this.notifyListeners();
  }

  /**
   * Subscribe na zmeny warnings
   * @returns Unsubscribe funkcia
   */
  subscribe(listener: WarningListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    const warnings = this.getAll();
    this.listeners.forEach((listener) => listener(warnings));
  }

  /**
   * Cleanup starých dedupe záznamov (>1min)
   * Volá sa periodicky na minimalizáciu memory leaks
   */
  cleanupDedupe(): void {
    const now = Date.now();
    const oneMinute = 60_000;
    
    for (const [key, timestamp] of this.dedupeMap.entries()) {
      if (now - timestamp > oneMinute) {
        this.dedupeMap.delete(key);
      }
    }
  }
}

// Singleton instance
export const WarningCenter = new WarningCenterClass();

// Periodické cleanup (každých 30s)
if (typeof window !== 'undefined') {
  setInterval(() => {
    WarningCenter.cleanupDedupe();
  }, 30_000);
}
