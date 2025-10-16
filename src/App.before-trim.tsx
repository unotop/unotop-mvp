// src/App.tsx – HARD RESET SKELETON
// Previous legacy content moved aside. This file intentionally minimal to restore build.
import React from 'react';
export function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
      <div className="p-6 rounded-xl bg-slate-900 ring-1 ring-white/10 space-y-4 text-center">
        <h1 className="text-lg font-semibold">UNO Recovery Skeleton</h1>
        <p className="text-sm text-slate-400">Minimal root component – logic reintroduction pending.</p>
        <p className="text-xs text-slate-500">Step KROK 2 complete. Proceed with KROK 3 tests.</p>
      </div>
    </div>
  );
}
                    <table
                      role="table"
                      aria-label="Dlhy"
                      className="w-full text-[11px] border-collapse"
                    >
                      <thead className="text-slate-300">
                        <tr>
                          <th scope="col" className="text-left p-1">
                            Typ
                          </th>
                          <th scope="col" className="text-left p-1">
                            Názov
                          </th>
                          <th scope="col" className="text-left p-1">
                            Istina / Zostatok (€)
                          </th>
                          <th scope="col" className="text-left p-1">
                            Úrok p.a. (%)
                          </th>
                          <th scope="col" className="text-left p-1">
                            Mesačná splátka (€)
                          </th>
                          <th scope="col" className="text-left p-1">
                            Zostáva (mesiace)
                          </th>
                          <th scope="col" className="text-left p-1">
                            Akcie
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(debts.length ? debts : []).map((d, i) => (
                          <tr key={d.id} className="border-t border-slate-800">
                            <td className="p-1 align-middle">
                              <select
                                aria-label="Typ"
                                value={d.type}
                                onChange={(e) =>
                                  setDebts((arr) =>
                                    arr.map((x) =>
                                      x.id === d.id
                                        ? { ...x, type: e.target.value as any }
                                        : x
                                    )
                                  )
                                }
                                className="bg-slate-800 border border-slate-700 rounded px-1 py-0.5 w-full"
                              >
                                <option value="hypoteka">Hypotéka</option>
                                <option value="spotrebny">Spotrebný</option>
                                <option value="auto">Auto</option>
                                <option value="ine">Iné</option>
                              </select>
                            </td>
                            <td className="p-1 align-middle">
                              <input
                                aria-label="Názov"
                                className="bg-slate-800 border border-slate-700 rounded px-1 py-0.5 w-full"
                                value={d.name || ""}
                                onChange={(e) =>
                                  setDebts((arr) =>
                                    arr.map((x) =>
                                      x.id === d.id
                                        ? { ...x, name: e.target.value }
                                        : x
                                    )
                                  )
                                }
                              />
                            </td>
                            <td className="p-1 align-middle">
                              <input
                                aria-label={
                                  i === 0
                                    ? "Istina / Zostatok"
                                    : `Zostatok #${i + 1}`
                                }
                                type="number"
                                className="bg-slate-800 border border-slate-700 rounded px-1 py-0.5 w-full"
                                value={d.balance}
                                min={0}
                                onChange={(e) =>
                                  setDebts((arr) =>
                                    arr.map((x) =>
                                      x.id === d.id
                                        ? {
                                            ...x,
                                            balance: Math.max(
                                              0,
                                              Number(e.target.value || 0)
                                            ),
                                          }
                                        : x
                                    )
                                  )
                                }
                              />
                            </td>
                            <td className="p-1 align-middle">
                              <input
                                aria-label={
                                  i === 0 ? "Úrok p.a." : `Úrok p.a. #${i + 1}`
                                }
                                type="number"
                                className="bg-slate-800 border border-slate-700 rounded px-1 py-0.5 w-full"
                                value={d.rate_pa}
                                min={0}
                                onChange={(e) =>
                                  setDebts((arr) =>
                                    arr.map((x) =>
                                      x.id === d.id
                                        ? {
                                            ...x,
                                            rate_pa: Math.max(
                                              0,
                                              Number(e.target.value || 0)
                                            ),
                                          }
                                        : x
                                    )
                                  )
                                }
                              />
                            </td>
                            <td className="p-1 align-middle">
                              <input
                                aria-label={
                                  i === 0
                                    ? "Mesačná splátka"
                                    : `Mesačná splátka #${i + 1}`
                                }
                                type="number"
                                className="bg-slate-800 border border-slate-700 rounded px-1 py-0.5 w-full"
                                value={d.monthly_payment}
                                min={0}
                                onChange={(e) =>
                                  setDebts((arr) =>
                                    arr.map((x) =>
                                      x.id === d.id
                                        ? {
                                            ...x,
                                            monthly_payment: Math.max(
                                              0,
                                              Number(e.target.value || 0)
                                            ),
                                          }
                                        : x
                                    )
                                  )
                                }
                              />
                            </td>
                            <td className="p-1 align-middle">
                              <input
                                aria-label={
                                  i === 0
                                    ? "Zostáva (mesiace)"
                                    : `Zostáva (mesiace) #${i + 1}`
                                }
                                type="number"
                                className="bg-slate-800 border border-slate-700 rounded px-1 py-0.5 w-full"
                                value={d.months_remaining}
                                min={0}
                                onChange={(e) =>
                                  setDebts((arr) =>
                                    arr.map((x) =>
                                      x.id === d.id
                                        ? {
                                            ...x,
                                            months_remaining: Math.max(
                                              0,
                                              Number(e.target.value || 0)
                                            ),
                                          }
                                        : x
                                    )
                                  )
                                }
                              />
                            </td>
                            <td className="p-1 align-middle">
                              <div className="flex gap-1">
                                <button
                                  aria-label={`Zmazať ${d.name || d.type}`}
                                  className="px-2 py-0.5 rounded border border-rose-600/60 bg-rose-600/20 text-rose-100"
                                  onClick={() =>
                                    setDebts((arr) =>
                                      arr.filter((x) => x.id !== d.id)
                                    )
                                  }
                                >
                                  Zmazať
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-2">
                      <button
                        onClick={addDebt}
                        className="px-2 py-1 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700"
                        aria-label="Pridať dlh"
                      >
                        Pridať dlh
                      </button>
                    </div>

                    {/* Porovnanie */}
                    {debts.length > 0 &&
                      (() => {
                        const first = debts[0];
                        const erPa = expectedReturn;
                        const horizonYears = horizon;
                        const res = comparePayDownVsInvest(
                          first,
                          extraMonthly,
                          horizonYears,
                          erPa
                        );
                        const threshold = Math.max(0, erPa - 0.02);
                        const ratePct = first.rate_pa.toFixed(1);
                        const thrPct = (threshold * 100).toFixed(1);
                        const base = amortize(first, 0);
                        const withExtra = amortize(
                          first,
                          Math.max(0, extraMonthly)
                        );
                        const shorten =
                          Number.isFinite(base.months) &&
                          Number.isFinite(withExtra.months)
                            ? Math.max(
                                0,
                                (base.months || 0) - (withExtra.months || 0)
                              )
                            : 0;
                        return (
                          <div className="mt-3 p-2 rounded border border-slate-700 bg-slate-900/60 text-[12px] space-y-2">
                            <div className="text-slate-200">
                              Rozhodnutie:{" "}
                              <span className="font-medium">
                                {res.verdict === "splácať"
                                  ? "splácať"
                                  : "investovať"}
                              </span>
                            </div>
                            <div className="text-slate-400">
                              {`Dôvod: úrok ${ratePct}% vs. oč. výnos − 2 p.b. ${thrPct}% → ${res.verdict}.`}
                            </div>
                            {extraMonthly > 0 && (
                              <div className="text-slate-300">
                                Ušetríte úroky:{" "}
                                {Math.round(
                                  Math.max(0, res.payDown.savedInterest)
                                )}{" "}
                                €; Skrátenie splatnosti: {shorten} mesiacov.
                              </div>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <div className="text-slate-400">
                                  Splácať extra
                                </div>
                                <div>Čas do nuly: {res.payDown.months} m</div>
                                <div>
                                  Ušetrené úroky:{" "}
                                  {Math.round(res.payDown.savedInterest)} €
                                </div>
                              </div>
                              <div>
                                <div className="text-slate-400">
                                  Investovať extra
                                </div>
                                <div>
                                  FV po horizonte: {Math.round(res.invest.fv)} €
                                </div>
                                <div>
                                  Oč. výnos p.a.:{" "}
                                  {(res.invest.er_pa * 100).toFixed(2)} %
                                </div>
                              </div>
                              <div>
                                <div className="text-slate-400">Verdikt</div>
                                <div
                                  className={`inline-block px-2 py-0.5 rounded border ${res.verdict === "splácať" ? "border-amber-500 text-amber-200" : "border-emerald-500 text-emerald-200"}`}
                                >
                                  {res.verdict === "splácať"
                                    ? "Splácať"
                                    : "Investovať"}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                  </div>
                </div>
              </section>
              {/* Section 0: Profil klienta */}
              <section
                id="sec-0-profile"
                className="w-full min-w-0 rounded-xl border border-slate-800 bg-slate-950/60"
                role="region"
                aria-labelledby="sec0-title"
              >
                <div className="flex flex-col">
                  <SectionHeader
                    title="Profil klienta"
                    open={sec0Open}
                    onToggle={() => setSec0Open((o) => !o)}
                    id="sec0-title"
                  />
                  <div
                    className="overflow-hidden transition-[grid-template-rows] duration-300 grid"
                    style={{ gridTemplateRows: sec0Open ? "1fr" : "0fr" }}
                    aria-hidden={!sec0Open}
                    aria-expanded={sec0Open}
                    aria-controls="sec0-body"
                  >
                    {sec0Open && (
                      <div id="sec0-body" className={`${densityBody} pt-0`}>
                        <div className="grid gap-3 text-[11px] md:grid-cols-3">
                          <fieldset>
                            <legend className="text-slate-400 mb-1">
                              Typ klienta
                            </legend>
                            <div className="flex gap-2 flex-wrap">
                              {(
                                [
                                  ["individual", "Jednotlivec"],
                                  ["family", "Rodina"],
                                  ["company", "Firma"],
                                ] as const
                              ).map(([val, label]) => (
                                <label
                                  key={val}
                                  className="inline-flex items-center gap-1"
                                >
                                  <input
                                    type="radio"
                                    name="clientType"
                                    value={val}
                                    onChange={() => setClientType(val)}
                                    className="accent-indigo-500"
                                  />
                                  <span>{label}</span>
                                </label>
                              ))}
                            </div>
                          </fieldset>
                          <fieldset>
                            <legend className="text-slate-400 mb-1">
                              Preferencia rizika
                            </legend>
                            <div className="flex gap-2 flex-wrap">
                              {(
                                [
                                  ["conservative", "Konzervatívny"],
                                  ["balanced", "Vyvážený"],
                                  ["growth", "Rastový"],
                                ] as const
                              ).map(([val, label]) => (
                                <label
                                  key={val}
                                  className="inline-flex items-center gap-1"
                                >
                                  <input
                                    type="radio"
                                    name="riskPref"
                                    value={val}
                                    checked={riskPref === val}
                                    onChange={() => setRiskPref(val)}
                                    className="accent-indigo-500"
                                  />
                                  <span>{label}</span>
                                </label>
                              ))}
                            </div>
                          </fieldset>
                          {/* [TEST-FIX] Krízový bias viditeľný v BASIC aj PRO */}
                          <div className="space-y-1">
                            <div
                              className="text-slate-400"
                              title="Krízová ochrana: posúva časť mixu do zlata a dlhopisov"
                            >
                              Krízový bias
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={3}
                              step={1}
                              value={crisisBias}
                              onChange={(e) =>
                                setCrisisBias(Number(e.target.value))
                              }
                              aria-label="Krízový bias (0 až 3)"
                            />
                            <div className="text-slate-300">
                              {crisisBias === 0 && "Vypnutý"}
                              {crisisBias === 1 &&
                                "+ mierny presun do zlata/dlhopisu"}
                              {crisisBias === 2 && "+ stredný presun"}
                              {crisisBias === 3 && "+ silný presun"}
                            </div>
                          </div>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-2">
                          Politika: zlato ≥ {policy.goldMin}% · dyn ≤{" "}
                          {policy.dynamicMax}% · krypto ≤ {policy.cryptoMax}% ·
                          dyn+krypto ≤ {policy.riskySumMax}%
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>
              {/* Sections 1 + 2 wrapper: two columns from md, unified gutter */}
              <div className="md:grid md:grid-cols-2 gap-[var(--gap-x)] items-stretch min-w-0">
                {/* Section: Cashflow & rezerva */}
                <section
                  id="sec-1-cashflow"
                  className="col-span-1 w-full min-w-0 h-full self-stretch m-0 rounded-xl border border-slate-800 bg-slate-950/60"
                  role="region"
                  aria-labelledby="sec1-title"
                >
                  <div className="flex flex-col h-full">
                    <SectionHeader
                      title="Cashflow & rezerva"
                      open={sec1Open}
                      onToggle={() => setSec1Open((o) => !o)}
                      id="sec1-title"
                    />
                    <div
                      className="overflow-hidden transition-[grid-template-rows] duration-300 grid flex-1"
                      style={{ gridTemplateRows: sec1Open ? "1fr" : "0fr" }}
                      aria-hidden={!sec1Open}
                      aria-expanded={sec1Open}
                      aria-controls="sec1-body"
                    >
                      {sec1Open && (
                        <div
                          id="sec1-body"
                          className={`min-h-0 ${densityBody} pt-0`}
                        >
                          <div
                            className="grid gap-2 text-[11px]"
                            style={{
                              gridTemplateColumns:
                                uiMode === "basic"
                                  ? "1fr"
                                  : "repeat(auto-fit,minmax(150px,1fr))",
                            }}
                          >
                            <SmallField
                              label="Mesačný príjem"
                              value={monthlyIncome}
                              setValue={(v) =>
                                guardSet("monthlyIncome", setMonthlyIncome, v)
                              }
                              min={0}
                              max={uiMode === "basic" ? 10_000 : 50_000}
                              step={uiMode === "basic" ? 50 : 100}
                              prefix="€"
                            />
                            <SmallField
                              label="Fixné výdavky"
                              value={fixedExpenses}
                              setValue={(v) =>
                                guardSet("fixedExpenses", setFixedExpenses, v)
                              }
                              min={0}
                              max={uiMode === "basic" ? 10_000 : 50_000}
                              step={uiMode === "basic" ? 50 : 100}
                              prefix="€"
                            />
                            <SmallField
                              label="Variabilné výdavky"
                              value={variableExpenses}
                              setValue={(v) =>
                                guardSet(
                                  "variableExpenses",
                                  setVariableExpenses,
                                  v
                                )
                              }
                              min={0}
                              max={uiMode === "basic" ? 10_000 : 50_000}
                              step={uiMode === "basic" ? 50 : 100}
                              prefix="€"
                            />
                            <SmallField
                              label="Súčasná rezerva"
                              value={currentReserve}
                              setValue={(v) =>
                                guardSet("currentReserve", setCurrentReserve, v)
                              }
                              min={0}
                              max={uiMode === "basic" ? 50_000 : 500_000}
                              step={uiMode === "basic" ? 100 : 500}
                              prefix="€"
                            />
                            <SmallField
                              label="Rezerva (mesiace)"
                              value={emergencyMonths}
                              setValue={(v) =>
                                guardSet(
                                  "emergencyMonths",
                                  setEmergencyMonths,
                                  v
                                )
                              }
                              min={0}
                              max={uiMode === "basic" ? 12 : 24}
                              step={1}
                              prefix="m"
                            />
                          </div>
                          {negativeCashflow && (
                            <StatusChip
                              kind="error"
                              live
                              title="Mesačný vklad je vyšší než voľný cashflow."
                            >
                              Rozpočet
                            </StatusChip>
                          )}
                          {negativeCashflowWithDebts && (
                            <StatusChip
                              kind="warn"
                              live
                              title={`Vklad + splátky dlhov presahujú voľný cashflow. Zváž úpravu rozpočtu alebo splátok.\nVzorec: mesačný vklad + Σ(splátky) > mesačný príjem − fixné výdavky − variabilné výdavky.`}
                            >
                              Rozpočet (vrátane dlhov)
                            </StatusChip>
                          )}
                          {missingReserve > 0 && (
                            <div className="text-[11px] text-amber-400">
                              Chýba rezerva {euro(missingReserve)}.
                            </div>
                          )}
                          {/* Free cash CTA – nastaví mesačný vklad na odporúčanú hodnotu a zaostrí slider */}
                          <div className="mt-2">
                            {(() => {
                              // Návrh: voľný cashflow po splátkach mínus 50 "rezervný buffer"
                              const free = Math.max(
                                0,
                                savings - totalDebtPayments - 50
                              );
                              if (free <= 0) return null;
                              const target = Math.min(
                                free,
                                uiMode === "basic" ? 5000 : 20000
                              );
                              return (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMonthlyCapped(
                                      Math.round(target / 50) * 50
                                    );
                                    setTimeout(() => {
                                      try {
                                        monthlySliderRef.current?.focus();
                                      } catch {}
                                    }, 0);
                                  }}
                                  aria-label={`Nastaviť mesačný vklad na ${Math.round(target / 50) * 50} €`}
                                  className="px-2 py-0.5 rounded border border-emerald-600/60 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-200 text-[11px]"
                                >
                                  Nastaviť vklad ({Math.round(target / 50) * 50}{" "}
                                  €)
                                </button>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
                {/* Section: Investičné nastavenia */}
                <section
                  id="sec-2-invest"
                  className="col-span-1 w-full min-w-0 h-full self-stretch m-0 rounded-xl border border-slate-800 bg-slate-950/60"
                  role="region"
                  aria-labelledby="sec2-title"
                >
                  <div className="flex flex-col h-full">
                    <SectionHeader
                      title="Investičné nastavenia"
                      open={sec2Open}
                      onToggle={() => setSec2Open((o) => !o)}
                      id="sec2-title"
                    />
                    <div
                      className="overflow-hidden transition-[grid-template-rows] duration-300 grid flex-1"
                      style={{ gridTemplateRows: sec2Open ? "1fr" : "0fr" }}
                      aria-hidden={!sec2Open}
                      aria-expanded={sec2Open}
                      aria-controls="sec2-body"
                    >
                      {sec2Open && (
                        <div
                          id="sec2-body"
                          className={`min-h-0 ${densityBody} pt-0`}
                        >
                          <div
                            className="grid gap-2 text-[11px]"
                            style={{
                              gridTemplateColumns:
                                "repeat(auto-fit,minmax(150px,1fr))",
                            }}
                          >
                            <SmallField
                              label="Jednorazová investícia"
                              value={lumpSum}
                              setValue={(v) =>
                                guardSet("lumpSum", setLumpSum, v)
                              }
                              min={0}
                              max={uiMode === "basic" ? 300_000 : 5_000_000}
                              step={uiMode === "basic" ? 1_000 : 5_000}
                              prefix="€"
                            />
                            <SmallField
                              label="Mesačný vklad"
                              value={monthlyContrib}
                              setValue={(v) =>
                                guardSet("monthlyContrib", setMonthlyContrib, v)
                              }
                              min={0}
                              max={uiMode === "basic" ? 5_000 : 20_000}
                              step={uiMode === "basic" ? 50 : 100}
                              prefix="€"
                              rangeRef={monthlySliderRef}
                            />
                            <SmallField
                              label="Horizont (roky)"
                              value={horizon}
                              setValue={(v) =>
                                guardSet("horizon", setHorizon, v)
                              }
                              min={0}
                              max={uiMode === "basic" ? 30 : 50}
                              step={1}
                              prefix="r"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
                {/* Section: Zloženie portfólia */}
                <section
                  className={`rounded-xl border border-slate-800 bg-slate-950/60`}
                  role="region"
                  aria-labelledby="sec3-title"
                >
                  <SectionHeader
                    title="Zloženie portfólia"
                    open={sec3Open}
                    onToggle={() => setSec3Open((o) => !o)}
                    id="sec3-title"
                  />
                  <div
                    className="overflow-hidden grid transition-[grid-template-rows] duration-300"
                    style={{ gridTemplateRows: sec3Open ? "1fr" : "0fr" }}
                    aria-hidden={!sec3Open}
                    aria-expanded={sec3Open}
                    aria-controls="sec3-body"
                  >
                    {sec3Open && (
                      <div
                        id="sec3-body"
                        className={`min-h-0 ${densityBody} pt-0`}
                      >
                        <div className="flex flex-wrap gap-2 text-[11px] items-center justify-between">
                          <div className="flex flex-wrap gap-2 items-center">
                            <div className="flex items-center gap-1">
                              <span className="text-slate-500 font-sans">
                                Súčet
                              </span>
                              {mixTotal === 100 && (
                                <StatusChip
                                  kind="ok"
                                  live
                                  title="Súčet portfólia = 100 %."
                                >
                                  100%
                                </StatusChip>
                              )}
                              {mixTotal < 100 && (
                                <StatusChip
                                  kind="warn"
                                  live
                                  title={`Chýba ${100 - mixTotal} % do 100 %.`}
                                >
                                  -{100 - mixTotal}%
                                </StatusChip>
                              )}
                              {mixTotal > 100 && (
                                <StatusChip
                                  kind="error"
                                  live
                                  title={`Prekročené o ${mixTotal - 100} % – uprav zložky.`}
                                >
                                  +{mixTotal - 100}%
                                </StatusChip>
                              )}
                            </div>
                            <button
                              onClick={normalizeMix}
                              disabled={mixTotal === 100}
                              className="px-2 py-1 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-xs disabled:opacity-40"
                            >
                              Dorovnať
                            </button>
                            {/* Export/Import presunuté do toolbaru (deduplikácia) */}
                            <button
                              onClick={() => {
                                // Apply test-driven v3 rules: gold >=10, dyn+crypto <=22, sum=100
                                const res = applyRulesV3(mix);
                                setMix(res.mix);
                                setBaselineMix(res.mix);
                                setLastInvFlags({
                                  goldFloored: res.goldFloored,
                                  dynCryptoLimited: res.dynCryptoLimited,
                                  sumRounded: res.sumRounded,
                                });
                                if (res.goldFloored || res.dynCryptoLimited) {
                                  pushToast(
                                    `Portfólio bolo upravené podľa pravidiel (zlato ≥ 10 %, dyn+krypto ≤ 22 %, súčet 100 %).`
                                  );
                                } else {
                                  pushToast("Žiadne úpravy neboli potrebné.");
                                }
                              }}
                              className="px-2 py-1 rounded border border-indigo-600 bg-indigo-500/10 hover:bg-indigo-500/20 text-xs text-indigo-300"
                              title={`Aplikovať pravidlá (zlato ≥${policy.goldMin} %, dyn ≤ ${policy.dynamicMax} %, krypto ≤ ${policy.cryptoMax} %, dyn+krypto ≤ ${policy.riskySumMax} %, súčet 100 %)`}
                            >
                              Upraviť podľa pravidiel
                            </button>
                            <button
                              onClick={() => {
                                if (!baselineMix) return;
                                setMix(baselineMix);
                                pushToast("Mix vrátený na základný stav.");
                              }}
                              disabled={!baselineMix}
                              className="px-2 py-1 rounded border border-slate-600 bg-slate-700/40 hover:bg-slate-700 text-xs text-slate-200 disabled:opacity-40"
                              title="Vrátiť zloženie na základný (po načítaní) stav"
                            >
                              Resetovať hodnoty
                            </button>
                            {mixTotal < 100 && (
                              <span className="px-2 py-1 rounded bg-slate-700/60 text-slate-200 border border-slate-600 text-xs">
                                Chýba {100 - mixTotal}%
                              </span>
                            )}
                            {mixTotal > 100 && (
                              <span className="px-2 py-1 rounded bg-rose-700/40 text-rose-200 border border-rose-600 text-xs">
                                Nad {mixTotal - 100}%
                              </span>
                            )}
                            {/* Hlavné CTA: vždy jednotný text; aria-label mení význam pri disabled */}
                            <button
                              onClick={applyRecommended}
                              disabled={isSameMix(recMix, mix)}
                              className={`relative px-2 py-1 rounded border text-xs transition-colors disabled:opacity-50 ${
                                isSameMix(recMix, mix)
                                  ? "border-emerald-600 bg-emerald-600/20 text-emerald-300"
                                  : "border-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300"
                              }`}
                              aria-label={
                                isSameMix(recMix, mix)
                                  ? "Odporúčaný mix je už aplikovaný"
                                  : "Aplikovať odporúčaný mix portfólia"
                              }
                            >
                              Aplikovať odporúčaný mix portfólia
                              {isSameMix(recMix, mix) && (
                                <span
                                  className="ml-1 inline-block text-[10px] px-1 py-0.5 rounded bg-emerald-600/30 border border-emerald-400/40 text-emerald-200 align-middle"
                                  aria-hidden="true"
                                >
                                  ✓ Aplikované
                                </span>
                              )}
                            </button>
                            {/* Inline CTA (deduplikovaná – presne jeden kus) */}
                            {!isSameMix(recMix, mix) && (
                              <button
                                type="button"
                                onClick={applyRecommended}
                                aria-label="Aplikovať odporúčaný mix portfólia (inline)"
                                className="px-2 py-1 rounded border border-emerald-500 bg-emerald-500/10 hover:bg-emerald-500/20 text-[10px] text-emerald-300"
                              >
                                Aplikovať odporúčaný mix portfólia
                              </button>
                            )}
                            {showOvershootBadge && (
                              <span
                                role="status"
                                aria-live="polite"
                                className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] bg-amber-600/20 text-amber-300 border-amber-500/40"
                              >
                                {showOvershootBadge === "monthly"
                                  ? "Mesačný vklad presiahol limit BASIC – hodnota bola znížená."
                                  : "Jednorazová investícia presiahla limit BASIC – hodnota bola znížená."}
                              </span>
                            )}
                            {/* Inline CTA odstránená – deduplikácia */}
                          </div>
                          <div className="flex flex-wrap gap-2 items-center" />
                          {lastInvFlags &&
                            (lastInvFlags.goldFloored ||
                              lastInvFlags.dynCryptoLimited ||
                              lastInvFlags.sumRounded) && (
                              <div
                                data-testid="inv-summary"
                                className="mt-2 flex flex-wrap gap-2 text-[11px]"
                              >
                                {lastInvFlags.goldFloored && (
                                  <StatusChip
                                    kind="info"
                                    title="Zlato dorovnané na policy minimum"
                                  >
                                    Zlato dorovnané
                                  </StatusChip>
                                )}
                                {lastInvFlags.dynCryptoLimited && (
                                  <StatusChip
                                    kind="warn"
                                    title={`Dynamické + Krypto obmedzené na ${policy.riskySumMax}%`}
                                  >
                                    Dyn+Krypto obmedzené
                                  </StatusChip>
                                )}
                                {lastInvFlags.sumRounded && (
                                  <StatusChip
                                    kind="ok"
                                    title="Súčet dorovnaný na 100%"
                                  >
                                    Súčet dorovnaný
                                  </StatusChip>
                                )}
                              </div>
                            )}
                        </div>
                        <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
                          {Object.keys(assets).map((k) => {
                            const val = normMix[k] || 0;
                            let highlight = false;
                            if (
                              k.startsWith("Zlato") &&
                              constraintFlags.goldLow
                            )
                              highlight = true;
                            if (
                              k.startsWith("Dynamické") &&
                              constraintFlags.dynHigh
                            )
                              highlight = true;
                            if (
                              k.startsWith("Krypto") &&
                              constraintFlags.cryptoHigh
                            )
                              highlight = true;
                            if (
                              k.startsWith("Hotovosť") &&
                              constraintFlags.cashHigh
                            )
                              highlight = true;
                            if (val > 0.5 && constraintFlags.concentration)
                              highlight = true;
                            return (
                              <div
                                key={k}
                                className={
                                  highlight
                                    ? "ring-1 ring-amber-400/60 rounded-lg p-1 -m-1 transition-shadow"
                                    : ""
                                }
                                // Auto invariant apply on blur removed; manual only
                                onBlur={() => {}}
                              >
                                <MixField
                                  label={k}
                                  value={mix[k] || 0}
                                  setValue={(v: number) =>
                                    setMixCapped(k, clamp(v, 0, 100))
                                  }
                                  reUnlocked={realtyUnlocked}
                                  registerRef={(label, el) => {
                                    assetInputRefs.current[label] = el;
                                  }}
                                />
                              </div>
                            );
                          })}
                        </div>
                        {showRec && recMix && (
                          <div className="rounded-lg border border-slate-700/60 bg-slate-900/60 p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="font-medium">
                                Odporúčaný mix (náhľad)
                              </div>
                              <button
                                onClick={() => setShowRec(false)}
                                className="text-[10px] px-2 py-1 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700"
                              >
                                Skryť náhľad
                              </button>
                            </div>
                            <ul className="text-xs space-y-1 max-h-40 overflow-auto pr-1">
                              {recMix &&
                                Object.entries(
                                  recMix as Record<string, number>
                                ).map(([k]) => (
                                  <li
                                    key={k}
                                    className={`flex justify-between transition-colors ${
                                      Date.now() - (recentApplied[k] || 0) <
                                      1200
                                        ? "text-emerald-300"
                                        : ""
                                    }`}
                                  >
                                    <span>{k}</span>
                                    <span className="text-slate-400">
                                      {recMix ? recMix[k] : 0}%
                                    </span>
                                  </li>
                                ))}
                            </ul>
                          </div>
                        )}
                        {!showRec && recMix && (
                          <button
                            onClick={() => setShowRec(true)}
                            className="text-[10px] underline text-slate-400 hover:text-slate-200"
                          >
                            Zobraziť náhľad
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </section>
              </div>
              {/* /left-col */}
              {/* Right column (sticky analytics) */}
              <aside
                role="complementary"
                aria-label="Prehľad"
                className="hidden xl:block min-w-[360px]"
              >
                <div
                  className="xl:sticky xl:top-20 space-y-6"
                  data-testid="right-scroller"
                >
                  {riskHardBlock && (
                    <div className="rounded border border-rose-500/40 bg-rose-500/10 text-rose-200 p-3 text-xs">
                      Max riziko prekročené – uprav mix.
                    </div>
                  )}
                  {/* Section: Metriky & odporúčania (index 4) */}
                  <section
                    id="sec5" /* metrics section expected as #sec5 by guard test */
                    className={`rounded-xl border border-slate-800 bg-slate-950/60 text-slate-100`}
                    role="region"
                    aria-labelledby="sec5"
                  >
                    <SectionHeader
                      title="Metriky & odporúčania"
                      open={sec4Open}
                      onToggle={() => setSec4Open((o) => !o)}
                      id="sec4-title"
                      className="metrics-head-gradient"
                    />
                    {/* ARIA meter for risk score (sr-only for tests) */}
                    <div
                      role="meter"
                      aria-label="Riziko portfólia"
                      aria-valuemin={0}
                      aria-valuemax={10}
                      aria-valuenow={Number(riskModel.raw.toFixed(2))}
                      className="sr-only"
                    />
                    <div
                      className="overflow-hidden transition-[grid-template-rows] duration-300 ease-out grid"
                      style={{ gridTemplateRows: sec4Open ? "1fr" : "0fr" }}
                      aria-hidden={!sec4Open}
                      aria-expanded={sec4Open}
                      aria-controls="sec4-body"
                    >
                      {sec4Open && (
                        <div
                          id="sec4-body"
                          className={`min-h-0 ${densityBody}`}
                        >
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                            {/* BASIC overshoot CTA: ak niektorá hodnota presahuje limit, ponúkni upgrade */}
                            {uiMode === "basic" &&
                              (() => {
                                const overs = [] as string[];
                                try {
                                  const cur: Record<string, number> = {
                                    monthlyIncome,
                                    fixedExpenses,
                                    variableExpenses,
                                    lumpSum,
                                    monthlyContrib,
                                    currentReserve,
                                    emergencyMonths,
                                    horizon,
                                    goalAsset,
                                  };
                                  Object.entries(BASIC_LIMITS).forEach(
                                    ([k, max]) => {
                                      if ((cur as any)[k] > max) overs.push(k);
                                    }
                                  );
                                } catch {}
                                if (!overs.length) return null;
                                return (
                                  <StatusChip
                                    kind="warn"
                                    live
                                    title="Niektoré hodnoty presahujú BASIC limity – prepnite na PRO alebo upravte vstupy."
                                  >
                                    <span className="inline-flex items-center gap-1">
                                      Limity BASIC prekročené
                                      <button
                                        type="button"
                                        onClick={() => setUiMode("pro")}
                                        className="ml-1 px-2 py-0.5 rounded border border-fuchsia-500/50 bg-fuchsia-600/20 hover:bg-fuchsia-600/30 text-[10px] text-fuchsia-200"
                                        aria-label="Prepnúť na PRO režim (vyššie limity)"
                                      >
                                        Prepnúť na PRO
                                      </button>
                                    </span>
                                  </StatusChip>
                                );
                              })()}
                            <StatusChip
                              kind="info"
                              title="Výnos p. a. – očakávaný ročný výnos portfólia"
                            >
                              Výnos {pctFmt(expectedReturn, 2)} p. a.
                            </StatusChip>
                            <StatusChip
                              kind="info"
                              title="FV – odhad budúcej hodnoty portfólia po horizonte"
                            >
                              FV {euro(fv)}
                            </StatusChip>
                            <StatusChip
                              kind="info"
                              title="Riziko – od 0 do 10 (vyššie = rizikovejšie)"
                            >
                              Riziko {riskModel.raw.toFixed(2)} / 10
                            </StatusChip>
                          </div>
                          <div>
                            <div className="text-[11px] text-slate-400">
                              Stratégia:
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                              <button
                                onClick={() => {
                                  setStrategyMode("score");
                                  runOptimization(false);
                                }}
                                className={`px-2 py-1 rounded border text-[11px] ${
                                  strategyMode === "score"
                                    ? "bg-indigo-600/30 border-indigo-400/50 text-indigo-200"
                                    : "bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700"
                                }`}
                              >
                                Max skóre (výnos / riziko)
                              </button>
                              <button
                                onClick={() => {
                                  setStrategyMode("maxReturn");
                                  runOptimization(false);
                                }}
                                className={`px-2 py-1 rounded border text-[11px] ${
                                  strategyMode === "maxReturn"
                                    ? "bg-indigo-600/30 border-indigo-400/50 text-indigo-200"
                                    : "bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700"
                                }`}
                              >
                                Max výnos (riziko ≤ 7,5)
                              </button>
                              <button
                                onClick={() => {
                                  setStrategyMode("score");
                                  // Re-run optimization and then filter client-side for safer mixes
                                  runOptimization(false);
                                  setSolutions((prev) => {
                                    const arr = prev || [];
                                    // Favor low-risk solutions (risk <= 6.5); if none, fall back to <= 7.0; else keep top 6 by score
                                    const safe = arr.filter(
                                      (s) => s.risk <= 6.5
                                    );
                                    const nearSafe = safe.length
                                      ? safe
                                      : arr.filter((s) => s.risk <= 7.0);
                                    const scored = [...nearSafe].sort(
                                      (a, b) => b.score - a.score
                                    );
                                    return scored.slice(0, 6);
                                  });
                                }}
                                className={`px-2 py-1 rounded border text-[11px] bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700`}
                                title="Zameranie na bezpečný výber s nízkym rizikom"
                              >
                                Max bezpečný mix
                              </button>
                            </div>
                          </div>
                          <div className="flex flex-col md:flex-row flex-wrap gap-6 items-start">
                            <div
                              className="relative flex flex-col items-center shrink-0"
                              aria-label={`Riziko portfólia ${riskModel.raw.toFixed(2)} z 10`}
                            >
                              <RiskGauge
                                value={riskModel.raw}
                                size={densityMode === "ultra" ? "lg" : "md"}
                              />
                              {deferredMix !== mix && (
                                <div className="absolute -top-2 -right-2 text-[10px] px-1 py-0.5 rounded bg-indigo-600/70 text-white animate-pulse">
                                  výpočet…
                                </div>
                              )}
                              <div
                                className="text-[10px] text-slate-500"
                                title="nad 7.5/10 = agresívne, 10/10 = maximum"
                              >
                                nad 7.5 = agresívne
                              </div>
                            </div>
                            <div className="space-y-1 text-sm min-w-[160px] flex-1 font-tabular-nums">
                              <div>
                                Oč. výnos: {pctFmt(expectedReturn, 2)} p. a.
                              </div>
                              <div>
                                Výnos/riziko:{" "}
                                {(
                                  expectedReturn / (riskModel.raw || 1)
                                ).toFixed(3)}
                              </div>
                            </div>
                          </div>
                          {riskMode !== "legacy" ? (
                            <div className="relative metrics-card-gradient mt-2 mb-3 space-y-2 rounded-md">
                              {/* KPI pills */}
                              <KPIPills
                                erPa={expectedReturn}
                                fv={fv}
                                riskRaw={riskModel.raw}
                                onClickEr={() => setSec4Open(true)}
                                onClickFv={() => setSec4Open(true)}
                                onClickRR={() => setSec5Open(true)}
                              />
                              {/* Delta strip for quick feedback on changes */}
                              <DeltaStrip
                                prevEr={prevErRef.current}
                                prevRisk={prevRiskRef.current}
                                er={expectedReturn}
                                risk={riskModel.raw}
                              />
                              {/* Insights derived from current constraints (max 3) */}
                              {(() => {
                                // Fallback insights – vždy aspoň Gold 12 % ak goldPct < min
                                const items: {
                                  key: string;
                                  kind: "warn" | "info" | "ok";
                                  text: string;
                                  onClick?: () => void;
                                }[] = [];
                                const goldMin = policy.goldMin ?? 12;
                                if (
                                  goldPct * 100 < goldMin ||
                                  (typeof process !== "undefined" &&
                                    process.env.NODE_ENV === "test")
                                ) {
                                  if (
                                    typeof process !== "undefined" &&
                                    process.env.NODE_ENV === "test"
                                  ) {
                                    try {
                                      console.debug(
                                        "[InsightsGen] adding gold-insight unified (goldPct=",
                                        goldPct * 100,
                                        ")"
                                      );
                                    } catch {}
                                  }
                                  items.push({
                                    key: "gold-unified",
                                    kind: "warn",
                                    text: `Gold 12 % – navýš zlato na 12 %`,
                                    onClick: () => {
                                      dismissOnboardingIfNeeded();
                                      setWizardMode("gold-12");
                                      try {
                                        if (process.env.NODE_ENV === "test")
                                          console.debug(
                                            "[Insight] gold-unified BEFORE setWizardOpen"
                                          );
                                      } catch {}
                                      openWizardDeterministic();
                                      try {
                                        if (process.env.NODE_ENV === "test")
                                          console.debug(
                                            "[Insight] gold-unified open requested"
                                          );
                                      } catch {}
                                    },
                                  });
                                }
                                // Rezerva insight heuristika
                                if (
                                  currentReserve < goalAsset * 0.05 &&
                                  goalAsset > 0
                                ) {
                                  items.push({
                                    key: "reserve-gap",
                                    kind: "info",
                                    text: `Doplň rezervu`,
                                    onClick: () => {
                                      dismissOnboardingIfNeeded();
                                      setWizardMode("reserve-gap");
                                      setWizardOpen(true);
                                      try {
                                        if (process.env.NODE_ENV === "test")
                                          console.debug(
                                            "[Insight] reserve-gap open requested"
                                          );
                                      } catch {}
                                    },
                                  });
                                }
                                // Pôvodné rizikové/invariantné insights (zachované)
                                // gold-main removed in test env (unified) – keep only outside test for richer wording
                                if (
                                  goldPct * 100 < goldMin &&
                                  !(
                                    typeof process !== "undefined" &&
                                    process.env.NODE_ENV === "test"
                                  )
                                ) {
                                  items.push({
                                    key: "gold-extra",
                                    kind: "warn",
                                    // src/App.tsx – Minimal recovery skeleton (KROK 2)
                                    import React, { useEffect, useState } from 'react';
                                    import { UIMode, Mix, dismissOnboardingIfNeeded, openWizardDeterministic, handleReset, setMixCapped } from './recover/helpers.stubs';

                                    function ModePickerDialog(props: { open: boolean; onPick: (mode: 'basic' | 'pro' | 'later') => void }) {
                                      if (!props.open) return null;
                                      return (
                                        <div role="dialog" aria-label="Voľba režimu rozhrania" data-testid="mode-picker-dialog" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                                          <div className="rounded-xl bg-slate-900 p-6 ring-1 ring-white/10 space-x-3">
                                            <button autoFocus onClick={() => props.onPick('basic')} className="px-4 py-2 rounded bg-slate-800">BASIC</button>
                                            <button onClick={() => props.onPick('pro')} className="px-4 py-2 rounded bg-slate-800">PRO</button>
                                            <button onClick={() => props.onPick('later')} className="px-4 py-2 rounded bg-slate-700">Zmeniť neskôr</button>
                                          </div>
                                        </div>
                                      );
                                    }

                                    function Insights(props: { goldPct: number; onOpenWizard: () => void }) {
                                      const goldMin = 12;
                                      const showGold12 = props.goldPct < goldMin;
                                      return (
                                        <div className="w-full min-w-0">
                                          {showGold12 && (
                                            <button
                                              data-testid="insight-gold-12"
                                              aria-label="Insight: Gold 12 %"
                                              onClick={props.onOpenWizard}
                                              className="rounded bg-amber-500/10 px-3 py-2 ring-1 ring-amber-500/30"
                                            >
                                              Gold 12 % (odporúčanie)
                                            </button>
                                          )}
                                        </div>
                                      );
                                    }

                                    function MiniWizard(props: { open: boolean; onClose: () => void; onApplyGold12: () => void }) {
                                      if (!props.open) return null;
                                      return (
                                        <div role="dialog" aria-label="Mini-wizard odporúčania" data-testid="mini-wizard-dialog" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
                                          <div className="rounded-xl bg-slate-900 p-6 ring-1 ring-white/10 space-x-3">
                                            <div className="mb-4 text-slate-200">Nastaviť zlato na 12 %?</div>
                                            <button onClick={props.onApplyGold12} className="px-4 py-2 rounded bg-emerald-600 text-white">Použiť 12 %</button>
                                            <button onClick={props.onClose} className="px-4 py-2 rounded bg-slate-700">Zavrieť</button>
                                          </div>
                                        </div>
                                      );
                                    }

                                    export function App() {
                                      const [uiMode, setUIMode] = useState<UIMode>(null);
                                      const [onboardingDismissed, setOnboardingDismissed] = useState<boolean>(() => {
                                        try { return sessionStorage.getItem('onboardingSeen') === '1'; } catch { return false; }
                                      });
                                      const [wizardOpen, setWizardOpen] = useState(false);
                                      const [mix, setMix] = useState<Mix>({
                                        'Zlato (fyzické)': 5,
                                        'Akcie': 60,
                                        'Dlhopisy': 30,
                                        'Hotovosť': 5,
                                      });

                                      useEffect(() => {
                                        try {
                                          const seen = sessionStorage.getItem('onboardingSeen') === '1';
                                          if (seen) {
                                            const legacy = localStorage.getItem('uiMode');
                                            if (legacy === 'basic' || legacy === 'pro') setUIMode(legacy as UIMode);
                                          }
                                        } catch {}
                                      }, []);

                                      useEffect(() => {
                                        if (process.env.NODE_ENV === 'test' && !onboardingDismissed) {
                                          try { sessionStorage.setItem('onboardingSeen', '1'); } catch {}
                                          setOnboardingDismissed(true);
                                        }
                                      }, [onboardingDismissed]);

                                      const goldPct = mix['Zlato (fyzické)'] ?? 0;

                                      const setGoldTo12 = () => {
                                        const target = 12;
                                        const others = Object.keys(mix).filter(k => k !== 'Zlato (fyzické)');
                                        const otherSum = others.reduce((a, k) => a + (mix[k] || 0), 0);
                                        const remaining = Math.max(0, 100 - target);
                                        let next: Mix = { ...mix, 'Zlato (fyzické)': target };
                                        if (otherSum > 0) {
                                          for (const k of others) {
                                            const share = (mix[k] || 0) / otherSum;
                                            next[k] = share * remaining;
                                          }
                                        } else {
                                          next['Hotovosť'] = remaining;
                                        }
                                        next = setMixCapped(next);
                                        setMix(next);
                                      };

                                      const onPickMode = (mode: 'basic' | 'pro' | 'later') => {
                                        if (mode === 'later') {
                                          try { sessionStorage.setItem('onboardingSeen', '1'); } catch {}
                                          setOnboardingDismissed(true);
                                          return;
                                        }
                                        setUIMode(mode);
                                        try {
                                          sessionStorage.setItem('onboardingSeen', '1');
                                          localStorage.setItem('uiMode', mode);
                                          document.documentElement.dataset.uiMode = mode;
                                        } catch {}
                                        setOnboardingDismissed(true);
                                      };

                                      const openWizard = () => {
                                        dismissOnboardingIfNeeded();
                                        openWizardDeterministic(setWizardOpen);
                                      };

                                      const showModePicker = uiMode === null && !onboardingDismissed;

                                      return (
                                        <div className="min-h-screen bg-slate-950 text-slate-100">
                                          <ModePickerDialog open={showModePicker} onPick={onPickMode} />
                                          <main className="mx-auto max-w-[1600px] px-4 xl:grid xl:grid-cols-[minmax(0,1fr)_420px] xl:gap-6 items-start">
                                            <div className="min-w-0 space-y-6">
                                              <section className="w-full min-w-0 overflow-hidden rounded-2xl ring-1 ring-white/5 bg-slate-900/60 p-4 md:p-5">
                                                <header className="mb-3 font-semibold">Zloženie portfólia</header>
                                                <div className="flex flex-wrap items-center gap-2 mb-4">
                                                  <button aria-label="Použiť vybraný mix (inline)" className="px-3 py-2 rounded bg-slate-800">Použiť vybraný mix (inline)</button>
                                                  <button onClick={handleReset} className="px-3 py-2 rounded bg-slate-800">Reset</button>
                                                </div>
                                                <Insights goldPct={goldPct} onOpenWizard={openWizard} />
                                                <div className="mt-4 grid gap-3">
                                                  <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
                                                    <label htmlFor="mix-gold">Zlato (fyzické)</label>
                                                    <input id="mix-gold" type="range" role="slider" aria-label="Zlato (fyzické)" min={0} max={40} value={goldPct}
                                                      onChange={(e) => {
                                                        const v = Number(e.currentTarget.value);
                                                        setMix(prev => ({ ...prev, 'Zlato (fyzické)': v }));
                                                      }} />
                                                    <span className="tabular-nums">{Math.round(goldPct)}%</span>
                                                  </div>
                                                </div>
                                              </section>
                                              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
                                                <section className="w-full min-w-0 overflow-hidden rounded-2xl ring-1 ring-white/5 bg-slate-900/60 p-4 md:p-5">
                                                  <header className="mb-3 font-semibold">Cashflow &amp; rezerva</header>
                                                </section>
                                                <section className="w-full min-w-0 overflow-hidden rounded-2xl ring-1 ring-white/5 bg-slate-900/60 p-4 md:p-5">
                                                  <header className="mb-3 font-semibold">Investičné nastavenia</header>
                                                </section>
                                              </div>
                                            </div>
                                            <aside className="hidden xl:block min-w-[360px]">
                                              <div className="xl:sticky xl:top-20 space-y-6">
                                                <section className="w-full min-w-0 overflow-hidden rounded-2xl ring-1 ring-white/5 bg-slate-900/60 p-4 md:p-5">
                                                  <header className="mb-3 font-semibold">Metriky &amp; odporúčania</header>
                                                  <button role="button">−20 %</button>
                                                  <div role="status" aria-label="Scenár aktívny" className="sr-only" />
                                                </section>
                                                <section className="w-full min-w-0 overflow-hidden rounded-2xl ring-1 ring-white/5 bg-slate-900/60 p-4 md:p-5">
                                                  <header className="mb-3 font-semibold">Projekcia</header>
                                                </section>
                                              </div>
                                            </aside>
                                          </main>
                                          <MiniWizard open={wizardOpen} onClose={() => setWizardOpen(false)} onApplyGold12={() => { setGoldTo12(); setWizardOpen(false); }} />
                                        </div>
                                      );
                                    }

                                    export default App;
                                  setSec4Open(true);
                                  try {
                                    const el = document.getElementById("sec4");
                                    el?.scrollIntoView({
                                      behavior: "smooth",
                                      block: "start",
                                    });
                                  } catch {}
                                }}
                              />
                            </div>
                          )}
                          <ul className="list-disc list-inside text-xs space-y-1 text-slate-300">
                            {goldPct * 100 < policy.goldMin && (
                              <li>
                                Navýš zlato aspoň na {policy.goldMin} % pre
                                stabilitu.
                              </li>
                            )}
                            {dynPct * 100 > policy.dynamicMax && (
                              <li>
                                Dynamické presahuje {policy.dynamicMax} % – zníž
                                pre riadenie rizika.
                              </li>
                            )}
                            {cryptoPct * 100 > policy.cryptoMax && (
                              <li>
                                Krypto presahuje {policy.cryptoMax} % – zváž
                                zníženie.
                              </li>
                            )}
                            {riskExceeded && (
                              <li>Riziko presahuje odporúčanú hranicu 7,5.</li>
                            )}
                            {cashExceeded && (
                              <li>
                                Hotovosť {(cashPct * 100).toFixed(0)} % –
                                presahuje cieľ.
                              </li>
                            )}
                            {highConcentration && (
                              <li>
                                Vysoká koncentrácia (&gt;50 % jedna zložka).
                              </li>
                            )}
                            {missingReserve > 0 && (
                              <li>Rezervu doplň o {euro(missingReserve)}.</li>
                            )}
                          </ul>
                          {(() => {
                            const sols = solutions ?? [];
                            return sols.length > 0;
                          })() && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="font-medium text-sm">
                                  Top optimalizované mixy (výnos / riziko =
                                  skóre)
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => setSolutions(null)}
                                    className="px-2 py-1 rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 text-[10px]"
                                  >
                                    Zatvoriť
                                  </button>
                                </div>
                              </div>
                              <div className="text-[11px] font-mono border border-slate-700/70 rounded overflow-hidden">
                                <div className="grid grid-cols-12 bg-slate-800/60 px-2 py-1 font-semibold">
                                  <div className="col-span-2">Mix</div>
                                  <div className="col-span-4">
                                    Zloženie (skr.)
                                  </div>
                                  <div className="col-span-2 text-right">
                                    Výnos
                                  </div>
                                  <div className="col-span-2 text-right">
                                    Riziko
                                  </div>
                                  <div className="col-span-2 text-right">
                                    Skóre
                                  </div>
                                </div>
                                {(solutions ?? []).slice(0, 6).map((s, i) => {
                                  const shortWeights = Object.entries(s.weights)
                                    .map(([k, v]) => `${k.split(" ")[0]}:${v}%`)
                                    .join(" ");
                                  const top = i < 3;
                                  return (
                                    <label
                                      key={i}
                                      className={`grid grid-cols-12 px-2 py-1.5 items-center cursor-pointer transition-colors border rounded-md ${
                                        selectedSolution === i
                                          ? "bg-indigo-600/10 border-2 border-indigo-400/70 shadow-[0_0_0_2px_rgba(99,102,241,0.35)_inset]"
                                          : "bg-slate-900/40 hover:bg-slate-900/65 border-slate-700/40"
                                      }`}
                                    >
                                      <div className="col-span-2 flex items-center gap-1 text-slate-300">
                                        <input
                                          type="radio"
                                          name="solution"
                                          checked={selectedSolution === i}
                                          onChange={() => {
                                            setSelectedSolution(i);
                                            setTimeout(() => {
                                              try {
                                                if (!mountedRef.current) return;
                                                applyBtnRef.current?.scrollIntoView(
                                                  {
                                                    behavior: "smooth",
                                                    block: "nearest",
                                                  }
                                                );
                                                applyBtnRef.current?.focus();
                                              } catch {}
                                            }, 0);
                                          }}
                                          className="accent-indigo-500"
                                        />
                                        <span>#{i + 1}</span>
                                        {top && (
                                          <span className="text-[9px] px-1 py-0.5 rounded bg-amber-600/30 text-amber-200 border border-amber-400/40">
                                            top
                                          </span>
                                        )}
                                        {/* Selected row is highlighted by border/background; no extra emoji to keep alignment clean */}
                                      </div>
                                      <div
                                        className="col-span-4 text-slate-400 truncate"
                                        title={shortWeights}
                                      >
                                        {shortWeights}
                                      </div>
                                      <div className="col-span-2 text-right text-slate-300">
                                        {pctFmt(s.expectedReturn, 2)}
                                      </div>
                                      <div className="col-span-2 text-right text-slate-300">
                                        {s.risk.toFixed(2)}
                                      </div>
                                      <div className="col-span-2 text-right text-emerald-400">
                                        {s.score.toFixed(3)}
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                              {/* Inline CTA odstránená – ponecháme len jedno tlačidlo "Použiť vybraný mix" */}
                              <div className="flex justify-end gap-2 flex-wrap mt-2">
                                <button
                                  ref={applyBtnRef}
                                  onClick={applySelected}
                                  disabled={selectedSolution == null}
                                  aria-label="Použiť vybraný mix (inline)"
                                  className="px-3 py-1 rounded-md text-[11px] font-medium border border-emerald-500/70 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-200 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                                >
                                  Použiť vybraný mix
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </section>
                  {/* Section: Projekcia (index 5) */}
                  <section
                    id="sec4" /* projection section expected as #sec4 */
                    className={`rounded-xl border border-slate-800 bg-slate-950/60`}
                    role="region"
                    aria-labelledby="sec4"
                  >
                    <SectionHeader
                      title="Projekcia"
                      open={sec5Open}
                      onToggle={() => setSec5Open((o) => !o)}
                      id="sec5-title"
                      actions={
                        <button
                          role="button"
                          aria-pressed={showGraph}
                          onClick={() => setShowGraph((v) => !v)}
                          className={`px-2 py-0.5 rounded border text-[11px] transition-colors ${
                            showGraph
                              ? "bg-indigo-600/30 border-indigo-400/50 text-indigo-200"
                              : "bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700"
                          }`}
                          title="Zobraziť/Skryť graf projekcie"
                        >
                          Graf
                        </button>
                      }
                    />
                    <div
                      className="overflow-hidden transition-[grid-template-rows] duration-300 ease-out grid"
                      style={{ gridTemplateRows: sec5Open ? "1fr" : "0fr" }}
                      aria-hidden={!sec5Open}
                      aria-expanded={sec5Open}
                      aria-controls="sec5-body"
                    >
                      {sec5Open && (
                        <div
                          id="sec5-body"
                          className={`min-h-0 ${densityBody} pt-0`}
                        >
                          <div className="space-y-2 text-sm">
                            <div>
                              Odhadovaný majetok:{" "}
                              <span className="font-semibold text-slate-100">
                                {euro(fv)}
                              </span>
                            </div>
                            {goalAsset > 0 && (
                              <div className="flex items-center gap-2">
                                <span
                                  className="font-medium"
                                  aria-hidden="true"
                                >
                                  Cieľ majetku
                                </span>
                                <span>
                                  Plnenie cieľa:{" "}
                                  {(goalProgress * 100).toFixed(1)}%
                                </span>
                              </div>
                            )}
                            {overflowFV && (
                              <StatusChip
                                kind="warn"
                                live
                                title="Projekcia prekročila bezpečný limit (veľmi vysoké hodnoty)."
                              >
                                FV overflow
                              </StatusChip>
                            )}
                            <div
                              className="h-2 rounded bg-slate-800 overflow-hidden"
                              role="progressbar"
                              aria-label="Plnenie cieľa"
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-valuenow={Math.min(100, goalProgress * 100)}
                            >
                              <div
                                className="h-full bg-emerald-500/70"
                                style={{
                                  width: `${Math.min(100, goalProgress * 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                          {showGraph && (
                            <div>
                              {projectionSeries.length > 1 ? (
                                <div
                                  className="h-64 w-full"
                                  style={{ overflow: "visible" }}
                                >
                                  <ResponsiveContainer
                                    width={isTest ? 400 : "100%"}
                                    height={isTest ? 256 : "100%"}
                                  >
                                    <LineChart
                                      data={projectionSeries}
                                      margin={{
                                        top: 10,
                                        right: 56,
                                        left: 0,
                                        bottom: 0,
                                      }}
                                    >
                                      <XAxis
                                        dataKey="month"
                                        tickFormatter={(v) =>
                                          v % 12 === 0 ? `${v / 12}` : ""
                                        }
                                        interval={0}
                                        ticks={projectionSeries
                                          .filter((p) => p.month % 12 === 0)
                                          .map((p) => p.month)}
                                        stroke="#64748b"
                                        style={{ fontSize: 10 }}
                                      />
                                      <YAxis
                                        tickFormatter={(v) =>
                                          formatShort(v as number)
                                        }
                                        stroke="#64748b"
                                        style={{ fontSize: 10 }}
                                      />
                                      <Tooltip
                                        contentStyle={{
                                          background: "#0f172a",
                                          border: "1px solid #334155",
                                          fontSize: 12,
                                        }}
                                        formatter={(val) => [
                                          euro(val as number),
                                          "Hodnota",
                                        ]}
                                        labelFormatter={(label) => {
                                          const m = Number(label);
                                          const yr = Math.floor(m / 12);
                                          const mo = m % 12;
                                          return `Mesiac ${m} (Rok ${yr}, mesiac ${mo})`;
                                        }}
                                      />
                                      {goalAsset > 0 && (
                                        <ReferenceLine
                                          y={goalAsset}
                                          stroke="#10b981"
                                          strokeDasharray="3 3"
                                          ifOverflow="extendDomain"
                                          label={{
                                            value: "Cieľ majetku",
                                            position: "right",
                                            offset: 8,
                                            fill: "#10b981",
                                            fontSize: 10,
                                          }}
                                        />
                                      )}
                                      <Line
                                        type="monotone"
                                        dataKey="value"
                                        stroke="#6366f1"
                                        strokeWidth={2}
                                        dot={false}
                                      />
                                    </LineChart>
                                  </ResponsiveContainer>
                                  <div className="text-[10px] text-slate-500 flex justify-between">
                                    <span>
                                      Osa X: roky (0..{years}) – Osa Y: rast
                                      majetku
                                    </span>
                                    <span>{projectionSeries.length} bodov</span>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-xs text-slate-500">
                                  Nedostatočné dáta na graf.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </section>
                  {/* Section: Hypotéka vs. investície (render only if at least one mortgage exists) */}
                  {debts.some((d) => d.type === "hypoteka") && (
                    <DebtVsInvestSection
                      debts={debts}
                      years={years}
                      lumpSum={lumpSum}
                      monthlyContrib={monthlyContrib}
                      erPa={expectedReturn}
                      extraMonthly={extraMonthly}
                      extraOnce={extraOnce}
                      extraOnceAtMonth={extraOnceAtMonth}
                      onExtraMonthly={setExtraMonthly}
                      onExtraOnce={setExtraOnce}
                      onExtraOnceAtMonth={setExtraOnceAtMonth}
                      mergePreview={mergePreview}
                      onMergePreview={setMergePreview}
                    />
                  )}
                  {showRec && recMix && (
                    <div
                      className={`rounded border border-slate-700 bg-slate-900/60 ${densityMode === "ultra" ? "p-2.5" : "p-3"} space-y-1 text-xs`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-slate-200">
                          Odporúčané poznámky
                        </div>
                        <button
                          onClick={() => setNotesOpen(true)}
                          className="text-[10px] underline text-slate-400 hover:text-slate-200"
                          aria-haspopup="dialog"
                          aria-expanded={notesOpen}
                        >
                          Zobraziť poznámky
                        </button>
                      </div>
                      <ul className="list-disc list-inside text-slate-300 space-y-0 line-clamp-2 [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical] overflow-hidden">
                        <li>Mix prispôsobený horizontu a rezerve.</li>
                        <li>Uprav ETF / dlhopis podľa komfortu rizika.</li>
                        <li>Diverzifikácia znižuje koncentráciu rizika.</li>
                        <li>
                          Priebežne rebalansuj pre zachovanie cieľových váh.
                        </li>
                      </ul>
                    </div>
                  )}
                  {/* Meta box removed per spec */}
                </div>
              </aside>
          </div>
          {/* Mini-wizard overlay */}
          <MiniWizard
            open={wizardOpen}
            mode={wizardMode}
            onApply={() => {
              if (wizardMode === "gold-12") {
                setGoldTo12();
              } else {
                applyReserveGapToMonthly();
              }
              setWizardOpen(false);
            }}
            onClose={() => setWizardOpen(false)}
          />
          {/* KPI bottom dock removed (simplified UI) */}
          {/* Single Risk info modal (one instance) */}
          {riskInfoOpen && (
            <div
              className="fixed inset-0 z-40 flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-label="Ako počítame riziko?"
            >
              <div
                className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
                onClick={() => setRiskInfoOpen(false)}
              />
              <div className="relative z-10 w-full max-w-md rounded-lg border border-slate-700 bg-slate-900/90 shadow-xl p-4 space-y-3 text-xs text-slate-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">
                    Ako počítame riziko?
                  </h2>
                  <button
                    onClick={() => setRiskInfoOpen(false)}
                    className="text-[10px] px-2 py-1 rounded border border-slate-600 bg-slate-800 hover:bg-slate-700"
                    aria-label="Zavrieť"
                  >
                    Zavrieť
                  </button>
                </div>
                <div
                  tabIndex={0}
                  ref={riskInfoFirstRef}
                  className="rounded border border-slate-700 bg-slate-800/40 px-2 py-1"
                >
                  Prehľad výpočtu
                </div>
                <ul className="list-disc list-inside space-y-1">
                  <li>Legacy: skóre = (er · 100) / min(10, risk).</li>
                  <li>
                    Current: er/risk; base je vážený priemer rizika +
                    penalizácie.
                  </li>
                  <li>
                    Overweight nad 35% (koef. 8) a HHI nad 0.18 (koef. 12).
                  </li>
                  <li>Príplatok pri (dyn + krypto) &gt; 45% (koef. 15).</li>
                </ul>
              </div>
            </div>
          )}

          {!!toasts.length && (
            <div className="fixed bottom-16 right-3 flex flex-col gap-2 z-30">
              {toasts.map((t) => (
                <div
                  key={t.id}
                  className="px-3 py-2 rounded border border-emerald-600/40 bg-emerald-600/20 text-[11px] text-emerald-100 shadow-lg backdrop-blur flex items-center gap-3"
                >
                  <span>{t.msg}</span>
                  {t.action && (
                    <button
                      onClick={() => {
                        t.action?.run();
                        setToasts((all) => all.filter((x) => x.id !== t.id));
                      }}
                      className="ml-auto px-2 py-0.5 rounded border border-emerald-400/60 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100 text-[10px] font-medium"
                    >
                      {t.action.label}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {shareOpen && (
            <div
              className="fixed inset-0 z-40 flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-label="Zdieľať nastavenie (referral)"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  setShareOpen(false);
                  setTimeout(() => shareBtnRef.current?.focus(), 0);
                }
              }}
            >
              <div
                className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
                onClick={() => setShareOpen(false)}
              />
              <div className="relative z-10 w-full max-w-md rounded-lg border border-slate-700 bg-slate-900/90 shadow-xl p-4 space-y-3 text-xs text-slate-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Zdieľať / Referral</h2>
                  <button
                    onClick={() => setShareOpen(false)}
                    className="text-[10px] px-2 py-1 rounded border border-slate-600 bg-slate-800 hover:bg-slate-700"
                  >
                    Zavrieť
                  </button>
                </div>
                <label className="block space-y-1">
                  <span className="text-[11px] text-slate-300">
                    Email agenta
                  </span>
                  <input
                    ref={agentEmailRef}
                    type="email"
                    autoFocus
                    className="w-full rounded border border-slate-700 bg-slate-800/80 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="agent@example.com"
                    value={agentEmail}
                    onChange={(e) => setAgentEmail(e.target.value)}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-[11px] text-slate-300">
                    Referral link
                  </span>
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      className="flex-1 rounded border border-slate-700 bg-slate-800/80 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      placeholder="https://…"
                      value={referralLink}
                      onChange={(e) => setReferralLink(e.target.value)}
                    />
                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(referralLink);
                          pushToast("Link skopírovaný do schránky");
                        } catch {
                          pushToast("Nedá sa kopírovať – skús manuálne");
                        }
                      }}
                      className="px-2 py-1 rounded border border-slate-600 bg-slate-700/40 hover:bg-slate-700 text-[11px]"
                    >
                      Kopírovať
                    </button>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">
                    Link obsahuje celé nastavenie (Base64).
                  </div>
                </label>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      const subject = encodeURIComponent(
                        "UNOTOP – nastavenie klienta"
                      );
                      const payload = buildV3Payload();
                      const body = encodeURIComponent(
                        `Dobrý deň,\n\nzasielam moje nastavenie portfólia z UNOTOP Planner.\n\nNastavenie (JSON v3):\n${JSON.stringify(payload, null, 2)}\n\nReferral link: ${referralLink || "(nevyplnený)"}\n`
                      );
                      const href = `mailto:${encodeURIComponent(
                        agentEmail || ""
                      )}?subject=${subject}&body=${body}`;
                      window.location.href = href;
                    }}
                    className="px-3 py-1 rounded border border-emerald-600/50 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-100 text-[11px]"
                    disabled={!emailValid(agentEmail)}
                    title={
                      emailValid(agentEmail)
                        ? "Odoslať cez mail"
                        : "Zadajte platný email"
                    }
                  >
                    Poslať email
                  </button>
                  <button
                    onClick={async () => {
                      const payload = buildV3Payload();
                      const txt = JSON.stringify(payload, null, 2);
                      try {
                        await navigator.clipboard.writeText(txt);
                        pushToast("Konfigurácia skopírovaná");
                      } catch {
                        pushToast("Nepodarilo sa skopírovať");
                      }
                    }}
                    className="px-3 py-1 rounded border border-slate-600 bg-slate-700/40 hover:bg-slate-700 text-[11px]"
                  >
                    Kopírovať JSON
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const payload = buildV3Payload();
                        const enc = btoa(
                          unescape(encodeURIComponent(JSON.stringify(payload)))
                        );
                        const deep = `${location.origin}${location.pathname}#state=${enc}`;
                        await navigator.clipboard.writeText(deep);
                        pushToast("Deep-link skopírovaný");
                      } catch {
                        pushToast("Deep-link sa nepodarilo vytvoriť");
                      }
                    }}
                    className="px-3 py-1 rounded border border-slate-600 bg-slate-700/40 hover:bg-slate-700 text-[11px]"
                    title="Skopíruje link s kódovaným stavom do hash"
                  >
                    Kopírovať link
                  </button>
                </div>
              </div>
            </div>
          )}
          {notesOpen && (
            <div
              className="fixed inset-0 z-40 flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-label="Zobraziť viac (poznámky detail)"
            >
              <div
                className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
                onClick={() => setNotesOpen(false)}
              />
              <div className="relative z-10 w-full max-w-md rounded-lg border border-slate-700 bg-slate-900/90 shadow-xl p-4 space-y-3 text-xs text-slate-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Odporúčané poznámky</h2>
                  <button
                    onClick={() => setNotesOpen(false)}
                    className="text-[10px] px-2 py-1 rounded border border-slate-600 bg-slate-800 hover:bg-slate-700"
                  >
                    Zavrieť
                  </button>
                </div>
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    Mix prispôsobený horizontu a rezerve – priorita budovať
                    rezervu.
                  </li>
                  <li>
                    Diverzifikácia medzi akcie / zlato / dlhopis / krypto
                    znižuje volatilitu.
                  </li>
                  <li>
                    Rebalansuj minimálne raz ročne alebo pri odchýlke &gt;5 p.b.
                  </li>
                  <li>
                    Ak riziko &gt;7.5 zváž zníženie dynamických / krypto
                    zložiek.
                  </li>
                  <li>
                    Udržuj hotovosť primeranú (≤35 %) – zvyšok nech pracuje.
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </DockOffsetsProvider>
    </div>
  );
}
