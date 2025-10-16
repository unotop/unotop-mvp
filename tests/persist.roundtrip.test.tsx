import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppClean from "../src/App.clean";
import { TEST_IDS } from "../src/constants/testIds";

function getNumberInputByLabel(name: RegExp) {
  const el = screen.getByLabelText(name) as HTMLInputElement;
  if (!el) throw new Error(`Input not found: ${name}`);
  return el;
}

describe("Persistence roundtrip (unotop_v1)", () => {
  it("restores debts, mix and debtVsInvest after remount", async () => {
    const user = userEvent.setup();

    // Start clean
    localStorage.removeItem("unotop_v1");
    localStorage.removeItem("unotop:v3");

    const { unmount, rerender } = render(<AppClean />);

    // Add 5 debts
    const addBtn = await screen.findByLabelText(/Pridať dlh/i);
    for (let i = 0; i < 5; i++) {
      await user.click(addBtn);
    }
    // Fill first debt values
    const inputs = screen.getAllByLabelText(
      /Istina|Úrok p\.a\.|Mesačná splátka|Zostáva \(mesiace\)/i
    ) as HTMLInputElement[];
    // Update across first row
    const [balance, rate, monthly, months] = [
      getNumberInputByLabel(/Istina/i),
      getNumberInputByLabel(/Úrok p\.a\./i),
      getNumberInputByLabel(/Mesačná splátka/i),
      getNumberInputByLabel(/Zostáva.*mesiac/i),
    ];
    await user.clear(balance);
    await user.type(balance, "100000");
    await user.clear(rate);
    await user.type(rate, "3.5");
    await user.clear(monthly);
    await user.type(monthly, "450");
    await user.clear(months);
    await user.type(months, "320");

    // Change mix (ETF=22, Zlato=25, Dyn=15, Dlhopis=20, Krypto=5, Cash=13)
    const setMixVal = async (label: string, val: string) => {
      let inp: HTMLInputElement;
      if (label === "ETF (svet – aktívne)") {
        inp = screen.getByTestId(
          TEST_IDS.ETF_WORLD_ACTIVE_INPUT
        ) as HTMLInputElement;
      } else {
        inp = screen.getByLabelText(label) as HTMLInputElement;
      }
      await user.clear(inp);
      await user.type(inp, val);
    };
    await setMixVal("ETF (svet – aktívne)", "22");
    await setMixVal("Zlato (fyzické)", "25");
    await setMixVal("Dynamické riadenie", "15");
    await setMixVal("Garantovaný dlhopis 7,5% p.a.", "20");
    await setMixVal("Krypto (BTC/ETH)", "5");
    await setMixVal("Hotovosť/rezerva", "13");

    // Fill debt vs invest inputs
    const emi = getNumberInputByLabel(/Mimoriadna splátka mesačne/);
    const once = getNumberInputByLabel(/Jednorazová mimoriadna/);
    const at = getNumberInputByLabel(/Mesiac vykonania/);
    await user.clear(emi);
    await user.type(emi, "300");
    await user.clear(once);
    await user.type(once, "1000");
    await user.clear(at);
    await user.type(at, "5");

    // Wait for debounce (persistence uses 200ms)
    await new Promise((r) => setTimeout(r, 300));

    // Simulate refresh: unmount -> mount new
    unmount();
    const r2 = render(<AppClean />);

    // Debts count restored
    const addBtn2 = await screen.findByLabelText(/Pridať dlh/i);
    // Table rows = debts length; the add button exists always; assert presence of 5 rows by counting delete buttons
    const deleteButtons = screen.getAllByRole("button", { name: /Zmazať/i });
    expect(deleteButtons.length).toBeGreaterThanOrEqual(5);

    // Mix values restored
    expect(
      (screen.getByTestId(TEST_IDS.ETF_WORLD_ACTIVE_INPUT) as HTMLInputElement)
        .value
    ).toBe("22");
    expect(
      (screen.getByLabelText("Zlato (fyzické)") as HTMLInputElement).value
    ).toBe("25");
    expect(
      (screen.getByLabelText("Dynamické riadenie") as HTMLInputElement).value
    ).toBe("15");
    expect(
      (
        screen.getByLabelText(
          "Garantovaný dlhopis 7,5% p.a."
        ) as HTMLInputElement
      ).value
    ).toBe("20");
    expect(
      (screen.getByLabelText("Krypto (BTC/ETH)") as HTMLInputElement).value
    ).toBe("5");
    expect(
      (screen.getByLabelText("Hotovosť/rezerva") as HTMLInputElement).value
    ).toBe("13");

    // DVSI inputs restored
    expect(getNumberInputByLabel(/Mimoriadna splátka mesačne/).value).toBe(
      "300"
    );
    expect(getNumberInputByLabel(/Jednorazová mimoriadna/).value).toBe("1000");
    expect(getNumberInputByLabel(/Mesiac vykonania/).value).toBe("5");

    r2.unmount();
  });
});
