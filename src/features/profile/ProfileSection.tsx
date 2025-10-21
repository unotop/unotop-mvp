import React from "react";
import { writeV3, readV3 } from "../../persist/v3";

interface ProfileSectionProps {
  open: boolean;
  onToggle: () => void;
  onDebtOpen: () => void;
}

/**
 * ProfileSection (sec0: Profil klienta)
 * Client type, risk preference, crisis bias configuration
 */
export const ProfileSection: React.FC<ProfileSectionProps> = ({
  open,
  onToggle,
  onDebtOpen,
}) => {
  const seed = readV3();

  // Local state (synced to persist)
  const [clientType, setClientType] = React.useState<
    "individual" | "family" | "firm"
  >(() => (seed.profile?.clientType as any) || "individual");

  const [riskPref, setRiskPref] = React.useState<string>(
    () => seed.profile?.riskPref || (seed as any).riskPref || "vyvazeny"
  );

  const [crisisBias, setCrisisBias] = React.useState<number>(
    () => (seed.profile?.crisisBias as any) ?? (seed as any).crisisBias ?? 0
  );

  // Persist helpers
  const persistClientType = (value: "individual" | "family" | "firm") => {
    setClientType(value);
    writeV3({ profile: { clientType: value } });
  };

  const persistRiskPref = (value: string) => {
    setRiskPref(value);
    writeV3({ profile: { riskPref: value } });
  };

  const persistCrisisBias = (value: number) => {
    setCrisisBias(value);
    writeV3({ profile: { crisisBias: value } });
  };

  const handleDebtClick = () => {
    onDebtOpen();
    // Scroll to debts section after brief delay
    setTimeout(() => {
      document
        .getElementById("sec-debts")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  return (
    <>
      <button
        type="button"
        aria-controls="sec0"
        aria-expanded={open}
        onClick={onToggle}
        className="w-full flex items-center justify-between px-6 py-3 rounded-full bg-slate-800/80 hover:bg-slate-700/80 transition-colors text-left font-semibold"
      >
        <span id="profile-title">Profil klienta</span>
        <svg
          className={`w-5 h-5 transition-transform duration-300 ${open ? "" : "rotate-180"}`}
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

      {open && (
        <section
          id="sec0"
          role="region"
          aria-labelledby="profile-title"
          className="w-full min-w-0 rounded-2xl ring-1 ring-white/5 bg-slate-900/60 p-4 md:p-5 transition-all duration-300"
        >
          <div className="space-y-4">
            {/* Row 1: Typ klienta + Risk preferencia (2 columns) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Typ klienta */}
              <fieldset className="space-y-2">
                <legend className="text-xs text-slate-400 mb-2">
                  Typ klienta
                </legend>
                <div className="flex flex-col gap-2 text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="client-type"
                      value="individual"
                      checked={clientType === "individual"}
                      onChange={(e) =>
                        persistClientType(e.currentTarget.value as any)
                      }
                      className="accent-blue-500"
                    />
                    <span>Jednotlivec</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="client-type"
                      value="family"
                      checked={clientType === "family"}
                      onChange={(e) =>
                        persistClientType(e.currentTarget.value as any)
                      }
                      className="accent-blue-500"
                    />
                    <span>Rodina</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="client-type"
                      value="firm"
                      checked={clientType === "firm"}
                      onChange={(e) =>
                        persistClientType(e.currentTarget.value as any)
                      }
                      className="accent-blue-500"
                    />
                    <span>Firma</span>
                  </label>
                </div>
              </fieldset>

              {/* Preferencia rizika */}
              <fieldset className="space-y-2">
                <legend className="text-xs text-slate-400 mb-2">
                  Preferencia rizika
                </legend>
                <div className="flex flex-col gap-2 text-sm">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="risk-pref"
                      value="konzervativny"
                      checked={riskPref === "konzervativny"}
                      onChange={(e) => persistRiskPref(e.currentTarget.value)}
                      className="accent-emerald-500"
                    />
                    <span>Konzervatívny (risk cap 4.0)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="risk-pref"
                      value="vyvazeny"
                      checked={riskPref === "vyvazeny"}
                      onChange={(e) => persistRiskPref(e.currentTarget.value)}
                      className="accent-amber-500"
                    />
                    <span>Vyvážený (risk cap 6.0)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="risk-pref"
                      value="rastovy"
                      checked={riskPref === "rastovy"}
                      onChange={(e) => persistRiskPref(e.currentTarget.value)}
                      className="accent-red-500"
                    />
                    <span>Rastový (risk cap 7.5)</span>
                  </label>
                </div>
              </fieldset>
            </div>

            {/* Row 2: Krízový bias (kratší slider) + tlačidlo "Mám úver" */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
              <div className="space-y-2">
                <label
                  htmlFor="crisis-bias-slider"
                  className="text-xs text-slate-400 block"
                >
                  Krízový bias (0 až 3)
                </label>
                <div className="flex items-center gap-3 max-w-xs">
                  <input
                    id="crisis-bias-slider"
                    type="range"
                    min={0}
                    max={3}
                    step={1}
                    value={crisisBias}
                    onChange={(e) =>
                      persistCrisisBias(Number(e.currentTarget.value))
                    }
                    className="flex-1"
                    aria-label="Krízový bias (0 až 3)"
                  />
                  <span className="text-sm font-semibold tabular-nums w-8 text-center">
                    {crisisBias}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDebtClick}
                className="px-4 py-2 rounded-lg bg-amber-600/20 ring-1 ring-amber-500/40 text-sm font-medium hover:bg-amber-600/30 transition-colors whitespace-nowrap"
              >
                💳 Mám úver
              </button>
            </div>
          </div>
        </section>
      )}
    </>
  );
};
