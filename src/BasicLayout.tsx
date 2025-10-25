import React from "react";
import PageLayout from "./app/PageLayout";
import Toolbar from "./components/Toolbar";
import Sidebar from "./components/Sidebar";
import { OnboardingTour } from "./components/OnboardingTour";
import { BasicSettingsPanel } from "./features/basic/BasicSettingsPanel";
import PortfolioSelector from "./features/portfolio/PortfolioSelector";
import { BasicProjectionPanel } from "./features/overview/BasicProjectionPanel";
import {
  getAdjustedPreset,
  type ProfileForAdjustments,
  type AdjustmentWarning,
  PORTFOLIO_PRESETS,
} from "./features/portfolio/presets";
import { readV3, writeV3 } from "./persist/v3";
import { createMixListener } from "./persist/mixEvents";
import type { MixItem } from "./features/mix/mix.service";
import { calculateFutureValue } from "./engine/calculations";
import { approxYieldAnnualFromMix } from "./features/mix/assetModel";
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
import {
  canSubmit,
  getRemainingSubmissions,
  getResetDate,
  recordSubmission,
  getRemainingCooldown,
} from "./utils/rate-limiter";
import SubmissionWarningModal from "./components/SubmissionWarningModal";
import { WarningCenter } from "./features/ui/warnings/WarningCenter";
import { ToastStack } from "./features/ui/warnings/ToastStack";

/**
 * BasicLayout - jednoduchá verzia pre nováčikov
 * Left: Nastavenia (profil+cashflow+invest) + Portfolio
 * Right: Projekcia & Metriky (spojené)
 */
export default function BasicLayout() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [open0, setOpen0] = React.useState(true); // Settings panel
  const [open3, setOpen3] = React.useState(true); // Portfolio panel
  const [shareOpen, setShareOpen] = React.useState(false);
  const shareBtnRef = React.useRef<HTMLButtonElement>(null);

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

  // Počúvaj na zatvorenie welcome modalu a spusti tour
  React.useEffect(() => {
    let hasStarted = false; // Flag aby sa nespustil viac krát

    const checkWelcome = () => {
      const welcomeSeen = localStorage.getItem("unotop:welcome-seen");
      const tourCompleted = completedSteps.length === 5;

      if (welcomeSeen && !tourCompleted && !tourOpen && !hasStarted) {
        hasStarted = true; // Označ že tour bol spustený
        console.log("[Tour] Welcome modal closed, auto-starting tour...");
        setTimeout(() => {
          setCurrentTourStep(1);
          setTourOpen(true);
        }, 2500);
      }
    };

    // Poll pre welcome flag každých 500ms (fallback ak custom event nefunguje)
    const pollInterval = setInterval(checkWelcome, 500);

    // Listen na custom event z WelcomeModal
    window.addEventListener("storage", checkWelcome);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener("storage", checkWelcome);
    };
  }, []); // Len raz pri mount

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
    setCompletedSteps([]);
    setCurrentTourStep(1);
    setTourOpen(true);
  };

  // Reset tour (pre testovanie)
  const resetTour = () => {
    localStorage.removeItem("unotop:tour_steps");
    setCompletedSteps([]);
    setCurrentTourStep(1);
  };

  // Form state for share modal
  const [formData, setFormData] = React.useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    gdprConsent: false,
    honeypot: "", // Bot trap - must stay empty
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

  React.useEffect(() => {
    const unsub = createMixListener((newMix) => {
      setMix(newMix as MixItem[]);
    });
    return unsub;
  }, []);

  // Sync cashflow data from persist (100ms polling)
  React.useEffect(() => {
    const interval = setInterval(() => {
      const v3 = readV3();
      setCashflowData({
        monthlyIncome: (v3.profile?.monthlyIncome as any) || 0,
        fixedExp: (v3.profile?.fixedExp as any) || 0,
        varExp: (v3.profile?.varExp as any) || 0,
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Sync invest params from persist (100ms polling)
  React.useEffect(() => {
    const interval = setInterval(() => {
      const v3 = readV3();
      setInvestParams({
        lumpSumEur: (v3.profile?.lumpSumEur as any) || 0,
        monthlyVklad: (v3 as any).monthly || 0,
        horizonYears: (v3.profile?.horizonYears as any) || 10,
        goalAssetsEur: (v3.profile?.goalAssetsEur as any) || 0,
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Validation state (reactive)
  const validationState: ValidationState = React.useMemo(() => {
    const v3 = readV3();
    return validateBasicWorkflow({
      monthlyIncome: (v3.profile?.monthlyIncome as any) || 0,
      fixedExp: (v3.profile?.fixedExp as any) || 0,
      varExp: (v3.profile?.varExp as any) || 0,
      lumpSumEur: investParams.lumpSumEur,
      monthlyVklad: investParams.monthlyVklad,
      horizonYears: investParams.horizonYears,
      goalAssetsEur: investParams.goalAssetsEur,
      mix: mix,
    });
  }, [investParams, mix]);

  const validationMessage = getValidationMessage(validationState);

  // Portfolio adjustments - aplikuj pri zmene profilu/investičných parametrov
  React.useEffect(() => {
    const v3 = readV3();
    const currentRiskPref = (v3.profile?.riskPref as any) || "vyvazeny";

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
  }, [investParams, cashflowData]);

  // Uncheck preset pri zmene vstupov (aby používateľ musel znovu vybrať)
  React.useEffect(() => {
    const v3 = readV3();
    const currentRiskPref = v3.profile?.riskPref;

    // Ak má vybratý profil, vymaž ho pri zmene vstupov
    if (currentRiskPref) {
      console.log(
        "[BasicLayout] Vstupy sa zmenili, unchecking profil + clearing mix"
      );
      writeV3({
        mix: [], // Vymaž aj mix, aby používateľ vedel, že musí znovu vybrať
        profile: {
          ...(v3.profile || {}),
          riskPref: undefined, // Uncheck
        } as any,
      });
    }
  }, [
    investParams.lumpSumEur,
    investParams.monthlyVklad,
    investParams.horizonYears,
    cashflowData.monthlyIncome,
    cashflowData.fixedExp,
    cashflowData.varExp,
  ]);

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
    const cur = readV3();
    const newMode = modeUi === "BASIC" ? "PRO" : "BASIC";
    writeV3({ profile: { ...(cur.profile || {}), modeUi: newMode } as any });
    window.location.reload(); // Force refresh to switch layout
  };

  const handleReset = () => {
    // Clear both localStorage keys
    localStorage.removeItem("unotop:v3");
    localStorage.removeItem("unotop_v3");

    // Reload page to reset state
    window.location.reload();
  };

  // Handle confirmed submission (after warning modal)
  const handleConfirmSubmit = async () => {
    setShowWarningModal(false);
    setIsSubmitting(true);
    setSubmitStatus("idle");

    try {
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

      // Generate projection data
      const v3Data = readV3();
      const mix: MixItem[] = (v3Data.mix as any) || [];
      const lump = (v3Data.profile?.lumpSumEur as any) || 0;
      const monthly = (v3Data as any).monthly || 0;
      const years = (v3Data.profile?.horizonYears as any) || 10;
      const goal = (v3Data.profile?.goalAssetsEur as any) || 0;
      const riskPref = (v3Data.profile?.riskPref ||
        (v3Data as any).riskPref ||
        "vyvazeny") as "konzervativny" | "vyvazeny" | "rastovy";
      const approx = approxYieldAnnualFromMix(mix, riskPref);
      const fv = calculateFutureValue(lump, monthly, years, approx);

      // Generate deeplink
      const state = {
        profile: {
          lumpSumEur: lump,
          horizonYears: years,
          goalAssetsEur: goal,
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
          progressPercent: goal > 0 ? Math.round((fv / goal) * 100) : 0,
          yieldAnnual: approx,
          mix: mix.filter((i) => i.pct > 0),
          deeplink,
        },
        metadata: {
          riskPref,
          clientType: (v3Data.profile as any)?.clientType || "personal",
          version: "v3",
          utm_source: utmSource,
          utm_medium: utmMedium,
          utm_campaign: utmCampaign,
          referenceCode,
        },
        recipients: ["info.unotop@gmail.com", "adam.belohorec@universal.sk"],
      };

      // Try EmailJS first, fallback to mailto
      try {
        await sendProjectionEmail(projectionData);
        console.log("✅ Email sent via EmailJS");

        // Record successful submission
        recordSubmission();

        // Store confirmation code
        setConfirmationCode(referenceCode);
      } catch (emailError) {
        console.warn("⚠️ EmailJS failed, using mailto fallback:", emailError);
        sendViaMailto(projectionData);

        // Still record submission (mailto was used)
        recordSubmission();
      }

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
        });
        setSubmitStatus("idle");
        setValidationErrors({});
        shareBtnRef.current?.focus();
      }, 2000);
    } catch (error) {
      console.error("Error sending projection:", error);
      setSubmitStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const left = (
    <div className="min-w-0 space-y-4" data-testid="left-col">
      <BasicSettingsPanel
        open={open0}
        onToggle={() => setOpen0((v) => !v)}
        mix={mix}
        riskPref={
          seed.profile?.riskPref || (seed as any).riskPref || "vyvazeny"
        }
        validationState={validationState}
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
            <PortfolioSelector />
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
        />
      </div>

      {/* Share CTA */}
      <section
        id="share-section"
        className="w-full min-w-0 rounded-2xl ring-1 ring-emerald-500/30 bg-gradient-to-br from-emerald-900/40 to-emerald-950/20 p-4 md:p-5"
      >
        <button
          ref={shareBtnRef}
          type="button"
          disabled={!validationState.canShare}
          onClick={() => validationState.canShare && setShareOpen(true)}
          className={`group relative w-full px-6 py-4 rounded-xl font-semibold text-lg shadow-lg transition-all duration-200 overflow-hidden ${
            validationState.canShare
              ? "bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:scale-[1.02] active:scale-[0.98]"
              : "bg-slate-700 text-slate-400 cursor-not-allowed opacity-60"
          }`}
          aria-label="Odoslať projekciu"
          title={
            validationState.canShare
              ? ""
              : validationMessage || "Dokončite všetky kroky"
          }
        >
          {validationState.canShare && (
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
            ? "Zrealizujte svoj plán bohatstva"
            : validationMessage || "Dokončite všetky kroky"}
        </p>
      </section>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <ToastStack />
      <Toolbar
        onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        modeUi={modeUi}
        onModeToggle={handleModeToggle}
        onReset={handleReset}
        onTourRestart={restartTour}
        onShare={() => {
          if (validationState.canShare && shareBtnRef.current) {
            // Scroll to big green Share button
            shareBtnRef.current.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
            // Wait for scroll animation, then open modal
            setTimeout(() => setShareOpen(true), 500);
          }
        }}
        canShare={validationState.canShare}
      />
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        mode="BASIC"
      />
      <PageLayout left={left} right={right} />

      {/* Share modal - identický s LegacyApp */}
      {shareOpen && (
        <div
          role="dialog"
          aria-label="Zdieľať nastavenie"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
        >
          <div className="bg-slate-900 rounded-xl p-6 ring-1 ring-white/10 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold">📧 Zdieľať agentovi</h2>

            {/* Preview FV + Mix */}
            {(() => {
              const v3Data = readV3();
              const mix: MixItem[] = (v3Data.mix as any) || [];
              const lump = (v3Data.profile?.lumpSumEur as any) || 0;
              const monthly = (v3Data as any).monthly || 0;
              const years = (v3Data.profile?.horizonYears as any) || 10;
              const goal = (v3Data.profile?.goalAssetsEur as any) || 0;
              const riskPref = (v3Data.profile?.riskPref ||
                (v3Data as any).riskPref ||
                "vyvazeny") as "konzervativny" | "vyvazeny" | "rastovy";
              const approx = approxYieldAnnualFromMix(mix, riskPref);
              const fv = calculateFutureValue(lump, monthly, years, approx);
              const pct = goal > 0 ? Math.round((fv / goal) * 100) : 0;

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
                        {Math.round(fv).toLocaleString("sk-SK")} €
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
                              bond3y9: "💰 Dlhopis 9% (3r)",
                              cash: "💵 Hotovosť",
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
                                Dlhopis 9%: mesačné výplaty po dobu 36 mesiacov,
                                lepšia likvidita
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
                  Telefónne číslo *
                </span>
                <input
                  type="tel"
                  required
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
                    if (formData.phone && !validatePhone(formData.phone)) {
                      setValidationErrors({
                        ...validationErrors,
                        phone: "Neplatný formát (napr. +421 900 123 456)",
                      });
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
                  uložené ani zdieľané s tretími stranami.
                </span>
              </label>
            </div>

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
                  !formData.phone ||
                  !formData.gdprConsent ||
                  !validateEmail(formData.email) ||
                  !validatePhone(formData.phone)
                }
                className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-medium text-sm hover:shadow-lg hover:shadow-emerald-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => {
                  // Validate form first
                  const errors: ValidationErrors = {};
                  if (!validateEmail(formData.email)) {
                    errors.email = "Neplatný formát emailu";
                  }
                  if (!validatePhone(formData.phone)) {
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
                  setFormData({
                    firstName: "",
                    lastName: "",
                    phone: "",
                    email: "",
                    gdprConsent: false,
                    honeypot: "",
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
    </div>
  );
}
