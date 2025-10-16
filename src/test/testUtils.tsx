import React from "react";
import { render } from "@testing-library/react";
import App from "../App";

export function renderAppWithLocalStorage(seed?: {
  v1?: any;
  v2?: any;
  v3?: any;
}) {
  localStorage.clear();
  if (seed?.v1) localStorage.setItem("unotop:v1", JSON.stringify(seed.v1));
  if (seed?.v2) localStorage.setItem("unotop:v2", JSON.stringify(seed.v2));
  if (seed?.v3) localStorage.setItem("unotop:v3", JSON.stringify(seed.v3));
  return render(<App />);
}

export function delay(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

// Pomocná funkcia: z input elementu vytiahne číselnú hodnotu (odstráni medzery / tisícky / %).
export function numericValue(el: HTMLElement): number {
  const raw = (el as HTMLInputElement).value ?? "";
  const cleaned = raw.replace(/[^0-9.,-]/g, "").replace(/,/g, ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}
