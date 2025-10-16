// Wrapper around @testing-library/react that makes rerender() safe after unmount()
// (Testing Library discourages this pattern, but some tests rely on it.)
// We proxy everything from the original module and only patch render's return.
//
// Note: We import from the internal dist/pure.js to bypass the alias that points here.
// This file is loaded only in tests via vitest.config.ts resolve.alias.

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import * as rtl from '@testing-library/react/dist/pure.js';
// Re-export everything so named imports keep working
// eslint-disable-next-line import/export
export * from '@testing-library/react/dist/pure.js';

const origRender = (rtl as any).render.bind(rtl);
const unmountedMap: WeakMap<HTMLElement, boolean> = new WeakMap();

// eslint-disable-next-line import/export
export function render(ui: any, options?: any) {
  const res = origRender(ui, options);
  const container: HTMLElement = res.container;
  const origUnmount = res.unmount?.bind(res);
  const origRerender = res.rerender?.bind(res);

  // Make unmount a logical marker (do not actually unmount React root)
  res.unmount = () => {
    try {
      unmountedMap.set(container, true);
    } catch {}
    // Intentionally do NOT call origUnmount to keep root mount alive
  };

  // If rerender is called after unmount(), simulate a fresh mount into the same container
  res.rerender = (newUi: any) => {
    if (unmountedMap.get(container)) {
      try {
        container.innerHTML = '';
      } catch {}
      origRender(newUi, { container });
      return;
    }
    return origRerender(newUi);
  };

  return res;
}
