import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppClean from "../src/App.clean";

describe("Toolbar mobile Import/Export menu", () => {
  it("shows 'Viac' button and menu with Import/Export", async () => {
    // Simulate small viewport by setting container width via jsdom is limited;
    // but our button is conditionally shown via CSS (md:hidden), so it will be present in the DOM.
    const user = userEvent.setup();
    render(<AppClean />);
    const moreBtn = await screen.findByRole("button", { name: /Viac/i });
    expect(moreBtn).toBeInTheDocument();
    await user.click(moreBtn);
    expect(
      await screen.findByRole("menu", { name: /Viac možností/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Importovať/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("menuitem", { name: /Exportovať/i })
    ).toBeInTheDocument();
  });
});
