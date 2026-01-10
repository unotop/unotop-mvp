import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { vi } from 'vitest';

// Cleanup po každom teste - vyčistí React komponenty aj všetky timery
afterEach(() => {
  cleanup(); // React cleanup
  vi.clearAllTimers(); // Vyčistí všetky setTimeout/setInterval
  vi.clearAllMocks(); // Vyčistí mocky
});

// Mock localStorage for JSDOM (Node.js env)
if (typeof globalThis.localStorage === 'undefined') {
  const store: Record<string, string> = {};
  globalThis.localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); },
    key: (index: number) => Object.keys(store)[index] || null,
    length: 0,
  } as any;
  Object.defineProperty(globalThis.localStorage, 'length', {
    get: () => Object.keys(store).length,
  });
}

// Plain (non-Proxy) clone of window.location so that .reload becomes writable for tests.
try {
  const orig = window.location;
  try { delete (window as any).location; } catch {}
  const clone: any = {
    assign: orig.assign.bind(orig),
    replace: orig.replace.bind(orig),
    reload: orig.reload.bind(orig),
    toString: orig.toString.bind(orig),
    href: orig.href,
    hash: orig.hash,
    host: orig.host,
    hostname: orig.hostname,
    origin: (orig as any).origin ?? '',
    pathname: orig.pathname,
    port: orig.port,
    protocol: orig.protocol,
    search: orig.search,
  };
  Object.defineProperty(window, 'location', { value: clone, writable: true, configurable: true });
  Object.defineProperty(window.location, 'reload', { value: window.location.reload, writable: true, configurable: true });
} catch {}

// React 18 root.unmount noop to reduce noisy warnings
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ReactDOMClient = require('react-dom/client');
  const origCreateRoot = ReactDOMClient.createRoot;
  ReactDOMClient.createRoot = function patchedCreateRoot(container: any, options?: any) {
    const root = origCreateRoot(container, options);
    root.unmount = () => {};
    return root;
  } as any;
} catch {}

// Mock ResizeObserver for Recharts ResponsiveContainer
global.ResizeObserver = class ResizeObserver {
  observe() {
    // Mock implementation
  }
  unobserve() {
    // Mock implementation
  }
  disconnect() {
    // Mock implementation
  }
};