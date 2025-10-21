// CRITICAL ISSUE #1: Gauge meter nereaguje na zmeny v mixe
// FILE: src/LegacyApp.tsx (lines ~1374-1430)
// PROBLEM: sec5 číta mix z readV3() v closure - neznovurenderuje sa

// ❌ CURRENT CODE (BROKEN):
{open5 &&
  (() => {
    const v3Data = readV3(); // Toto sa volá len raz pri mount
    const mix: MixItem[] = (v3Data.mix as any) || [];
    const currentRiskPref = riskPref;
    const cap = getRiskCap(currentRiskPref);

    return (
      <section id="sec5" ...>
        <RiskGauge value={riskScore(mix)} size="lg" /> {/* ❌ mix je stale */}
        <div>Riziko: {riskScore(mix).toFixed(1)} / {cap.toFixed(1)}</div>
      </section>
    );
  })()}

// ✅ RECOMMENDED FIX (Option 1 - Add state):
// Add state to track mix changes
const [mixState, setMixState] = React.useState<MixItem[]>(() => {
  const v3Data = readV3();
  return (v3Data.mix as any) || [];
});

// Add effect to sync with localStorage
React.useEffect(() => {
  const interval = setInterval(() => {
    const v3Data = readV3();
    const newMix = (v3Data.mix as any) || [];
    if (JSON.stringify(newMix) !== JSON.stringify(mixState)) {
      setMixState(newMix);
    }
  }, 500); // Check every 500ms
  return () => clearInterval(interval);
}, [mixState]);

// Then use mixState in render:
{open5 && (
  <section id="sec5" ...>
    <RiskGauge value={riskScore(mixState)} size="lg" />
    <div>Riziko: {riskScore(mixState).toFixed(1)} / {cap.toFixed(1)}</div>
  </section>
)}

// ✅ RECOMMENDED FIX (Option 2 - Extract component):
// Create separate component that subscribes to changes
function MetricsSection({ riskPref }: { riskPref: string }) {
  const [mix, setMix] = React.useState<MixItem[]>([]);
  
  React.useEffect(() => {
    const syncMix = () => {
      const v3Data = readV3();
      setMix((v3Data.mix as any) || []);
    };
    syncMix();
    const interval = setInterval(syncMix, 500);
    return () => clearInterval(interval);
  }, []);

  const cap = getRiskCap(riskPref);
  
  return (
    <section id="sec5" ...>
      <RiskGauge value={riskScore(mix)} size="lg" />
      <div>Riziko: {riskScore(mix).toFixed(1)} / {cap.toFixed(1)}</div>
    </section>
  );
}

// Usage in LegacyApp:
{open5 && <MetricsSection riskPref={riskPref} />}

// ✅ RECOMMENDED FIX (Option 3 - Event emitter pattern):
// Add custom event when MixPanel saves
// In MixPanel.tsx after writeV3({ mix: ... }):
window.dispatchEvent(new CustomEvent('mixUpdated', { detail: { mix } }));

// In LegacyApp.tsx:
React.useEffect(() => {
  const handleMixUpdate = (e: CustomEvent) => {
    // Force rerender or update state
    setMixVersion(prev => prev + 1);
  };
  window.addEventListener('mixUpdated', handleMixUpdate as any);
  return () => window.removeEventListener('mixUpdated', handleMixUpdate as any);
}, []);

// ========================================

// ISSUE #2: Projekcia nemá graf (len CSS bar)
// FILE: src/LegacyApp.tsx (lines ~1537-1700)
// CURRENT: Len CSS progress bar
// NEEDED: Recharts LineChart s FV progression

// ✅ RECOMMENDED IMPLEMENTATION:
// Generate chart data (year by year FV)
function generateProjectionData(
  lumpSum: number,
  monthly: number,
  years: number,
  annualRate: number
): Array<{ year: number; fv: number; principal: number; gains: number }> {
  const data = [];
  for (let y = 0; y <= years; y++) {
    const fvLump = lumpSum * Math.pow(1 + annualRate, y);
    const fvMonthly = monthly * 12 * ((Math.pow(1 + annualRate, y) - 1) / annualRate);
    const fv = fvLump + fvMonthly;
    const principal = lumpSum + monthly * 12 * y;
    const gains = fv - principal;
    data.push({ year: y, fv: Math.round(fv), principal: Math.round(principal), gains: Math.round(gains) });
  }
  return data;
}

// Render Recharts:
{(() => {
  const lump = lumpSumEur || 0;
  const monthly = monthlyVklad || 0;
  const years = horizonYears || 10;
  const rate = approxYieldAnnualFromMix(mixState) / 100;
  const chartData = generateProjectionData(lump, monthly, years, rate);
  const goal = goalAssetsEur || 0;

  return (
    <div className="w-full h-64">
      <LineChart width={500} height={250} data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey="year" stroke="#94a3b8" label={{ value: 'Rok', position: 'bottom' }} />
        <YAxis stroke="#94a3b8" label={{ value: '€', angle: -90, position: 'left' }} />
        <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155' }} />
        <Legend />
        <Line type="monotone" dataKey="principal" stroke="#facc15" name="Vklady" strokeWidth={2} />
        <Line type="monotone" dataKey="gains" stroke="#10b981" name="Zisk" strokeWidth={2} />
        <Line type="monotone" dataKey="fv" stroke="#3b82f6" name="Celkom (FV)" strokeWidth={3} />
        {goal > 0 && <ReferenceLine y={goal} stroke="#ef4444" strokeDasharray="5 5" label="Cieľ" />}
      </LineChart>
    </div>
  );
})()}

// ========================================

// ISSUE #3: MixPanel nemá ikonky
// FILE: src/features/mix/MixPanel.tsx (lines ~260-500)
// CURRENT: Len emoji v labeloch
// NEEDED: Konzistentné SVG/emoji ikonky pre každý asset

// ✅ RECOMMENDED ICONS:
const ASSET_ICONS = {
  gold: '🪙', // Fyzické zlato coin
  dyn: '📊',  // Graf s trendami
  etf: '🌍',  // Globe/world
  bonds: '🏦', // Bank/stability
  cash: '💵', // Dollar bills
  crypto: '₿', // Bitcoin symbol
  real: '🏠', // House
  other: '📦'  // Package/other
};

// Usage v MixPanel.tsx:
<label className="flex items-center gap-3">
  <span className="text-2xl" aria-hidden="true">{ASSET_ICONS.gold}</span>
  <span className="text-sm font-medium">Zlato (fyzické)</span>
  <span className="ml-auto tabular-nums text-xs">{Math.round(goldPct)}%</span>
</label>

// Alebo pre SVG ikony (lepšie pre styling):
const GoldIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-yellow-500">
    <circle cx="12" cy="12" r="10" />
    <text x="12" y="16" textAnchor="middle" fontSize="12" fill="#1e293b">€</text>
  </svg>
);

// ========================================

// ISSUE #4: Investičné nastavenia nudné
// FILE: src/LegacyApp.tsx (lines ~690-780)
// CURRENT: Plain textboxy v grid
// IMPROVEMENT IDEAS:

// Add icons + tooltips:
const INVEST_FIELDS = [
  { 
    id: 'lump-sum', 
    label: 'Jednorazová investícia', 
    icon: '💰',
    tooltip: 'Suma, ktorú investujete naraz (napr. 5000 €)',
    placeholder: '0 €'
  },
  { 
    id: 'monthly-vklad', 
    label: 'Mesačný vklad', 
    icon: '📅',
    tooltip: 'Pravidelný mesačný príspevok (napr. 200 €)',
    placeholder: '0 €'
  },
  { 
    id: 'horizon', 
    label: 'Investičný horizont', 
    icon: '⏳',
    tooltip: 'Počet rokov investovania (napr. 20 rokov)',
    placeholder: '0 rokov'
  },
  { 
    id: 'goal', 
    label: 'Cieľ majetku', 
    icon: '🎯',
    tooltip: 'Koľko chcete mať na konci (napr. 100 000 €)',
    placeholder: '0 €'
  }
];

// Render s ikonkami + tooltips:
<div className="space-y-4">
  {INVEST_FIELDS.map(field => (
    <div key={field.id} className="relative">
      <label className="flex items-center gap-2 text-sm font-medium mb-2">
        <span className="text-xl" aria-hidden="true">{field.icon}</span>
        {field.label}
        <button 
          type="button" 
          className="ml-1 text-slate-400 hover:text-slate-300"
          aria-label={`Info: ${field.tooltip}`}
          title={field.tooltip}
        >
          ℹ️
        </button>
      </label>
      <input
        id={field.id}
        type="text"
        placeholder={field.placeholder}
        className="w-full px-4 py-2.5 rounded-lg bg-slate-800 ring-1 ring-white/10 focus:ring-2 focus:ring-emerald-500 transition-all"
        aria-label={field.label}
      />
    </div>
  ))}
</div>

// ========================================

// HELPER: getRiskCap function (used in multiple places)
function getRiskCap(riskPref: string): number {
  switch (riskPref) {
    case 'konzervativny': return 4.0;
    case 'rastovy': return 7.5;
    case 'vyvazeny':
    default: return 6.0;
  }
}

// ========================================

// TEST STRUCTURE (for advisor reference)
// tests/
//   accessibility.ui.test.tsx (9 tests) - A11y regression tests
//   acceptance.mix-cap.ui.test.tsx (3 tests) - Mix constraints UI
//   persist.roundtrip.test.tsx (1 test) - Data persistence
//   persist.debts.v3.test.tsx (1 test) - Debt persistence
//   deeplink.banner.test.tsx (1 test) - URL state sharing
//   invariants.limits.test.tsx (2 tests) - Mix limits validation

// Run tests:
// npm run test:critical  (17/17 PASS required)
// npm run test           (full suite)

// ========================================

// BUILD VALIDATION
// npm run build
// Expected output: ~169 kB gzipped
// No TypeScript errors
// No critical warnings

// ========================================

// KEY IMPORTS (for advisor context)
import { riskScore, normalize, setGoldTarget, applyRiskConstrainedMix, type MixItem } from './features/mix/mix.service';
import { writeV3, readV3, type Debt } from './persist/v3';
import { useUncontrolledValueInput } from './features/_hooks/useUncontrolledValueInput';
import { RiskGauge } from './components/RiskGauge';
import { MixPanel } from './features/mix/MixPanel';
import Toolbar from './components/Toolbar';
import Sidebar from './components/Sidebar';
import PageLayout from './app/PageLayout';

// ========================================

// ARCHITECTURE NOTES
// - LegacyApp.tsx is MONOLITHIC (2278 lines) - needs refactor
// - Persist v3 uses dual keys (colon + underscore) for backward compat
// - Uncontrolled inputs pattern (debounce ~120ms, blur flush)
// - No global state management (Redux/Zustand) - just local React state + localStorage
// - Dark theme only (slate-900/950 palette)
// - Tailwind CSS for styling (no CSS modules)
// - TypeScript strict mode enabled
// - React 19.1.1 (latest)
