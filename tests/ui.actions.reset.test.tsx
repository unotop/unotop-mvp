import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AppClean from "../src/App.clean";

describe("Toolbar reset confirm", () => {
  beforeEach(() => {
    localStorage.setItem("unotop_v1", JSON.stringify({ any: 1 }));
    localStorage.setItem("unotop:v3", JSON.stringify({ any: 1 }));
  });
  it("respects confirm false/true branches", async () => {
    const user = userEvent.setup();
    vi.spyOn(window, "confirm").mockReturnValueOnce(false);
    // Stub reload (property môže byť non-configurable; nespúšťame spyOn aby to nepadalo)
    const originalReload = window.location.reload;
    // @ts-ignore - override pre test
    window.location.reload = () => undefined;
    render(<AppClean />);
    const btn = await screen.findByLabelText(
      /Reset aplikácie \(vymaže všetky nastavenia\)/i
    );
    await user.click(btn);
    expect(window.confirm).toHaveBeenCalled();
    (window.confirm as any).mockReturnValueOnce(true);
    await user.click(btn);
    // After confirmed reset, both keys should be removed
    expect(localStorage.getItem("unotop_v1")).toBeNull();
    expect(localStorage.getItem("unotop:v3")).toBeNull();
    // Restore pôvodnú implementáciu
    window.location.reload = originalReload;
  });
});
