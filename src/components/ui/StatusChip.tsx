import React from "react";

type StatusKind = "ok" | "warn" | "error" | "info";
const KIND: Record<StatusKind, string> = {
  ok: "bg-emerald-600/20 text-emerald-300 border-emerald-500/40",
  warn: "bg-amber-600/20 text-amber-300 border-amber-500/40",
  error: "bg-rose-600/20 text-rose-300 border-rose-500/40",
  info: "bg-slate-600/20 text-slate-300 border-slate-500/40",
};

export interface StatusChipProps {
  kind: StatusKind;
  children: React.ReactNode;
  title?: string;
  live?: boolean;
  className?: string;
}

export const StatusChip: React.FC<StatusChipProps> = ({
  kind,
  children,
  title,
  live,
  className = "",
}) => {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-medium select-none whitespace-nowrap ${KIND[kind]} ${className}`}
      title={title}
      aria-live={live ? "polite" : undefined}
      role={live ? "status" : undefined}
    >
      {children}
    </span>
  );
};
