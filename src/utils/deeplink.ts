// Deep-link hash consumer: parses #state=... Base64 JSON and clears the hash immediately
export function consumeStateFromHash(): any | null {
  try {
    const raw = String(window.location.hash || "").replace(/^#/, "");
    const m = raw.match(/^state=(.+)$/);
    if (!m) return null;

    const clear = () => {
      try {
        history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search
        );
      } catch {}
      try {
        (window as any).location && ((window as any).location.hash = "");
      } catch {}
    };

    const payloadEncoded = m[1];
    let json = "";
    try {
      // Try URL-decoding first in case of url-safe base64
      const decoded = atob(decodeURIComponent(payloadEncoded));
      if (typeof TextDecoder !== "undefined") {
        const bytes = Uint8Array.from(decoded, (c) => c.charCodeAt(0));
        json = new TextDecoder().decode(bytes);
      } else {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        json = decodeURIComponent(escape(decoded));
      }
    } catch {
      // Fallback to plain atob
      const decoded = atob(payloadEncoded);
      if (typeof TextDecoder !== "undefined") {
        const bytes = Uint8Array.from(decoded, (c) => c.charCodeAt(0));
        json = new TextDecoder().decode(bytes);
      } else {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        json = decodeURIComponent(escape(decoded));
      }
    }
    const state = JSON.parse(json);
    clear(); // Clear hash immediately after successful parse
    return state;
  } catch {
    try {
      history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search
      );
    } catch {}
    try {
      (window as any).location && ((window as any).location.hash = "");
    } catch {}
    return null;
  }
}
