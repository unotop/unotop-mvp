import React from "react";

interface SectionHeaderProps {
  title: string;
  open: boolean;
  onToggle: () => void;
  className?: string;
  id?: string; // optional base id for aria-controls linkage
  actions?: React.ReactNode; // optional right-aligned actions (e.g., 'Graf')
}

// Unified dark section header (32px height) used for collapsible sections 1-4
export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  open,
  onToggle,
  className = "",
  id,
  actions,
}) => {
  // Väzba na telo sekcie: v appke sú panely pomenované `${base}-body`.
  // Ak máme id (napr. "sec1-title" alebo "sec3"), odkážeme na `${base}-body`.
  const contentId = id ? `${id.replace(/-title$/, "")}-body` : undefined;
  // A11y: číslované aria-labely pre testy (vizuál bez čísiel)
  const prefix = (() => {
    switch (id) {
      case "sec0-title":
        return "0) ";
      case "sec1-title":
        return "1) ";
      case "sec2-title":
        return "2) ";
      case "sec3-title":
        return "3) ";
      case "sec4-title":
        return "4) "; // Metriky & odporúčania
      case "sec5-title":
        return "5) "; // Projekcia
      default:
        return "";
    }
  })();
  return (
    <div
      className={
        "w-full h-8 px-3 text-sm bg-slate-900/40 hover:bg-slate-900/50 text-slate-200 border border-slate-800 rounded-md flex items-center justify-between transition-colors select-none " +
        className
      }
    >
      <button
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
            e.preventDefault();
            onToggle();
          }
        }}
        className="flex items-center gap-2 min-w-0 p-0 bg-transparent text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:ring-offset-2 focus:ring-offset-slate-950 rounded"
        aria-expanded={open}
        aria-controls={contentId}
        aria-label={`${prefix}${title}: ${open ? "zbalit" : "rozbalit"}`}
        id={id}
        type="button"
      >
        <span className="font-medium text-slate-200 truncate">{title}</span>
        <span
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 inline-flex items-center justify-center ${
            open ? "rotate-90" : "rotate-0"
          }`}
          aria-hidden="true"
        >
          ›
        </span>
      </button>
      {actions && (
        <div className="ml-2 flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
};
