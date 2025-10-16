import { screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import userEvent from "@testing-library/user-event";
import { renderAppWithLocalStorage, delay } from "../test/testUtils";

// Testy pre invarianty a limiter po refaktore (manuálne spúšťanie)

describe("Mix invariants & limiter", () => {
  beforeEach(() => localStorage.clear());

  it("zobrazí chip limit 22% po manuálnom spustení keď dyn+krypto > 22%", async () => {
    renderAppWithLocalStorage({
      v2: {
        mix: {
          "Zlato (fyzické)": 10,
          "Dynamické riadenie": 20,
          "Krypto (BTC/ETH)": 15,
          "Hotovosť/rezerva": 55,
        },
      },
    });
    // Po load-e baseline pipeline síce prebehne, ale chceme overiť explicitne tlačidlom (idempotentné)
    // Pre istotu krátka defer kvôli baseline setTimeout
    await delay(5);
    const applyBtn = await screen.findByRole("button", {
      name: /Upraviť podľa pravidiel/i,
    });
    await userEvent.click(applyBtn);
    const chip = await screen.findByText(/limit 22%/i);
    expect(chip).toBeInTheDocument();
  });

  it("dorovnať tlačidlo aktivované pri súčte != 100 a po kliknutí zobrazí toast", async () => {
    renderAppWithLocalStorage({
      v2: {
        mix: {
          "Zlato (fyzické)": 5,
          "Dynamické riadenie": 5,
          "Krypto (BTC/ETH)": 5,
        },
      },
    });
    const btn = await screen.findByRole("button", { name: /Dorovnať/i });
    expect(btn).not.toBeDisabled();
    await userEvent.click(btn);
    // toast text (môže byť "Portfólio bolo upravené..." alebo "Súčet upravený – žiadne ďalšie zmeny.")
    const toast = await screen.findByText(/Súčet|Portfólio bolo upravené/i);
    expect(toast).toBeInTheDocument();
  });

  it("resetuje mix na baseline po zmene a kliknutí na Resetovať hodnoty", async () => {
    renderAppWithLocalStorage({
      v2: {
        mix: {
          "Zlato (fyzické)": 10,
          "Dynamické riadenie": 10,
          "Krypto (BTC/ETH)": 10,
          "Hotovosť/rezerva": 70,
        },
      },
    });
    await delay(5); // baseline capture
    const goldInput = await screen.findByLabelText(/Zlato/);
    // zvýš hodnotu zlata cez input (simulácia priamej zmeny - userEvent.type doplní čísla)
    await userEvent.clear(goldInput);
    await userEvent.type(goldInput, "25");
    // trigger blur to commit value (capped logic still applies)
    (goldInput as HTMLInputElement).blur();
    // klik reset
    const resetBtn = await screen.findByRole("button", {
      name: /Resetovať hodnoty/i,
    });
    await userEvent.click(resetBtn);
    // očakávaj, že zlato sa vráti na baseline (10)
    expect((goldInput as HTMLInputElement).value).toMatch(/^10/);
  });
});
