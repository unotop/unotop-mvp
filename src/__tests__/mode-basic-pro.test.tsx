import { screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import {
  renderAppWithLocalStorage,
  delay,
  numericValue,
} from "../test/testUtils";

// Skeleton – doplniť detailné asercie (value / toast obsah) po stabilizácii.

describe("BASIC / PRO režim", () => {
  beforeEach(() => localStorage.clear());

  it("zobrazí toast pri overshoot v BASIC a CTA zachová hodnotu po prepnutí", async () => {
    renderAppWithLocalStorage();
    const lumpField = await screen.findByLabelText(/Jednorazová investícia/i);
    await userEvent.clear(lumpField);
    await userEvent.type(lumpField, "400000");
    // očakávaj overshoot toast s presným textom a CTA
    const toast = await screen.findByText(
      /Hodnota presahuje limit BASIC\. Prepnite na PRO alebo znížte vstup\./i
    );
    expect(toast).toBeInTheDocument();
    const cta = await screen.findByRole("button", { name: /Prepnúť na PRO/i });
    await userEvent.click(cta);
    // po prepnuti na PRO hodnota ostava zachovaná
    expect(numericValue(lumpField)).toBe(400000);
  });

  it("clampne hodnoty po prepnutí z PRO na BASIC", async () => {
    // Seed priamo v3 s PRO mód
    renderAppWithLocalStorage({ v3: { version: 3, uiMode: "pro" } });
    // nastav mesačný vklad výrazne nad BASIC limit
    const monthly = await screen.findByLabelText(/Mesačný vklad/i);
    await userEvent.clear(monthly);
    await userEvent.type(monthly, "12000");
    // prepnúť do BASIC
    const modeBtn = await screen.findByRole("button", { name: /Režim:/i });
    await userEvent.click(modeBtn); // PRO -> BASIC
    // očakávaj clamp toast
    const clampToast = await screen.findByText(
      /Hodnota bola prispôsobená limitu BASIC\./i
    );
    expect(clampToast).toBeInTheDocument();
    // pole je zoseknuté na BASIC max (5000)
    expect(numericValue(monthly)).toBe(5000);
    // sanity: ostatné polia sa nezmenili bez dôvodu (napr. horizon default zostáva v rozsahu)
    const horizon = await screen.findByLabelText(/Horizont \(roky\)/i);
    expect(numericValue(horizon)).toBeGreaterThan(0);
  });

  it("BASIC clamp scénar s persistenciou: clampne po prepnutí a ostáva uložené", async () => {
    // nastav nad limit v PRO a prepnúť do BASIC, over toast, clamp a persist v localStorage
    renderAppWithLocalStorage({ v3: { version: 3, uiMode: "pro" } });
    const monthly = await screen.findByLabelText(/Mesačný vklad/i);
    await userEvent.clear(monthly);
    await userEvent.type(monthly, "15000");
    const modeBtn = await screen.findByRole("button", { name: /Režim:/i });
    await userEvent.click(modeBtn); // PRO -> BASIC
    const clampToast = await screen.findByText(
      /Hodnota bola prispôsobená limitu BASIC\./i
    );
    expect(clampToast).toBeInTheDocument();
    expect(numericValue(monthly)).toBe(5000);
    // persist: v3 by mal obsahovať monthlyContrib = 5000
    const saved = JSON.parse(localStorage.getItem("unotop:v3") || "null");
    expect(saved).toBeTruthy();
    expect(saved.monthlyContrib).toBe(5000);
  });
});
