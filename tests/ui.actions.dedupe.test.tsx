import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AppClean from "../src/App.clean";

// Minimal smoke to ensure the actions are not duplicated in the default view

describe("UI actions dedupe", () => {
  it("Zloženie – Import/Export iba raz", async () => {
    render(<AppClean />);
    const imports = await screen.findAllByRole("button", {
      name: /Importovať/i,
    });
    const exports_ = await screen.findAllByRole("button", {
      name: /Exportovať/i,
    });
    expect(imports.length).toBe(1);
    expect(exports_.length).toBe(1);
  });

  it("Metriky – 'Použiť vybraný mix' iba raz", async () => {
    render(<AppClean />);
    // Button is present in the Metrics card footer; ensure only one
    const applyBtns = screen.queryAllByRole("button", {
      name: /Použiť vybraný mix/i,
    });
    expect(applyBtns.length).toBe(1);
  });
});
