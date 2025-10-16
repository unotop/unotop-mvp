import React, { useEffect } from "react";

/**
 * Measures the actual heights of the top toolbar (#app-toolbar) and the bottom dock (#kpi-dock)
 * and writes them to CSS variables:
 *  - --page-top: toolbar height in px
 *  - --dock-h:  bottom dock height in px
 *
 * This keeps sticky offsets and max-heights perfectly aligned at any zoom/DPI.
 */
export function DockOffsetsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const topEl = document.getElementById("app-toolbar");
    const bottomEl = document.getElementById("kpi-dock");

    const setVars = () => {
      const top = topEl?.offsetHeight ?? 0;
      const bottom = bottomEl?.offsetHeight ?? 0;
      document.documentElement.style.setProperty("--page-top", `${top}px`);
      document.documentElement.style.setProperty("--toolbar-h", `${top}px`);
      document.documentElement.style.setProperty("--dock-h", `${bottom}px`);
    };

    let ro: ResizeObserver | null = null;
    if (typeof (window as any).ResizeObserver !== "undefined") {
      ro = new (window as any).ResizeObserver(setVars);
      if (ro) {
        if (topEl) ro.observe(topEl);
        if (bottomEl) ro.observe(bottomEl);
      }
    }

    // Initial write
    setVars();

    return () => {
      try {
        ro?.disconnect();
      } catch {}
    };
  }, []);

  return <>{children}</>;
}
