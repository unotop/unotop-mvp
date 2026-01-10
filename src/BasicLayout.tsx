import React from "react";
import PageLayout from "./app/PageLayout";
import Toolbar from "./components/Toolbar";
import Sidebar from "./components/Sidebar";
import { OnboardingTour } from "./components/OnboardingTour";
import { PrivacyModal } from "./components/PrivacyModal"; // PR-7: GDPR
import { ShareSuccessModal } from "./features/share/ShareSuccessModal"; // PR-21: Thank-you modal
import { Footer } from "./components/layout/Footer"; // PR-7: Footer s GDPR linkom
import { StickyBottomBar } from "./components/StickyBottomBar"; // PR-7: Bottom bar s CTA
// PR-12: AdminConsole moved to RootLayout (global)
// ContactModal REMOVED - ShareModal je správny formulár
import { BasicSettingsPanel } from "./features/basic/BasicSettingsPanel";
import PortfolioSelector from "./features/portfolio/PortfolioSelector";
import { BasicProjectionPanel } from "./features/overview/BasicProjectionPanel";
// PR-27: ValuationModeSelector moved to BasicProjectionPanel
// PR-6 Task E+F: DirtyChangesChip removed (instant reactivity via useProjection hook)
// PR-12: useProjection import pre drift detection
import { useProjection } from "./features/projection/useProjection";
import { RecalculateProfileChip } from "./components/RecalculateProfileChip"; // PR-12
import {
  getAdjustedPreset,
  enforceStageCaps, // PR-14.D: Import pre cache clear
  type ProfileForAdjustments,
  type AdjustmentWarning,
  PORTFOLIO_PRESETS,
} from "./features/portfolio/presets";
import { readV3, writeV3 } from "./persist/v3";
import { createMixListener, emitMixChangeEvent } from "./persist/mixEvents";
import type { MixItem } from "./features/mix/mix.service";
import { calculateFutureValue } from "./engine/calculations";
import {
  approxYieldAnnualFromMix,
  type RiskPref,
} from "./features/mix/assetModel";
import { detectStage } from "./features/policy/stage";
import {
  validateBasicWorkflow,
  getValidationMessage,
  type ValidationState,
} from "./utils/validation";
import {
  validateEmail,
  validatePhone,
  type ValidationErrors,
} from "./utils/validation-helpers";
import {
  sendProjectionEmail,
  sendViaMailto,
  type ProjectionData,
} from "./services/email.service";
// ADVISOR DEBUG: InvestmentPowerBox test
import InvestmentPowerBox from "./features/invest/InvestmentPowerBox";
import { calculateEffectivePlanVolume } from "./features/portfolio/assetMinima";
// PR-27: Inflation helpers for share modal
import { toRealValue, toNominalGoal } from "./utils/inflation";
import {
  canSubmit,
  getRemainingSubmissions,
  getResetDate,
  recordSubmission,
  getRemainingCooldown,
} from "./utils/rate-limiter";
import SubmissionWarningModal from "./components/SubmissionWarningModal";
import { WarningCenter } from "./features/ui/warnings/WarningCenter"; // PR-12
import { ToastStack } from "./features/ui/warnings/ToastStack";
import { isDev, isPreview } from "./shared/env"; // PR-15: Debug logy v DEV mode
import { useReCaptcha } from "./hooks/useReCaptcha"; // PR-23: reCAPTCHA v3

// PR-13 HOTFIX: Bonusy pre BasicLayout formulár (identické s ContactModal)
const BONUS_OPTIONS = [
  {
    id: "ufo",
    label: "UFO – Univerzálny finančný organizér ZDARMA",
    testId: "bonus-ufo",
    disabled: false,
    tooltip: undefined,
  },
  {
    id: "refi",
    label: "Refinancovanie / zníženie splátok hypotéky",
    testId: "bonus-refi",
    disabled: false,
    tooltip: undefined,
  },
  {
    id: "expenses",
    label: "Chcem znížiť/optimalizovať svoje výdavky",
    testId: "bonus-expenses",
    disabled: false,
    tooltip: undefined,
  },
  {
    id: "reserve",
    label: "Chcem pomôcť nastaviť rezervu a investičný plán",
    testId: "bonus-reserve",
    disabled: false,
    tooltip: undefined,
  },
  {
    id: "income",
    label: "Chcem zvýšiť svoj príjem – zaujíma ma spolupráca s UNOTOP",
    testId: "bonus-income",
    disabled: false,
    tooltip: undefined,
  },
  {
    id: "audit",
    label: "Bezplatný audit poistiek a úverov",
    testId: "bonus-audit",
    disabled: false,
    tooltip: undefined,
  },
  {
    id: "pdf",
    label: "PDF report mojej projekcie",
    testId: "bonus-pdf",
    disabled: false,
    tooltip: undefined,
  },
  {
    id: "ebook",
    label: "E-book zdarma (už čoskoro)",
    testId: "bonus-ebook",
    disabled: true,
    tooltip: "Dostupné po vydaní",
  },
] as const;

const REFI_DEADLINE_OPTIONS = [
  { value: "3", label: "3 dni" },
  { value: "7", label: "7 dní" },
  { value: "14", label: "14 dní" },
] as const;

// PR-13 HOTFIX: Helper pre formátovanie bonusov do storage
function formatBonusForStorage(bonusId: string, refiDeadline: string): string {
  const option = BONUS_OPTIONS.find((opt) => opt.id === bonusId);
  if (!option) return bonusId;
  if (bonusId === "refi") {
    return `${option.label} (ponuka do ${refiDeadline} dní)`;
  }
  return option.label;
}

/**
 * BasicLayout - jednoduchá verzia pre nováčikov
 * Left: Nastavenia (profil+cashflow+invest) + Portfolio
 * Right: Projekcia & Metriky (spojené)
 */
export default function BasicLayout({
  onAboutClick,
  onAdminOpen, // PR-16: DEV admin button v toolbare
}: {
  onAboutClick?: () => void;
  onAdminOpen?: () => void; // PR-16
}) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [open0, setOpen0] = React.useState(true); // Settings panel
  const [open3, setOpen3] = React.useState(true); // Portfolio panel
  const [shareOpen, setShareOpen] = React.useState(false);
  const [shareSuccessOpen, setShareSuccessOpen] = React.useState(false); // PR-21: Thank-you modal
  const [bonusesExpanded, setBonusesExpanded] = React.useState(false); // PR-17: Collapsible bonuses
  const shareBtnRef = React.useRef<HTMLButtonElement>(null);

  // PR-27: Valuation mode state (nominal = primárny, real = kúpna sila)
  const [valuationMode, setValuationMode] = React.useState<"real" | "nominal">(
    () => {
      const v3 = readV3();
      return v3.profile?.valuationMode || "nominal";
    }
  );

  // PR-27: Sync valuationMode with v3 changes (deeplink load, cross-tab updates)
  React.useEffect(() => {
    const handleStorageChange = () => {
      const v3 = readV3();
      const newMode = v3.profile?.valuationMode || "real";
      if (newMode !== valuationMode) {
        setValuationMode(newMode);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [valuationMode]);

  // PR-6 Task E+F: projectionRefresh removed (instant reactivity via useProjection hook)

  // PR-7: Privacy modal state
  const [privacyOpen, setPrivacyOpen] = React.useState(false);

  // PR-12: Admin console state moved to RootLayout (global)

  // ContactModal state REMOVED - používame ShareModal

  // Onboarding tour state - progresívny systém
  const [tourOpen, setTourOpen] = React.useState(false);
  const [currentTourStep, setCurrentTourStep] = React.useState(1);
  const [completedSteps, setCompletedSteps] = React.useState<number[]>(() => {
    const saved = localStorage.getItem("unotop:tour_steps");
    return saved ? JSON.parse(saved) : [];
  });

  // Helper: Ulož dokončené kroky
  const saveCompletedSteps = (steps: number[]) => {
    localStorage.setItem("unotop:tour_steps", JSON.stringify(steps));
    setCompletedSteps(steps);
  };

  // Helper: Označ krok ako dokončený a zobraz ďalší HNEĎ
  const markStepComplete = (stepId: number) => {
    if (!completedSteps.includes(stepId)) {
      const updated = [...completedSteps, stepId];
      saveCompletedSteps(updated);

      // Zatvor aktuálny tooltip
      setTourOpen(false);

      // Zobraz ďalší krok okamžite (ak existuje)
      const nextStep = stepId + 1;
      if (nextStep <= 5 && !updated.includes(nextStep)) {
        setTimeout(() => {
          setCurrentTourStep(nextStep);
          setTourOpen(true);
        }, 400); // Krátka pauza pre plynulejší prechod
      }
    }
  };

  // TASK A: Onboarding Tour je teraz DOBROVOĽNÝ - auto-spustenie vypnuté
  // Tour sa spúšťa len cez tlačidlo "🎓 Sprievodca" v topbare
  // Welcome modal ostáva bez zmeny (stále auto-zobrazenie pri prvom vstupe)
  React.useEffect(() => {
    // Cleanup session flags (už sa nepoužívajú pre auto-spustenie)
    sessionStorage.removeItem("unotop_startTourAfterWelcome");
    sessionStorage.removeItem("unotop_skipTourAfterIntro");

    console.log(
      "[Tour] Auto-start disabled - use 'Sprievodca' button to start tour"
    );
  }, []);

  // REFERRAL SYSTEM: Čítanie ?ref= z URL (raz pri mount)
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");

    if (ref) {
      const normalized = ref.toLowerCase();

      // Validácia: 2 písmená + 2 čísla (ab01, jb01, om01...)
      if (/^[a-z]{2}\d{2}$/.test(normalized)) {
        // Ulož do v3 profile
        const currentV3 = readV3();
        writeV3({
          profile: {
            ...currentV3.profile,
            agentRefCode: normalized,
          },
        });

        console.log(`[Referral] Agent code saved: ${normalized}`);
      } else {
        console.warn(`[Referral] Invalid ref format (expected: ab01): ${ref}`);
      }

      // Vyčisti URL (bez reload)
      const { origin, pathname, hash } = window.location;
      const cleanUrl = origin + pathname + hash;
      window.history.replaceState(null, "", cleanUrl);
    }
  }, []); // Prázdne deps = raz pri mount

  const handleTourComplete = () => {
    setTourOpen(false);
    // Označiť aktuálny krok ako dokončený
    markStepComplete(currentTourStep);
  };

  const handleTourClose = () => {
    setTourOpen(false);
  };

  // Funkcia na reštart tour (volaná z Toolbar)
  const restartTour = () => {
    // Vyčisti completed steps aby detektory mohli fungovať znovu
    localStorage.removeItem("unotop:tour_steps");
    localStorage.removeItem("unotop:tour_started"); // PR-13 Fix
    setCompletedSteps([]);
    setCurrentTourStep(1);
    setTourOpen(true);
  };

  // Reset tour (pre testovanie)
  const resetTour = () => {
    localStorage.removeItem("unotop:tour_steps");
    localStorage.removeItem("unotop:tour_started"); // PR-13 Fix
    setCompletedSteps([]);
    setCurrentTourStep(1);
  };

  // Form state for share modal - PR-22: Prefill from v3.contact
  const [formData, setFormData] = React.useState(() => {
    const v3 = readV3();
    const contact = v3.contact || {};

    // Split name into firstName + lastName
    const nameParts = (contact.name || "").trim().split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || "";

    return {
      firstName,
      lastName,
      phone: contact.phone || "",
      email: contact.email || "",
      gdprConsent: false, // Never prefill consent
      honeypot: "",
      selectedBonuses: (contact.bonuses || []) as string[],
      refiDeadline: "7",
    };
  });
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitStatus, setSubmitStatus] = React.useState<
    "idle" | "success" | "error"
  >("idle");
  const [validationErrors, setValidationErrors] =
    React.useState<ValidationErrors>({});
  const [showWarningModal, setShowWarningModal] = React.useState(false);
  const [confirmationCode, setConfirmationCode] = React.useState<string>("");

  // Portfolio adjustment warnings
  const [adjustmentWarnings, setAdjustmentWarnings] = React.useState<
    AdjustmentWarning[]
  >([]);
  const [adjustmentInfo, setAdjustmentInfo] = React.useState<any>(null);

  const seed = readV3();
  const modeUi = (seed.profile?.modeUi as any) || "BASIC";

  // PR-23: reCAPTCHA v3 hook
  const { execute: executeRecaptcha, isReady: isRecaptchaReady } =
    useReCaptcha();

  // Track collabOptIn for real-time sync
  const [collabOptInState, setCollabOptInState] = React.useState(
    !!(seed.profile as any)?.collabOptIn
  );

  // Sync collabOptIn from "Čo ďalej?" do selectedBonuses (real-time)
  React.useEffect(() => {
    setFormData((prev) => {
      const hasIncome = prev.selectedBonuses.includes("income");

      // Pridaj "income" ak je collabOptIn true ale ešte nie je v bonusoch
      if (collabOptInState && !hasIncome) {
        return {
          ...prev,
          selectedBonuses: [...prev.selectedBonuses, "income"],
        };
      }

      // Odstráň "income" ak je collabOptIn false ale je v bonusoch
      if (!collabOptInState && hasIncome) {
        return {
          ...prev,
          selectedBonuses: prev.selectedBonuses.filter((id) => id !== "income"),
        };
      }

      return prev;
    });
  }, [collabOptInState]); // Re-sync pri zmene collabOptIn

  // Listen for collabOptIn changes in localStorage/v3
  React.useEffect(() => {
    const interval = setInterval(() => {
      const v3 = readV3();
      const currentCollabOptIn = !!(v3.profile as any)?.collabOptIn;
      if (currentCollabOptIn !== collabOptInState) {
        setCollabOptInState(currentCollabOptIn);
      }
    }, 500); // Check every 500ms

    return () => clearInterval(interval);
  }, [collabOptInState]);

  // PR-6 Task E+F: projectionRefresh removed (debts tracked by useProjection hook debtsKey)

  // Client type (individual/family/firm)
  const clientType = (seed.profile?.clientType as any) || "individual";
  const isPortfolioLocked = clientType === "family" || clientType === "firm";

  // Cashflow state (pre tour step 1 detector)
  const [cashflowData, setCashflowData] = React.useState(() => {
    const v3 = readV3();
    return {
      monthlyIncome: (v3.profile?.monthlyIncome as any) || 0,
      fixedExp: (v3.profile?.fixedExp as any) || 0,
      varExp: (v3.profile?.varExp as any) || 0,
    };
  });

  // Mix sync from localStorage
  const [mix, setMix] = React.useState<MixItem[]>(() => {
    const v3 = readV3();
    return (v3.mix || []) as MixItem[];
  });

  // Investment params sync (pre ProjectionMetricsPanel reaktivitu)
  const [investParams, setInvestParams] = React.useState(() => {
    const v3 = readV3();
    return {
      lumpSumEur: (v3.profile?.lumpSumEur as any) || 0,
      monthlyVklad: (v3 as any).monthly || 0,
      horizonYears: (v3.profile?.horizonYears as any) || 10,
      goalAssetsEur: (v3.profile?.goalAssetsEur as any) || 0,
    };
  });

  // UI-WIRING: useProjection pre ShareModal preview (single source of truth)
  const shareModalProjection = useProjection({
    lumpSumEur: investParams.lumpSumEur,
    monthlyVklad: investParams.monthlyVklad,
    horizonYears: investParams.horizonYears,
    goalAssetsEur: investParams.goalAssetsEur,
    mix,
    debts: seed.debts || [],
    riskPref: (seed.profile?.riskPref as any) || "vyvazeny",
  });

  React.useEffect(() => {
    const unsub = createMixListener((newMix) => {
      setMix(newMix as MixItem[]);
    });
    return unsub;
  }, []);

  // PR-15: Sync cashflow data from persist (300ms polling + value equality guard)
  React.useEffect(() => {
    const interval = setInterval(() => {
      const v3 = readV3();
      const nextCashflowData = {
        monthlyIncome: (v3.profile?.monthlyIncome as any) || 0,
        fixedExp: (v3.profile?.fixedExp as any) || 0,
        varExp: (v3.profile?.varExp as any) || 0,
      };

      // PR-15: Value equality check - setState len ak changed
      setCashflowData((prev) => {
        const changed =
          prev.monthlyIncome !== nextCashflowData.monthlyIncome ||
          prev.fixedExp !== nextCashflowData.fixedExp ||
          prev.varExp !== nextCashflowData.varExp;

        if (changed && (isDev() || isPreview())) {
          console.log("[POLL] cashflow changed", nextCashflowData);
        }

        return changed ? nextCashflowData : prev;
      });
    }, 300); // PR-15: 100ms → 300ms
    return () => clearInterval(interval);
  }, []);

  // PR-15: Sync invest params from persist (300ms polling + value equality guard)
  React.useEffect(() => {
    const interval = setInterval(() => {
      const v3 = readV3();
      const nextInvestParams = {
        lumpSumEur: (v3.profile?.lumpSumEur as any) || 0,
        monthlyVklad: (v3 as any).monthly || 0,
        horizonYears: (v3.profile?.horizonYears as any) || 10,
        goalAssetsEur: (v3.profile?.goalAssetsEur as any) || 0,
      };

      // PR-15: Value equality check - setState len ak changed
      setInvestParams((prev) => {
        const changed =
          prev.lumpSumEur !== nextInvestParams.lumpSumEur ||
          prev.monthlyVklad !== nextInvestParams.monthlyVklad ||
          prev.horizonYears !== nextInvestParams.horizonYears ||
          prev.goalAssetsEur !== nextInvestParams.goalAssetsEur;

        if (changed && (isDev() || isPreview())) {
          console.log("[POLL] invest changed", nextInvestParams);
        }

        return changed ? nextInvestParams : prev;
      });
    }, 300); // PR-15: 100ms → 300ms
    return () => clearInterval(interval);
  }, []);

  // Validation state (reactive)
  const validationState: ValidationState = React.useMemo(() => {
    return validateBasicWorkflow({
      monthlyIncome: cashflowData.monthlyIncome,
      fixedExp: cashflowData.fixedExp,
      varExp: cashflowData.varExp,
      lumpSumEur: investParams.lumpSumEur,
      monthlyVklad: investParams.monthlyVklad,
      horizonYears: investParams.horizonYears,
      goalAssetsEur: investParams.goalAssetsEur,
      mix: mix,
    });
  }, [cashflowData, investParams, mix]);

  const validationMessage = getValidationMessage(validationState);

  // PR-12: Force refresh drift state po zmene mixu (aby chip zmiznul po reapply)
  const [driftRefreshKey, setDriftRefreshKey] = React.useState(0);

  React.useEffect(() => {
    return createMixListener(() => {
      // Mix changed → refresh drift detection
      setDriftRefreshKey((prev) => prev + 1);
    });
  }, []);

  // PR-12 FIX: Zaokrúhľovanie horizontu (stabilita bez FP šumu)
  const horizonYearsRounded = Math.round(investParams.horizonYears);

  // PR-12 FIX: Stabilné primitívy v dependencies (nie object reference)
  const v3ForDrift = React.useMemo(
    () => readV3(),
    [
      driftRefreshKey,
      investParams.lumpSumEur,
      investParams.monthlyVklad,
      horizonYearsRounded,
      investParams.goalAssetsEur,
    ]
  );

  const projection = useProjection({
    lumpSumEur: investParams.lumpSumEur,
    monthlyVklad: investParams.monthlyVklad,
    horizonYears: investParams.horizonYears,
    goalAssetsEur: investParams.goalAssetsEur,
    mix,
    debts: v3ForDrift.debts || [],
    riskPref: (v3ForDrift.profile?.riskPref as RiskPref) || "vyvazeny",
    modeUi: (v3ForDrift.profile?.modeUi as any) || "BASIC", // PR-12: režim UI
  });

  // PR-12 FIX: Stabilné kľúče pre auto-optimize dependencies (s rounded horizon)
  const stableInvestKey = `${investParams.lumpSumEur}-${investParams.monthlyVklad}-${horizonYearsRounded}-${investParams.goalAssetsEur}`;
  const stableCashflowKey = `${cashflowData.monthlyIncome}-${cashflowData.fixedExp}-${cashflowData.varExp}`;

  // PR-13 FIX: Track posledného auto-optimize (zabráni zbytočným re-runs)
  const lastAutoOptimizeRef = React.useRef<string>("");

  // PR-12: BETA auto-optimize - automatický reapply ak je toggle ON
  React.useEffect(() => {
    const v3 = readV3();
    const autoOptEnabled = v3.profile?.autoOptimizeMix ?? true; // Default ON
    const modeUi = (v3.profile?.modeUi as any) || "BASIC";

    // PR-15: Debug log v DEV (effect trigger)
    if ((isDev() || isPreview()) && (projection.hasDrift || autoOptEnabled)) {
      console.log("[AUTO-OPT] effect trigger", {
        stableInvestKey,
        stableCashflowKey,
        hasDrift: projection.hasDrift,
        canReapply: projection.canReapply,
        driftFields: projection.driftFields,
      });
    }

    // Auto-optimize LEN v BASIC režime (PRO ochrana)
    if (modeUi !== "BASIC") return;

    // Skip ak toggle OFF
    if (!autoOptEnabled) return;

    // PR-12 FIX: Early-return ak drift neexistuje (kontrola v tele, nie v deps)
    if (!projection.hasDrift || !projection.canReapply) return;

    // Skip ak presetId chýba
    if (!v3.presetId) return;

    // PR-13 FIX: Guard proti infinite loop - skip ak snapshot je čerstvý (< 3s)
    const snapshot = v3.profileSnapshot as
      | { lumpSum: number; monthly: number; horizon: number; ts: number }
      | undefined;
    if (snapshot && snapshot.ts) {
      const age = Date.now() - snapshot.ts;
      if (age < 3000) {
        console.log(
          "[BasicLayout] Auto-optimize skipped - snapshot too fresh (age:",
          age,
          "ms)"
        );
        return;
      }
    }

    // Debounce 1s (čakaj kým používateľ dokončí zmeny)
    const timer = setTimeout(() => {
      // PR-13 FIX: Skip ak sme už spustili auto-optimize pre tieto hodnoty
      const currentKey = `${stableInvestKey}-${stableCashflowKey}`;
      if (lastAutoOptimizeRef.current === currentKey) {
        console.log(
          "[BasicLayout] Auto-optimize skipped - already processed:",
          currentKey
        );
        return;
      }

      console.log("[BasicLayout] BETA auto-optimize triggered");

      const preset = PORTFOLIO_PRESETS.find((p) => p.id === v3.presetId);
      if (!preset) return;

      const profile: ProfileForAdjustments = {
        lumpSumEur: investParams.lumpSumEur,
        monthlyEur: investParams.monthlyVklad,
        horizonYears: investParams.horizonYears,
        monthlyIncome: cashflowData.monthlyIncome,
        fixedExpenses: cashflowData.fixedExp,
        variableExpenses: cashflowData.varExp,
        reserveEur: (v3.profile?.reserveEur as any) || 0,
        reserveMonths: (v3.profile?.reserveMonths as any) || 0,
        goalAssetsEur: investParams.goalAssetsEur,
        riskPref: v3.presetId as RiskPref,
      };

      const { preset: adjusted } = getAdjustedPreset(preset, profile);

      // Aplikuj mix + update snapshot
      writeV3({
        mix: adjusted.mix,
        mixOrigin: "presetAdjusted",
        presetId: v3.presetId,
        profileSnapshot: {
          lumpSum: investParams.lumpSumEur,
          monthly: investParams.monthlyVklad,
          horizon: investParams.horizonYears,
          ts: Date.now(),
        },
      });

      // Trigger mix change event (aby sa chip refresh)
      emitMixChangeEvent();

      // PR-13 FIX: Označ že sme spracovali tieto hodnoty
      lastAutoOptimizeRef.current = currentKey;

      // Toast
      WarningCenter.push({
        type: "info",
        message: "🔄 Mix prispôsobený novým vstupom (auto-optimize)",
        scope: "global",
        dedupeKey: "auto-optimize",
      });
    }, 1000); // Debounce 1s

    return () => clearTimeout(timer);
  }, [
    // PR-12 FIX: Odstránené projection.hasDrift/canReapply z deps
    // (kontrolujeme v tele effectu early-return, aby sme predišli slučkám)
    stableInvestKey,
    stableCashflowKey,
  ]);

  // PR-11: AUTO-APPLY PROFILU ODSTRÁNENÉ
  // Dôvod: "Zamŕzajúci yield" bug - mix sa prepísal na profilové presety
  // Riešenie: Mix = single source of truth, aplikuje sa LEN pri kliknutí na profil
  // useProjection hook prepočítava yield/risk/FV live z aktuálneho mixu
  //
  // REMOVED useEffect: Auto-recalculation pri zmene vstupov (lumpSum, monthly, horizon, goal)
  // IMPACT: Profil sa NEaplikuje automaticky, používateľ musí KLIKNÚŤ na profil
  // UX: Jasnejšie - mix sa nemení "magic-om"

  // PR-34: currentRiskPref musí byť MIMO useEffect (potrebujeme ho v render scope)
  const v3 = readV3();
  const currentRiskPref = (v3.profile?.riskPref as any) || "vyvazeny";

  React.useEffect(() => {
    // PR-14.D: Vyčisti cache pri zmene vstupov (aby sa prepočítali caps/mix s novými parametrami)
    if (
      typeof enforceStageCaps === "function" &&
      (enforceStageCaps as any)._cache
    ) {
      (enforceStageCaps as any)._cache.clear();
    }

    // Vytvor profile object pre adjustments
    const profile: ProfileForAdjustments = {
      lumpSumEur: investParams.lumpSumEur,
      monthlyEur: investParams.monthlyVklad,
      horizonYears: investParams.horizonYears,
      monthlyIncome: cashflowData.monthlyIncome,
      fixedExpenses: cashflowData.fixedExp,
      variableExpenses: cashflowData.varExp,
      reserveEur: (v3.profile?.reserveEur as any) || 0,
      reserveMonths: (v3.profile?.reserveMonths as any) || 0,
    };

    // Nájdi aktuálny preset
    const currentPreset = PORTFOLIO_PRESETS.find(
      (p) => p.id === currentRiskPref
    );
    if (!currentPreset) return;

    // Aplikuj adjustments
    const { preset, warnings, info } = getAdjustedPreset(
      currentPreset,
      profile
    );

    // Update warnings a info state
    setAdjustmentWarnings(warnings);
    setAdjustmentInfo(info);

    // NEROB automatickú aktualizáciu mixu - používateľ musí vybrať profil manuálne
    // (aby sme neprepisovali jeho ručné zmeny)
  }, [stableInvestKey, stableCashflowKey]);

  // PR-11: UNCHECK PROFILU PRI ZMENE VSTUPOV ODSTRÁNENÉ
  // Dôvod: Mix by nemal byť vymazaný len preto, že používateľ zmení lumpSum/monthly/horizon
  // Nové správanie: Profil ostáva vybraný (zelený marker), mix sa NEprepíše
  // useProjection hook prepočítava výsledky live z aktuálneho mixu
  //
  // REMOVED useEffect: Clear mix + riskPref pri zmene investParams/cashflow
  // IMPACT: Zelený marker profilu ostáva, mix sa nemení
  // UX: Konzistentné - používateľ vie, že jeho mix je stabilný

  // Auto-open and scroll to Portfolio when investment is complete
  // 3-sekundový delay aby užívateľ stihol dokončiť písanie
  React.useEffect(() => {
    if (
      validationState.investmentComplete &&
      !validationState.hasPortfolioProfile
    ) {
      // Čakaj 3 sekundy pred prepnutím
      const timer = setTimeout(() => {
        // Open portfolio section
        setOpen3(true);
        // Scroll to portfolio section after a short delay
        setTimeout(() => {
          const portfolioEl = document.getElementById("sec3");
          if (portfolioEl) {
            portfolioEl.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 300);
      }, 3000); // 3 sekundy delay

      return () => clearTimeout(timer);
    }
  }, [validationState.investmentComplete, validationState.hasPortfolioProfile]);

  // ========== TOUR – Tooltips idú automaticky za sebou ==========
  // Detektory nie sú potrebné, používateľ kliká "Rozumiem" na každom kroku

  const handleModeToggle = () => {
    // Block PRO mode - show alert instead
    if (modeUi === "BASIC") {
      alert(
        "⚠️ PRO verzia je v skúšobnej fáze\n\n" +
          "PRO režim je momentálne v aktívnom vývoji. Niektoré funkcie ešte nie sú dokončené a môžu obsahovať nedostatky.\n\n" +
          "Pre odoslanie projekcie agentovi použite BASIC režim, ktorý je plne funkčný."
      );
      return;
    }

    // Allow switch back to BASIC
    const cur = readV3();
    writeV3({ profile: { ...(cur.profile || {}), modeUi: "BASIC" } as any });
    window.location.reload();
  };

  const handleReset = () => {
    // PR-12 Fix: Zachovaj onboarding flags pri resete (welcome + tour progress)
    const welcomeSeen = localStorage.getItem("welcome-seen");
    const tourSteps = localStorage.getItem("unotop:tour_steps"); // ← Opravený kľúč

    // Clear both localStorage keys
    localStorage.removeItem("unotop:v3");
    localStorage.removeItem("unotop_v3");

    // Obnov onboarding flags (tour sa nereštartuje po resete)
    if (welcomeSeen) localStorage.setItem("welcome-seen", welcomeSeen);
    if (tourSteps) localStorage.setItem("unotop:tour_steps", tourSteps);

    // Reload page to reset state
    window.location.reload();
  };

  // Handle confirmed submission (after warning modal)
  const handleConfirmSubmit = async () => {
    setShowWarningModal(false);
    setIsSubmitting(true);
    setSubmitStatus("idle");

    try {
      // ⚡ PR-23: reCAPTCHA v3 - invisible bot detection
      let recaptchaToken = "";
      if (isRecaptchaReady) {
        try {
          recaptchaToken = await executeRecaptcha("submit_projection");
          console.log(
            "[reCAPTCHA] Token generated:",
            recaptchaToken.slice(0, 20) + "..."
          );
        } catch (error) {
          console.warn("[reCAPTCHA] Token generation failed:", error);
          // Continue without token (server-side verification disabled for now)
        }
      } else {
        console.warn("[reCAPTCHA] Not ready, proceeding without token");
      }

      // ⚡ Honeypot check - bot detection
      if (formData.honeypot !== "") {
        console.warn("[Security] Honeypot triggered - blocking submission");
        setSubmitStatus("error");
        setIsSubmitting(false);
        return;
      }

      // 📅 Generate confirmation code: UNOTOP-YYMMDD-HHMM-NN
      const now = new Date();
      const yy = String(now.getFullYear()).slice(-2);
      const mm = String(now.getMonth() + 1).padStart(2, "0");
      const dd = String(now.getDate()).padStart(2, "0");
      const hh = String(now.getHours()).padStart(2, "0");
      const min = String(now.getMinutes()).padStart(2, "0");
      const nn = String(Math.floor(Math.random() * 100)).padStart(2, "0");
      const referenceCode = `UNOTOP-${yy}${mm}${dd}-${hh}${min}-${nn}`;

      // Generate projection data (UI-WIRING: Use shareModalProjection for consistency)
      const v3Data = readV3();
      const mix: MixItem[] = (v3Data.mix as any) || [];
      const lump = (v3Data.profile?.lumpSumEur as any) || 0;
      const monthly = (v3Data as any).monthly || 0;
      const years = (v3Data.profile?.horizonYears as any) || 10;
      const goal = (v3Data.profile?.goalAssetsEur as any) || 0;
      const riskPref = (v3Data.profile?.riskPref ||
        (v3Data as any).riskPref ||
        "vyvazeny") as "konzervativny" | "vyvazeny" | "rastovy";

      // UI-WIRING: Use shareModalProjection (single source of truth)
      const {
        fvFinal,
        approxYield: approx,
        goalProgress,
        crossoverIndex,
      } = shareModalProjection;
      const fv = fvFinal; // Nominal FV (email template will apply inflation if needed)

      // Debt payoff info
      const currentYear = new Date().getFullYear();
      const crossoverYear = crossoverIndex !== null ? crossoverIndex : null;
      const crossoverCalendarYear =
        crossoverYear !== null ? Math.round(currentYear + crossoverYear) : null;
      const hasDebts = (v3Data.debts || []).length > 0;

      // Generate deeplink
      const state = {
        profile: {
          lumpSumEur: lump,
          horizonYears: years,
          goalAssetsEur: goal,
          valuationMode, // PR-27: Include valuation mode in deeplink
        },
        monthly,
        mix,
      };
      const encoded = btoa(JSON.stringify(state));
      const deeplink = `${window.location.origin}${window.location.pathname}#state=${encodeURIComponent(encoded)}`;

      // 📊 Extract UTM params from URL
      const urlParams = new URLSearchParams(window.location.search);
      const utmSource = urlParams.get("utm_source") || "";
      const utmMedium = urlParams.get("utm_medium") || "";
      const utmCampaign = urlParams.get("utm_campaign") || "";

      // PR-13B: Calculate reserve context
      const fixedExp = (v3Data.profile?.fixedExp as any) || 0;
      const varExp = (v3Data.profile?.varExp as any) || 0;
      const expenses = fixedExp + varExp;
      const reserveLow = Math.round(expenses * 3);
      const reserveHigh = Math.round(expenses * 6);
      const monthlyIncome = (v3Data.profile?.monthlyIncome as any) || 0;
      const debtPayments = 0; // TODO: calculate from debts if needed
      const surplus = monthlyIncome - expenses - debtPayments;
      const stage = detectStage(lump, monthly, years, goal);

      // PR-13 HOTFIX: Formátované bonusy pre email
      const formattedBonuses = formData.selectedBonuses.map((id) =>
        formatBonusForStorage(id, formData.refiDeadline)
      );

      // Progress k cieľu - VŽDY používame nominal FV (absolútna suma na účte)
      const progressForEmail = goal > 0 ? Math.round((fv / goal) * 100) : 0;

      // Referral system: extract agentRefCode from v3
      const agentRefCode = v3Data.profile?.agentRefCode || null;

      // Prepare projection data
      const projectionData: ProjectionData = {
        user: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
        },
        projection: {
          lumpSumEur: lump,
          monthlyVklad: monthly,
          horizonYears: years,
          goalAssetsEur: goal,
          futureValue: fv,
          progressPercent: progressForEmail, // FIX: Use valuationMode-aware progress calculation
          yieldAnnual: approx,
          mix: mix.filter((i) => i.pct > 0),
          deeplink,
          bonuses: formattedBonuses, // PR-13 HOTFIX
          // Debt payoff info (ak má užívateľ dlhy)
          debtPayoffYears: hasDebts ? crossoverYear : null,
          debtPayoffCalendarYear: hasDebts ? crossoverCalendarYear : null,
          agentRefCode, // Referral system
        },
        metadata: {
          riskPref,
          clientType: (v3Data.profile as any)?.clientType || "personal",
          version: "v3",
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign,
          referenceCode,
          // PR-13B: Reserve context
          expenses,
          reserveLow,
          reserveHigh,
          surplus,
          stage,
          // PR-23: reCAPTCHA v3 token
          recaptchaToken,
        },
        recipients: ["info.unotop@gmail.com", "adam.belohorec@universal.sk"],
      };

      // PR-23: Send via Netlify Function (server sends both internal + confirmation emails)
      try {
        await sendProjectionEmail(projectionData);
        console.log(
          "✅ Emails sent via Netlify Function (internal + confirmation)"
        );

        // Record successful submission
        recordSubmission();

        // Store confirmation code
        setConfirmationCode(referenceCode);

        // PR-21: Close share modal, open thank-you modal
        setSubmitStatus("success");
        setTimeout(() => {
          setShareOpen(false);
          setShareSuccessOpen(true); // Show thank-you modal

          // PR-22: Save contact info to v3 for prefill (don't clear)
          writeV3({
            contact: {
              name: `${formData.firstName} ${formData.lastName}`,
              email: formData.email,
              phone: formData.phone,
              bonuses: formData.selectedBonuses,
            },
          });

          // Reset form but keep contact data for prefill
          setFormData({
            firstName: formData.firstName,
            lastName: formData.lastName,
            phone: formData.phone,
            email: formData.email,
            gdprConsent: false, // Always reset consent (GDPR)
            honeypot: "",
            selectedBonuses: formData.selectedBonuses,
            refiDeadline: formData.refiDeadline,
          });
          setSubmitStatus("idle");
        }, 500);
      } catch (emailError) {
        console.error("❌ Netlify Function failed:", emailError);

        // PR-23: Disable mailto fallback in production (security requirement)
        // Show user-friendly error instead of opening Outlook
        const isDev = import.meta.env.DEV;

        if (isDev) {
          // Dev only: allow mailto fallback for debugging
          console.warn("⚠️ DEV MODE: Using mailto fallback");
          sendViaMailto(projectionData);
          recordSubmission();
        } else {
          // Production: show error message, do NOT open mailto
          setSubmitStatus("error");
          alert(
            "Ospravedlňujeme sa, odoslanie projekcie zlyhalo.\n\n" +
              "Prosím skúste to znova o chvíľu, alebo nás kontaktujte priamo na:\n" +
              "info.unotop@gmail.com\n" +
              "+421 915 637 495"
          );
        }

        // Close modal and reset form (no thank-you modal for mailto fallback)
        setSubmitStatus("success");
        setTimeout(() => {
          setShareOpen(false);
          setFormData({
            firstName: "",
            lastName: "",
            phone: "",
            email: "",
            gdprConsent: false,
            honeypot: "",
            selectedBonuses: [],
            refiDeadline: "7",
          });
          setSubmitStatus("idle");
          setValidationErrors({});
          shareBtnRef.current?.focus();
        }, 2000);
      }
    } catch (error) {
      console.error("Error sending projection:", error);
      setSubmitStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const left = (
    <div className="min-w-0 space-y-4" data-testid="left-col">
      <div id="sec0" className="space-y-4">
        <BasicSettingsPanel
          open={open0}
          onToggle={() => setOpen0((v) => !v)}
          mix={mix}
          riskPref={
            seed.profile?.riskPref || (seed as any).riskPref || "vyvazeny"
          }
          validationState={validationState}
        />
      </div>

      {/* PR-28 Phase B: Investment Power Box */}
      <InvestmentPowerBox
        lumpSumEur={investParams.lumpSumEur || 0}
        monthlyEur={investParams.monthlyVklad || 0}
        horizonYears={horizonYearsRounded || 0}
        goalAssetsEur={investParams.goalAssetsEur || 100_000}
        effectivePlanVolume={calculateEffectivePlanVolume(
          investParams.lumpSumEur || 0,
          investParams.monthlyVklad || 0,
          horizonYearsRounded || 0
        )}
        riskPref={currentRiskPref}
      />

      {/* Portfolio selector - disabled button, content is always closed until unlocked */}
      <button
        id="sec3"
        type="button"
        aria-controls="sec3-content"
        aria-expanded={open3}
        disabled={!validationState.investmentComplete}
        onClick={() => {
          if (validationState.investmentComplete) {
            setOpen3((v) => !v);
          }
        }}
        className={`w-full flex items-center justify-between px-6 py-3 rounded-full transition-colors text-left font-semibold ${
          validationState.investmentComplete
            ? "bg-slate-800/80 hover:bg-slate-700/80"
            : "bg-slate-800/40 opacity-60 cursor-not-allowed"
        }`}
      >
        <span id="portfolio-title" className="flex items-center gap-2">
          <svg
            className="w-5 h-5 text-blue-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"
            />
          </svg>
          Zloženie portfólia
          {!validationState.investmentComplete && (
            <span className="text-xs text-amber-400 font-normal">
              (dokončite investičné nastavenia)
            </span>
          )}
        </span>
        <svg
          className={`w-5 h-5 transition-transform duration-300 ${open3 ? "" : "rotate-180"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>
      {open3 && validationState.investmentComplete && (
        <section
          id="sec3-content"
          role="region"
          aria-labelledby="portfolio-title"
          className="w-full min-w-0 rounded-2xl ring-1 ring-white/5 bg-slate-900/60 p-4 md:p-5 transition-all duration-300"
        >
          <div className="mb-4" data-testid="mixpanel-slot">
            <PortfolioSelector mix={mix} />
          </div>

          {/* Lump Sum Scaling Info - vysvetľuje auto-adjustments */}
          {adjustmentWarnings.includes("lump-sum-scaling") &&
            adjustmentInfo?.lumpSumTier && (
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3 text-sm mt-3">
                <p className="text-purple-200">
                  <span className="font-semibold">
                    💎 Optimalizácia pre vysokú investíciu:
                  </span>
                  <br />
                  <span className="text-slate-300 text-xs mt-1 block">
                    {adjustmentInfo.lumpSumTier.message}
                  </span>
                </p>
              </div>
            )}
        </section>
      )}
    </div>
  );

  const right = (
    <div className="space-y-4">
      {/* PR-6 Task E+F: DirtyChangesChip removed (instant reactivity via useProjection hook) */}

      {/* Projekcia - zobrazuje sa vždy (aj pre rodinu/firmu) */}
      <div id="projection-panel">
        <BasicProjectionPanel
          mix={mix}
          lumpSumEur={investParams.lumpSumEur}
          monthlyVklad={
            validationState.isLosingMoney
              ? validationState.freeCash
              : investParams.monthlyVklad
          }
          horizonYears={investParams.horizonYears}
          goalAssetsEur={investParams.goalAssetsEur}
          riskPref={
            seed.profile?.riskPref || (seed as any).riskPref || "vyvazeny"
          }
          mode="BASIC"
          debts={v3ForDrift.debts || []}
          valuationMode={valuationMode}
          onValuationModeChange={setValuationMode}
        />
      </div>

      {/* PR-12: Recalculate chip - premiestený DO PRAVÉHO PANELU (viditeľnejšie) */}
      {projection.hasDrift && projection.canReapply && v3ForDrift.presetId && (
        <div className="mb-4">
          <RecalculateProfileChip
            driftFields={projection.driftFields}
            presetId={v3ForDrift.presetId}
            onReapplied={() => {
              // Refresh mix po reapply (mixEvents notifikuje)
              console.log("[BasicLayout] Mix reapplied");
            }}
          />
        </div>
      )}
      {/* Share CTA */}
      <section
        id="share-section"
        className="w-full min-w-0 rounded-2xl ring-1 ring-emerald-500/30 bg-gradient-to-br from-emerald-900/40 to-emerald-950/20 p-4 md:p-5"
      >
        <button
          ref={shareBtnRef}
          type="button"
          disabled={
            !validationState.canShare ||
            (projection.hasDrift && !v3ForDrift.profile?.autoOptimizeMix)
          }
          onClick={() => validationState.canShare && setShareOpen(true)} // REVERTING: ShareModal je SPRÁVNY formulár
          className={`group relative w-full px-6 py-4 rounded-xl font-semibold text-lg shadow-lg transition-all duration-200 overflow-hidden ${
            validationState.canShare &&
            !(projection.hasDrift && !v3ForDrift.profile?.autoOptimizeMix)
              ? "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-[1.02] active:scale-[0.98]"
              : "bg-slate-700 text-slate-400 cursor-not-allowed opacity-60"
          }`}
          aria-label="Odoslať projekciu"
          title={
            projection.hasDrift && !v3ForDrift.profile?.autoOptimizeMix
              ? "Najprv prepočítajte profil (zmeny v nastaveniach vyžadujú aktualizáciu mixu)"
              : validationState.canShare
                ? ""
                : validationMessage || "Dokončite všetky kroky"
          }
        >
          {validationState.canShare &&
            !(projection.hasDrift && !v3ForDrift.profile?.autoOptimizeMix) && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            )}
          <div className="relative flex items-center justify-center gap-3">
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            <span>Odoslať projekciu</span>
          </div>
        </button>
        <p className="mt-3 text-xs text-center text-slate-400">
          {validationState.canShare
            ? "Zrealizujte svoj plán budovania majetku"
            : validationMessage || "Dokončite všetky kroky"}
        </p>
      </section>
    </div>
  );

  // Drift blocking logic pre toolbar
  const hasDriftBlocking =
    projection.hasDrift && !v3ForDrift.profile?.autoOptimizeMix;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-[60px]">
      <ToastStack />
      <Toolbar
        onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        modeUi={modeUi}
        onModeToggle={handleModeToggle}
        onReset={handleReset}
        onTourRestart={restartTour}
        onContactClick={onAboutClick} // PR-14: Kontakt button
        onAdminOpen={onAdminOpen} // PR-16: DEV admin button
        onInfoClick={() => window.dispatchEvent(new Event("openWelcomeModal"))}
        onShare={() => {
          // REVERTING: ShareModal je správny formulár (meno, priezvisko, email, telefón)
          if (validationState.canShare && !hasDriftBlocking) {
            setShareOpen(true);
          }
        }}
        canShare={validationState.canShare && !hasDriftBlocking}
      />
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        mode="BASIC"
        modeUi={modeUi}
        onModeToggle={handleModeToggle}
        onReset={handleReset}
        onTourRestart={restartTour}
        onContactClick={onAboutClick}
        onInfoClick={() => window.dispatchEvent(new Event("openWelcomeModal"))}
        onShare={() => {
          if (validationState.canShare && !hasDriftBlocking) {
            setShareOpen(true);
          }
        }}
        canShare={validationState.canShare && !hasDriftBlocking}
      />
      <PageLayout left={left} right={right} />

      {/* Share modal - identický s LegacyApp */}
      {shareOpen && (
        <div
          role="dialog"
          aria-label="Zdieľať nastavenie"
          className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/60 p-4"
        >
          <div className="bg-slate-900 rounded-xl p-6 ring-1 ring-white/10 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold">📧 Odoslať projekciu</h2>

            {/* PR-18: Pomocný text */}
            <p className="text-sm text-slate-400 leading-relaxed">
              Po odoslaní projekcie vám na e-mail pošleme prehľadný súhrn a
              jednoduchý návrh krokov, ako lepšie nastaviť vaše peniaze a
              investície. Všetko je nezáväzné a zdarma.
            </p>

            {/* Preview FV + Mix */}
            {(() => {
              const v3Data = readV3();
              const mix: MixItem[] = (v3Data.mix as any) || [];
              const lump = (v3Data.profile?.lumpSumEur as any) || 0;
              const monthly = (v3Data as any).monthly || 0;
              const years = (v3Data.profile?.horizonYears as any) || 10;
              const goal = (v3Data.profile?.goalAssetsEur as any) || 0;

              // UI-WIRING: Použiť useProjection (rovnaký calculation ako StickyBottomBar)
              const { fvFinal, goalProgress, crossoverIndex, debtPayoffMonth } =
                shareModalProjection;

              // PR-27: Transformácia podľa valuationMode (SINGLE SOURCE OF TRUTH)
              const displayFV =
                valuationMode === "real"
                  ? toRealValue(fvFinal, years)
                  : fvFinal;

              // Progress k cieľu - VŽDY používame nominal FV (absolútna suma na účte)
              const nominalProgress = goal > 0 ? (fvFinal / goal) * 100 : 0;
              const pct = Math.round(nominalProgress);

              // Debt payoff info
              const currentYear = new Date().getFullYear();
              const crossoverYear =
                crossoverIndex !== null ? crossoverIndex : null;
              const crossoverCalendarYear =
                crossoverYear !== null
                  ? Math.round(currentYear + crossoverYear)
                  : null;
              const hasDebts = (v3Data.debts || []).length > 0;

              return (
                <div className="p-4 rounded-lg bg-slate-800/50 ring-1 ring-white/5 space-y-3 text-sm">
                  <div className="font-medium text-slate-300">
                    Vaša projekcia:
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400">
                        Hodnota po {years} rokoch:
                      </span>
                      <div className="font-bold text-emerald-400 tabular-nums">
                        {Math.round(displayFV).toLocaleString("sk-SK")} €
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Progres k cieľu:</span>
                      <div className="font-bold text-amber-400 tabular-nums">
                        {pct}%
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Jednorazový vklad:</span>
                      <div className="font-medium tabular-nums">
                        {Math.round(lump).toLocaleString("sk-SK")} €
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Mesačný vklad:</span>
                      <div className="font-medium tabular-nums">
                        {Math.round(monthly).toLocaleString("sk-SK")} €
                      </div>
                    </div>
                  </div>

                  {/* Debt payoff info - zobrazuje sa len ak má užívateľ dlhy */}
                  {hasDebts && crossoverYear !== null && (
                    <div className="pt-2 border-t border-white/5">
                      <div className="text-slate-400 text-xs mb-1">
                        💡 Predčasné splatenie dlhov:
                      </div>
                      <div className="text-sm text-emerald-400 font-medium">
                        {crossoverYear === 0 ? (
                          <>Už teraz máte dostatok aktív na splatenie dlhov.</>
                        ) : (
                          <>
                            Vaše dlhy budete môcť predčasne vyplatiť o{" "}
                            {crossoverYear.toFixed(1)} rokov (v roku{" "}
                            {crossoverCalendarYear}).
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {mix.length > 0 && (
                    <div className="pt-2 border-t border-white/5">
                      <div className="text-slate-400 mb-1">Mix portfólia:</div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        {mix
                          .filter((i) => i.pct > 0)
                          .map((item) => {
                            const labels: Record<string, string> = {
                              gold: "🥇 Zlato",
                              dyn: "📊 Dyn. riadenie",
                              etf: "🌍 ETF svet",
                              bonds: "📜 Dlhopis 7,5% (5r)",
                              bond3y9: "💰 Dlhopis 13% (3r)",
                              cash: "💵 Pracujúca rezerva – IAD DK",
                              crypto: "₿ Krypto",
                              real: "🏘️ Reality",
                              other: "📦 Ostatné",
                            };
                            return (
                              <div
                                key={item.key}
                                className="flex justify-between"
                              >
                                <span className="text-slate-300">
                                  {labels[item.key] || item.key}
                                </span>
                                <span className="font-medium tabular-nums">
                                  {item.pct.toFixed(1)}%
                                </span>
                              </div>
                            );
                          })}
                      </div>
                      {/* Info o dlhopisoch ak sú oba prítomné */}
                      {mix.some((m) => m.key === "bonds" && m.pct > 0) &&
                        mix.some((m) => m.key === "bond3y9" && m.pct > 0) && (
                          <div className="mt-2 pt-2 border-t border-white/10 text-xs text-slate-400 space-y-1">
                            <div className="flex items-start gap-1">
                              <span className="shrink-0">📜</span>
                              <span>
                                Dlhopis 7,5%: korporátny, krytý biznisom firmy,
                                5-ročná splatnosť
                              </span>
                            </div>
                            <div className="flex items-start gap-1">
                              <span className="shrink-0">💰</span>
                              <span>
                                Dlhopis 13%: mesačné výplaty po dobu 36
                                mesiacov, lepšia likvidita
                              </span>
                            </div>
                          </div>
                        )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* User contact form */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-300">
                    Meno *
                  </span>
                  <input
                    type="text"
                    name="firstName"
                    autoComplete="given-name"
                    required
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    className="w-full bg-slate-800 rounded-lg px-3 py-2 text-sm ring-1 ring-white/5 focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all"
                    placeholder="Ján"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-300">
                    Priezvisko *
                  </span>
                  <input
                    type="text"
                    name="lastName"
                    autoComplete="family-name"
                    required
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    className="w-full bg-slate-800 rounded-lg px-3 py-2 text-sm ring-1 ring-white/5 focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all"
                    placeholder="Novák"
                  />
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-300">
                  Email *
                </span>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    if (validationErrors.email) {
                      setValidationErrors({
                        ...validationErrors,
                        email: undefined,
                      });
                    }
                  }}
                  onBlur={() => {
                    if (formData.email && !validateEmail(formData.email)) {
                      setValidationErrors({
                        ...validationErrors,
                        email: "Neplatný formát emailu",
                      });
                    }
                  }}
                  className="w-full bg-slate-800 rounded-lg px-3 py-2 text-sm ring-1 ring-white/5 focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all"
                  placeholder="jan.novak@example.com"
                />
                {validationErrors.email && (
                  <p className="text-xs text-red-400 mt-1">
                    {validationErrors.email}
                  </p>
                )}
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-300">
                  Telefón (nepovinné – ak chcete, aby som vám zavolal)
                </span>
                <input
                  type="tel"
                  name="tel"
                  autoComplete="tel"
                  value={formData.phone}
                  onChange={(e) => {
                    setFormData({ ...formData, phone: e.target.value });
                    if (validationErrors.phone) {
                      setValidationErrors({
                        ...validationErrors,
                        phone: undefined,
                      });
                    }
                  }}
                  onBlur={() => {
                    // TASK B: Telefón nepovinný - validuj len ak vyplnený
                    if (
                      formData.phone.trim() !== "" &&
                      !validatePhone(formData.phone)
                    ) {
                      setValidationErrors({
                        ...validationErrors,
                        phone: "Neplatný formát (napr. +421 900 123 456)",
                      });
                    } else if (formData.phone.trim() === "") {
                      // Vyčisti error ak používateľ vymazal telefón
                      const { phone, ...rest } = validationErrors;
                      setValidationErrors(rest);
                    }
                  }}
                  className="w-full bg-slate-800 rounded-lg px-3 py-2 text-sm ring-1 ring-white/5 focus:ring-2 focus:ring-emerald-500/50 outline-none transition-all"
                  placeholder="+421 900 123 456"
                />
                {validationErrors.phone && (
                  <p className="text-xs text-red-400 mt-1">
                    {validationErrors.phone}
                  </p>
                )}
              </label>

              {/* Honeypot field - hidden, must stay empty (bot trap) */}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={formData.honeypot}
                onChange={(e) =>
                  setFormData({ ...formData, honeypot: e.target.value })
                }
                style={{
                  position: "absolute",
                  left: "-9999px",
                  width: "1px",
                  height: "1px",
                  opacity: 0,
                }}
                aria-hidden="true"
              />

              {/* PR-13 HOTFIX + PR-17: Bonuses section (collapsible) */}
              <div className="pt-4 border-t border-white/10 space-y-3">
                <button
                  type="button"
                  onClick={() => setBonusesExpanded(!bonusesExpanded)}
                  className="w-full flex items-center justify-between text-left group"
                >
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200 mb-1">
                      Vyberte si bonusy, o ktoré máte záujem
                    </h3>
                    <p className="text-xs text-slate-400">
                      Budú súčasťou vašej požiadavky na projekciu. Neovplyvňujú
                      výpočty.
                    </p>
                  </div>
                  <svg
                    className={`w-5 h-5 text-slate-400 transition-transform ${
                      bonusesExpanded ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {bonusesExpanded && (
                  <div className="space-y-2">
                    {BONUS_OPTIONS.map((option) => {
                      const isRefi = option.id === "refi";
                      const isSelected = formData.selectedBonuses.includes(
                        option.id
                      );

                      return (
                        <div key={option.id}>
                          <label
                            className={`flex items-start gap-2 cursor-pointer ${
                              option.disabled
                                ? "opacity-50 cursor-not-allowed"
                                : ""
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                if (option.disabled) return;
                                const newBonuses = isSelected
                                  ? formData.selectedBonuses.filter(
                                      (id) => id !== option.id
                                    )
                                  : [...formData.selectedBonuses, option.id];
                                setFormData({
                                  ...formData,
                                  selectedBonuses: newBonuses,
                                });

                                // Sync "income" bonus s v3.profile.collabOptIn
                                if (option.id === "income") {
                                  const v3 = readV3();
                                  writeV3({
                                    profile: {
                                      ...v3.profile,
                                      collabOptIn: !isSelected,
                                    } as any,
                                  });
                                }
                              }}
                              disabled={option.disabled || isSubmitting}
                              data-testid={option.testId}
                              className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50"
                            />
                            <span className="text-xs text-slate-300 leading-relaxed">
                              {option.label}
                              {option.tooltip && (
                                <span
                                  className="ml-1 text-slate-500 cursor-help"
                                  title={option.tooltip}
                                >
                                  ℹ️
                                </span>
                              )}
                            </span>
                          </label>

                          {/* Refi deadline dropdown (conditional) */}
                          {isRefi && isSelected && (
                            <div className="ml-6 mt-2 flex items-center gap-2">
                              <label className="text-xs text-slate-400">
                                Mám záujem o ponuku do:
                              </label>
                              <select
                                value={formData.refiDeadline}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    refiDeadline: e.target.value,
                                  })
                                }
                                className="px-2 py-1 text-xs rounded bg-slate-800 border border-slate-600 text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                              >
                                {REFI_DEADLINE_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={formData.gdprConsent}
                  onChange={(e) =>
                    setFormData({ ...formData, gdprConsent: e.target.checked })
                  }
                  className="mt-1 w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-2 focus:ring-emerald-500/50"
                />
                <span className="text-xs text-slate-400 leading-relaxed">
                  Súhlasím so spracovaním osobných údajov za účelom zaslania
                  investičnej projekcie finančnému agentovi. Údaje nebudú
                  uložené ani zdieľané s tretími stranami.{" "}
                  <button
                    type="button"
                    onClick={() => setPrivacyOpen(true)}
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    Zásady ochrany osobných údajov
                  </button>
                </span>
              </label>
            </div>

            {/* PR-22: Clear saved contact data */}
            {(formData.firstName || formData.email || formData.phone) && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    // Clear contact from v3
                    writeV3({ contact: undefined });

                    // Reset form to empty
                    setFormData({
                      firstName: "",
                      lastName: "",
                      phone: "",
                      email: "",
                      gdprConsent: false,
                      honeypot: "",
                      selectedBonuses: [],
                      refiDeadline: "7",
                    });

                    // Show toast
                    WarningCenter.push({
                      type: "info",
                      message: "🗑️ Uložené údaje boli vymazané",
                      scope: "global",
                      dedupeKey: "contact-cleared",
                    });
                  }}
                  className="text-xs text-slate-500 hover:text-slate-400 underline transition-colors"
                >
                  Vymazať uložené údaje
                </button>
              </div>
            )}

            {/* Status messages */}
            {submitStatus === "success" && (
              <div className="p-3 rounded-lg bg-emerald-900/30 ring-1 ring-emerald-500/30 text-sm text-emerald-300 space-y-2">
                <div>✅ Projekcia bola úspešne odoslaná!</div>
                {confirmationCode && (
                  <div className="text-xs text-slate-400 font-mono bg-slate-900/60 px-2 py-1 rounded">
                    Referenčný kód:{" "}
                    <strong className="text-emerald-400">
                      {confirmationCode}
                    </strong>
                  </div>
                )}
              </div>
            )}
            {submitStatus === "error" && (
              <div className="p-3 rounded-lg bg-red-900/30 ring-1 ring-red-500/30 text-sm text-red-300">
                ❌ Chyba pri odosielaní. Skúste to prosím neskôr.
              </div>
            )}

            {/* CTA buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                disabled={
                  isSubmitting ||
                  !formData.firstName ||
                  !formData.lastName ||
                  !formData.email ||
                  !formData.gdprConsent ||
                  !validateEmail(formData.email) ||
                  // TASK B: Telefón nepovinný - validuj len ak vyplnený
                  (formData.phone.trim() !== "" &&
                    !validatePhone(formData.phone))
                }
                className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-medium text-sm hover:shadow-lg hover:shadow-emerald-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => {
                  // Validate form first
                  const errors: ValidationErrors = {};
                  if (!validateEmail(formData.email)) {
                    errors.email = "Neplatný formát emailu";
                  }
                  // TASK B: Telefón nepovinný - validuj len ak vyplnený
                  if (
                    formData.phone.trim() !== "" &&
                    !validatePhone(formData.phone)
                  ) {
                    errors.phone = "Neplatný formát (napr. +421 900 123 456)";
                  }
                  if (Object.keys(errors).length > 0) {
                    setValidationErrors(errors);
                    return;
                  }

                  // Check rate limit (60s cooldown + monthly limit)
                  if (!canSubmit()) {
                    const remaining = getRemainingSubmissions();
                    const cooldown = getRemainingCooldown();

                    if (cooldown > 0) {
                      WarningCenter.push({
                        type: "warning",
                        message: `⏱️ Počkajte prosím ${cooldown}s pred ďalším odoslaním (ochrana proti spamu).`,
                        scope: "global",
                        dedupeKey: "rate-limit-cooldown",
                      });
                    } else {
                      WarningCenter.push({
                        type: "warning",
                        message: `Vyčerpali ste mesačný limit projekcií (2/mesiac). Ďalšie odoslanie bude možné od ${getResetDate()}.`,
                        scope: "global",
                        dedupeKey: "rate-limit-monthly",
                      });
                    }
                    return;
                  }

                  // Show warning modal
                  setShowWarningModal(true);
                }}
              >
                {isSubmitting ? "⏳ Odosiela sa..." : "📨 Odoslať projekciu"}
              </button>
              <button
                type="button"
                className="px-4 py-2.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm transition-colors"
                onClick={() => {
                  setShareOpen(false);

                  // PR-22: Reset to saved contact data (prefill on next open)
                  const v3 = readV3();
                  const contact = v3.contact || {};
                  const nameParts = (contact.name || "").trim().split(" ");
                  const firstName = nameParts[0] || "";
                  const lastName = nameParts.slice(1).join(" ") || "";

                  setFormData({
                    firstName,
                    lastName,
                    phone: contact.phone || "",
                    email: contact.email || "",
                    gdprConsent: false,
                    honeypot: "",
                    selectedBonuses: (contact.bonuses || []) as string[],
                    refiDeadline: "7",
                  });
                  setSubmitStatus("idle");
                  setConfirmationCode("");
                  setTimeout(() => shareBtnRef.current?.focus(), 0);
                }}
              >
                Zrušiť
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submission Warning Modal */}
      <SubmissionWarningModal
        isOpen={showWarningModal}
        onClose={() => setShowWarningModal(false)}
        onConfirm={handleConfirmSubmit}
        remaining={getRemainingSubmissions()}
        resetDate={getResetDate()}
      />

      {/* Onboarding Tour */}
      <OnboardingTour
        isOpen={tourOpen}
        currentStep={currentTourStep}
        onClose={handleTourClose}
        onComplete={handleTourComplete}
      />

      {/* PR-7: Privacy Modal */}
      <PrivacyModal
        isOpen={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
      />

      {/* PR-21: Share Success Modal (Thank-you window) */}
      <ShareSuccessModal
        visible={shareSuccessOpen}
        onClose={() => setShareSuccessOpen(false)}
      />

      {/* ContactModal REMOVED - ShareModal je správny formulár s meno/priezvisko/email/telefón */}

      {/* PR-7: StickyBottomBar */}
      <StickyBottomBar
        mix={mix}
        lumpSumEur={investParams.lumpSumEur}
        monthlyVklad={investParams.monthlyVklad}
        horizonYears={investParams.horizonYears}
        goalAssetsEur={investParams.goalAssetsEur}
        riskPref={(seed.profile?.riskPref as RiskPref) || "vyvazeny"}
        onSubmitClick={() => setShareOpen(true)} // REVERTING: ShareModal je správny formulár
        hasDriftBlocking={hasDriftBlocking} // PR-12: Blokuje odoslanie ak drift
        valuationMode={valuationMode} // PR-27: Inflation adjustment
      />

      {/* PR-7: Footer s GDPR linkom */}
      {/* PR-13: Footer na spodku stránky s Kontakt tlačidlom */}
      {/* PR-12: onAdminOpen už nie je potrebné - AdminShortcuts to riadi */}
      <Footer
        onPrivacyClick={() => setPrivacyOpen(true)}
        onContactClick={onAboutClick}
      />

      {/* PR-12: AdminConsole moved to RootLayout (global) */}
    </div>
  );
}
