import React from "react";

// ČISTÝ PLACEHOLDER (PR-RECOVER-01)
// Tento súbor je úmyselne minimálny. Runtime používa RootApp.tsx.
// NIČ ĎALŠIE POD EXPORTOM – ak sa objaví legacy tail, treba znovu prepísať.
const App: React.FC = () => {
  return (
    <main
      role="main"
      className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center"
      aria-label="UNO Recovery Placeholder"
    >
      <section className="p-6 rounded-xl bg-slate-900 ring-1 ring-white/10 space-y-4 text-center max-w-sm">
        <h1 className="text-lg font-semibold">UNO Recovery</h1>
        <p className="text-sm text-slate-400">
          App.tsx je vyčistený. Ďalšia logika presunutá do LegacyApp.tsx.
        </p>
        <p className="text-xs text-slate-500" aria-live="polite">
          Baseline ✓
        </p>
      </section>
    </main>
  );
};

export default App;
