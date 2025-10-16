import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppClean from "../src/App.clean";

describe("MiniWizard – gold 12% action", () => {
  it("opens from insight, applies 12% and pulses range", async () => {
    const user = userEvent.setup();
    render(<AppClean />);

    // Lower gold below policy to surface the insight (use number input for reliable typing)
    const goldNumber = await screen.findByTestId("input-gold-number");
    console.debug("[TestTrace] clearing gold number");
    await user.clear(goldNumber as HTMLInputElement);
    console.debug("[TestTrace] typing gold=5");
    await user.type(goldNumber as HTMLInputElement, "5");

    // Insight list appears; click the gold-related one
    const insights = await screen.findByLabelText(/Insights/i);
    const allButtons = within(insights).getAllByRole("button");
    console.debug("[TestTrace] insight buttons count=", allButtons.length);
    const goldInsightBtn = allButtons.find((b) =>
      /Gold 12/i.test(b.textContent || "")
    );
    console.debug(
      "[TestTrace] goldInsightBtn found=",
      !!goldInsightBtn,
      goldInsightBtn?.textContent
    );
    expect(goldInsightBtn).toBeTruthy();
    await user.click(goldInsightBtn!);

    // Wizard visible
    const dialog = await screen.findByTestId("mini-wizard-dialog");
    expect(dialog).toHaveAttribute("data-open", "1");

    // Apply
    const applyBtn = within(dialog).getByRole("button", {
      name: /Použiť odporúčanie/i,
    });
    await user.click(applyBtn);

    // Gold range is set to 12 and pulsing briefly
    const goldSlider = await screen.findByTestId("slider-gold");
    expect((goldSlider as HTMLInputElement).value).toBe("12");
    expect((goldSlider as HTMLInputElement).className).toMatch(/animate-pulse/);
    // Wait briefly for pulse to settle
    await new Promise((r) => setTimeout(r, 400));
    // Wizard closes
    // Wizard should be closed (shell persists)
    expect(dialog).toHaveAttribute("data-open", "0");
  });
});
