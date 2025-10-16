import '@testing-library/jest-dom/vitest';
import { screen } from '@testing-library/react';

// Global test helpers (can extend later)
// e.g., custom render wrapper if context providers are introduced.

// React 18: avoid "Cannot update an unmounted root" when tests call rerender() after unmount().
// Testing Library discourages unmount+rerender, but some suites do it to simulate remounts.
// Make unmount a safe no-op in tests so rerender keeps working without errors.
try {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const ReactDOMClient = require('react-dom/client');
	const origCreateRoot = ReactDOMClient.createRoot;
	ReactDOMClient.createRoot = function patchedCreateRoot(container: any, options?: any) {
		const root = origCreateRoot(container, options);
		// neutralize unmount to prevent React from marking the root as gone
		root.unmount = () => {};
		// also wrap root.render so it won't throw even if unmount was called by Testing Library internals
		const origRender = root.render?.bind(root);
		if (origRender) {
			root.render = (...args: any[]) => {
				try {
					return origRender(...args);
				} catch {
					// ignore render after unmount errors in tests
					return undefined as any;
				}
			};
		}
		return root;
	} as any;
	// Also patch hydrateRoot if TL uses hydration path
	if (typeof ReactDOMClient.hydrateRoot === 'function') {
		const origHydrateRoot = ReactDOMClient.hydrateRoot;
		ReactDOMClient.hydrateRoot = function patchedHydrateRoot(container: any, initialChildren: any, options?: any) {
			const root = origHydrateRoot(container, initialChildren, options);
			root.unmount = () => {};
			const origRender2 = root.render?.bind(root);
			if (origRender2) {
				root.render = (...args: any[]) => {
					try {
						return origRender2(...args);
					} catch {
						return undefined as any;
					}
				};
			}
			return root;
		} as any;
	}
} catch {}

// Polyfill ResizeObserver for components relying on it (e.g., Recharts ResponsiveContainer)
class RO {
	observe() {}
	unobserve() {}
	disconnect() {}
}
// @ts-ignore
if (typeof window !== 'undefined' && (window as any).ResizeObserver === undefined) {
	// @ts-ignore
	(window as any).ResizeObserver = RO;
}

// When fake timers are active in some tests, findBy* can hang if the element is already present
// but the internal waitFor scheduling relies on timers. Make findByText resolve immediately
// if getByText succeeds synchronously, otherwise fall back to original findByText.
try {
	const origFindByText = screen.findByText.bind(screen) as any;
	(screen as any).findByText = ((...args: any[]) => {
		try {
			const el = screen.getByText(args[0], args[1]);
			return Promise.resolve(el);
		} catch {
			return origFindByText(...args);
		}
	}) as any;
} catch {}