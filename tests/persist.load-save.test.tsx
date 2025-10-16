import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppClean from "../src/App.clean";

describe("Persistence load/save", () => {
  it("saves to localStorage and loads on next render", async () => {
    const user = userEvent.setup();
    // First render: change a field
    const { unmount } = render(<AppClean />);
    const income = await screen.findByLabelText(/Mesačný príjem/i);
    await user.clear(income as HTMLInputElement);
    await user.type(income as HTMLInputElement, "2500");
    unmount();
    // Second render: should load
    render(<AppClean />);
    const income2 = await screen.findByLabelText(/Mesačný príjem/i);
    expect((income2 as HTMLInputElement).value).toMatch(/2500/);
  });
});

describe("Toolbar reset confirm", () => {
  it("respects confirm false/true branches", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    render(<AppClean />);
    const btn = await screen.findByLabelText(
      /Reset aplikácie \(vymaže všetky nastavenia\)/i
    );
    // On small screens the button is hidden via CSS class; still in DOM for test
    await user.click(btn);
    expect(window.confirm).toHaveBeenCalled();
    // True branch
    (window.confirm as any).mockReturnValueOnce(true);
    await user.click(btn);
  });
});
