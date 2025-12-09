/**
 * telemetry.ts
 * Analytics tracking for policy adjustments and user interactions
 * 
 * Integrates with:
 * - Mixpanel (user behavior analytics)
 * - Google Analytics 4 (web analytics)
 */

/// <reference types="vite/client" />

import type { Stage } from "../features/policy/stage";

// Types for event parameters
export interface PolicyAdjustmentParams {
  stage: Stage;
  riskPref: string;
  reason: "gold_cap" | "etf_cap" | "risk_cap" | "dyn_crypto_combo" | "sum_drift" | "lump_scaling" | "monthly_cap" | "bond_minimum" | "elastic_cash_sink" | "down_tune" | "up_tune";
  asset?: string; // Which asset was capped (e.g., "gold", "etf")
  pct_before?: number; // Percentage before enforcement
  pct_after?: number; // Percentage after enforcement
  cap?: number; // The cap value applied
  combo_cap?: number; // For dyn+crypto combo limit
  sum_before?: number; // Total sum before normalization
  sum_after?: number; // Total sum after normalization
  overflow_absorbed?: number; // PR-14.C: Elastic cash sink - amount absorbed over cap
}

export interface WarningShownParams {
  type: "info" | "warning" | "error";
  scope: "mix" | "risk" | "global" | "minimums";
  dedupeKey?: string;
  message: string;
}

export interface CollabInterestParams {
  checked: boolean;
  stage: Stage;
  riskPref: string;
  monthlyIncome: number;
  monthlyVklad: number;
}

/**
 * Track policy adjustment event (mix enforcement by adaptive policy)
 */
export function trackPolicyAdjustment(params: PolicyAdjustmentParams): void {
  const eventName = "policy_adjustment";
  const eventData = {
    ...params,
    timestamp: new Date().toISOString(),
  };

  // Console log for development
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log(`[Telemetry] ${eventName}:`, eventData);
  }

  // Mixpanel
  if (typeof window !== "undefined" && (window as any).mixpanel) {
    try {
      (window as any).mixpanel.track(eventName, eventData);
    } catch (err) {
      console.warn("[Telemetry] Mixpanel error:", err);
    }
  }

  // Google Analytics 4
  if (typeof window !== "undefined" && (window as any).gtag) {
    try {
      (window as any).gtag("event", eventName, eventData);
    } catch (err) {
      console.warn("[Telemetry] GA4 error:", err);
    }
  }
}

/**
 * Track warning shown to user (chip or toast)
 */
export function trackWarningShown(params: WarningShownParams): void {
  const eventName = "warning_shown";
  const eventData = {
    ...params,
    timestamp: new Date().toISOString(),
  };

  // Console log for development
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log(`[Telemetry] ${eventName}:`, eventData);
  }

  // Mixpanel
  if (typeof window !== "undefined" && (window as any).mixpanel) {
    try {
      (window as any).mixpanel.track(eventName, eventData);
    } catch (err) {
      console.warn("[Telemetry] Mixpanel error:", err);
    }
  }

  // Google Analytics 4
  if (typeof window !== "undefined" && (window as any).gtag) {
    try {
      (window as any).gtag("event", eventName, {
        event_category: "warnings",
        event_label: params.dedupeKey || params.message.substring(0, 50),
        ...eventData,
      });
    } catch (err) {
      console.warn("[Telemetry] GA4 error:", err);
    }
  }
}

/**
 * Track collaboration interest checkbox (increase income opt-in)
 */
export function trackCollabInterest(params: CollabInterestParams): void {
  const eventName = "collab_interest_checked";
  const eventData = {
    ...params,
    timestamp: new Date().toISOString(),
  };

  // Console log for development
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
    console.log(`[Telemetry] ${eventName}:`, eventData);
  }

  // Mixpanel
  if (typeof window !== "undefined" && (window as any).mixpanel) {
    try {
      (window as any).mixpanel.track(eventName, eventData);
    } catch (err) {
      console.warn("[Telemetry] Mixpanel error:", err);
    }
  }

  // Google Analytics 4
  if (typeof window !== "undefined" && (window as any).gtag) {
    try {
      (window as any).gtag("event", eventName, {
        event_category: "engagement",
        event_label: params.checked ? "interested" : "not_interested",
        ...eventData,
      });
    } catch (err) {
      console.warn("[Telemetry] GA4 error:", err);
    }
  }
}

/**
 * Initialize telemetry (call once on app mount)
 */
export function initTelemetry(): void {
  // Mixpanel init (if API key present)
  const mixpanelToken = import.meta.env.VITE_MIXPANEL_TOKEN;
  if (mixpanelToken && typeof window !== "undefined" && !(window as any).mixpanel) {
    // Load Mixpanel SDK dynamically
    const script = document.createElement("script");
    script.src = "https://cdn.mxpnl.com/libs/mixpanel-2-latest.min.js";
    script.async = true;
    script.onload = () => {
      if ((window as any).mixpanel) {
        (window as any).mixpanel.init(mixpanelToken, {
          debug: import.meta.env.DEV,
          track_pageview: true,
          persistence: "localStorage",
        });
        console.log("[Telemetry] Mixpanel initialized");
      }
    };
    document.head.appendChild(script);
  }

  // GA4 init (if measurement ID present)
  const ga4MeasurementId = import.meta.env.VITE_GA4_MEASUREMENT_ID;
  if (ga4MeasurementId && typeof window !== "undefined" && !(window as any).gtag) {
    // Load GA4 SDK dynamically
    const script = document.createElement("script");
    script.src = `https://www.googletagmanager.com/gtag/js?id=${ga4MeasurementId}`;
    script.async = true;
    document.head.appendChild(script);

    // Initialize gtag
    (window as any).dataLayer = (window as any).dataLayer || [];
    function gtag(...args: any[]) {
      (window as any).dataLayer.push(args);
    }
    (window as any).gtag = gtag;
    gtag("js", new Date());
    gtag("config", ga4MeasurementId, {
      send_page_view: true,
    });
    console.log("[Telemetry] GA4 initialized");
  }
}

