import { describe, it, expect, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  renderAppWithLocalStorage,
  delay,
  numericValue,
} from "../test/testUtils";

// BASIC/PRO behavior tests (overshoot CTA + clamp on switch back)

describe("BASIC/PRO behavior", () => {
  beforeEach(() => localStorage.clear());

  it("zobrazi overshoot toast s CTA pri prekroceni limitu v BASIC a zachova hodnotu po prepnuti na PRO", async () => {
    renderAppWithLocalStorage();
    const income = await screen.findByLabelText(/Mesačný príjem/i);
    await userEvent.clear(income);
    await userEvent.type(income, "15000"); // nad BASIC max 10k
    // toast by mal mať akciu Prepnúť na PRO
    const cta = await screen.findByRole("button", { name: /Prepnúť na PRO/i });
    expect(cta).toBeInTheDocument();
    await userEvent.click(cta);
    // po akcii má režim byť PRO a hodnota zostať 15000
    expect(income).toHaveValue("15000");
  });

  it("clampne hodnoty po prepnutí z PRO naspäť do BASIC", async () => {
    // Najprv ulož app state ako PRO s vysokou hodnotou
    renderAppWithLocalStorage({
      v3: { version: 3, uiMode: "pro", monthlyIncome: 20000 },
    });
    // Po načítaní prepni na BASIC
    const modeToggle = await screen.findByRole("button", { name: /Režim:/i });
    await userEvent.click(modeToggle); // PRO -> BASIC
    const income = await screen.findByLabelText(/Mesačný príjem/i);
    // BASIC limit 10k
    expect(numericValue(income)).toBe(10000);
  });
});
