import React from "react";

// Sticky layout wrapper – jediný zdroj pravdy pre dvojstĺpcové rozloženie.
// Pravidlá:
// - Pravý panel je sticky cez vnútorný <div className="sticky top-4">.
// - max-h-[calc(100vh-5rem)] = výška obrazovky mínus toolbar (4rem) + spacing (1rem)
// - overflow-y-auto = vlastný scrollbar ak obsah preteká
// - Panely samotné NESMÚ pridávať sticky.
// - Presun panelov rieši len zmena poradia v rodičovských stackoch.
// - Mobile (< lg): pravý panel stack pod ľavý → bežný scroll (max-h sa neaplikuje)

export default function PageLayout({
  left,
  right,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <div
      className="grid grid-cols-12 gap-4 px-4 py-4 max-w-[1320px] mx-auto"
      data-testid="layout-root"
    >
      <main className="col-span-12 lg:col-span-8 space-y-4">{left}</main>
      <aside
        role="complementary"
        aria-label="Prehľad"
        className="col-span-12 lg:col-span-4 space-y-4"
      >
        <div className="sticky top-4 flex flex-col gap-4 max-h-[calc(100vh-5rem)] overflow-y-auto">
          {right}
        </div>
      </aside>
    </div>
  );
}
