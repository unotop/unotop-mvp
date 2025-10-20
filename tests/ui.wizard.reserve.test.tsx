import { describe, it, expect, vi } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppClean from "../src/App.clean";
import { TEST_IDS as CLEAN_TEST_IDS } from "../src/App.clean"; // reuse harness TEST_IDS for stability

describe("MiniWizard – reserve gap action", () => {
  it("opens from insight and sets monthly contribution, focusing field", async () => {
    vi.useRealTimers(); // avoid range focus quirks with fake timers
    const user = userEvent.setup();
    render(<AppClean />);

    // Ensure there is a missing reserve by setting low reserve and some months
    const reserveField = await screen.findByLabelText(/Súčasná rezerva/i);
    await user.clear(reserveField as HTMLInputElement);
    await user.type(reserveField as HTMLInputElement, "0");
    const monthsField = await screen.findByLabelText(/Rezerva \(mesiace\)/i);
    await user.clear(monthsField as HTMLInputElement);
    await user.type(monthsField as HTMLInputElement, "6");

    // Click the reserve insight
    const insights = await screen.findByLabelText(/Insights/i);
    const reserveBtn = within(insights)
      .getAllByRole("button")
      .find((b) => /Rezervu doplň/i.test(b.textContent || ""));
    expect(reserveBtn).toBeTruthy();
    await user.click(reserveBtn!);

    // Wizard visible
    const dialog = await screen.findByRole("dialog", {
      name: /Mini-wizard odporúčania/i,
    });

    // Apply recommendation
    await user.click(
      within(dialog).getByRole("button", { name: /Použiť odporúčanie/i })
    );

    // Focus on monthly slider should be applied (use stable data-testid)
    const monthlySlider = await screen.findByTestId(
      CLEAN_TEST_IDS.MONTHLY_SLIDER
    );
    await waitFor(() => expect(monthlySlider).toHaveFocus());
    // Wizard closes
    expect(
      screen.queryByRole("dialog", { name: /Mini-wizard odporúčania/i })
    ).not.toBeInTheDocument();
  });
});
