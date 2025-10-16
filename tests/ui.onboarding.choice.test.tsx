import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import AppClean from "../src/App.clean";

function resetStorage() {
  try {
    localStorage.removeItem("uiMode");
  } catch {}
  try {
    sessionStorage.removeItem("onboardingSeen");
  } catch {}
}

describe("OnboardingChoice overlay", () => {
  beforeEach(() => {
    resetStorage();
  });

  it("shows dialog on first render when no uiMode in LS", async () => {
    render(<AppClean />);
    const dialog = await screen.findByRole("dialog", {
      name: /Voľba režimu rozhrania/i,
    });
    expect(dialog).toBeTruthy();
    const basic = await screen.findByRole("button", { name: "BASIC" });
    expect(basic).toHaveFocus();
  });

  it("choosing PRO sets dataset and hides overlay", async () => {
    render(<AppClean />);
    const pro = await screen.findByRole("button", { name: "PRO" });
    fireEvent.click(pro);
    expect(document.documentElement.dataset.uiMode).toBe("pro");
    // Overlay hidden
    expect(screen.queryByRole("dialog", { name: /Voľba režimu/i })).toBeNull();
  });

  it("overlay not shown again within session when seen", async () => {
    render(<AppClean />);
    const pro = await screen.findByRole("button", { name: "PRO" });
    fireEvent.click(pro);
    // re-render new app instance in same session
    const { unmount } = render(<AppClean />);
    const dialog2 = screen.queryByRole("dialog", { name: /Voľba režimu/i });
    expect(dialog2).toBeNull();
    unmount();
  });
});
