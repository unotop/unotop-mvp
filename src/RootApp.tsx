import React from "react";

// Clean recovery root used temporarily while legacy App.tsx is quarantined.
const RootApp: React.FC = () => (
  <main
    className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center"
    aria-label="UNO recovery root"
  >
    <section className="p-6 rounded-xl bg-slate-900 ring-1 ring-white/10 space-y-4 text-center max-w-sm">
      <h1 className="text-lg font-semibold">UNO Recovery</h1>
      <p className="text-sm text-slate-400">
        Minimal skeleton (RootApp). Legacy App.tsx excluded.
      </p>
      <p className="text-xs text-slate-500" aria-live="polite">
        Stav: baseline pripravený ✓
      </p>
    </section>
  </main>
);

export default RootApp;
