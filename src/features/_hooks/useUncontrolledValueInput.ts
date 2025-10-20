import * as React from 'react';

export type Options = {
  initial: number | string;
  debounce?: number; // default 120
  parse: (raw: string) => number; // parse raw string to number (may replace commas etc.)
  clamp?: (n: number) => number; // optional clamp
  format?: (n: number) => string; // default String
  commit: (n: number) => void; // side-effect: setState + writeV3
};

export function useUncontrolledValueInput(opts: Options) {
  const ref = React.useRef<HTMLInputElement | null>(null);
  const rawRef = React.useRef<string>(String(opts.initial));
  const t = React.useRef<number | undefined>(undefined);
  const debounce = opts.debounce ?? 120;

  function flush() {
    const n = opts.parse(rawRef.current);
    const v = Number.isFinite(n) ? (opts.clamp ? opts.clamp(n) : n) : 0;
    opts.commit(v);
    if (ref.current) ref.current.value = opts.format ? opts.format(v) : String(v);
  }

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    rawRef.current = e.target.value;
    if (t.current) window.clearTimeout(t.current);
    t.current = window.setTimeout(flush, debounce);
  }
  function onBlur() {
    if (t.current) window.clearTimeout(t.current);
    flush();
  }

  function syncToDom(v: number) {
    rawRef.current = String(v);
    if (ref.current) ref.current.value = opts.format ? opts.format(v) : String(v);
  }

  React.useEffect(() => () => {
    if (t.current) window.clearTimeout(t.current);
    flush();
  }, []); // flush unmount

  return { ref, onChange, onBlur, defaultValue: String(opts.initial), syncToDom };
}
