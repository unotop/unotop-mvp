import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "../src/LegacyApp";

// Helpers --------------------------------------------------
function getSpinboxes() {
  return screen.getAllByRole("spinbutton") as HTMLInputElement[];
}

function valueOf(labelRegex: RegExp): HTMLInputElement {
  return screen.getByRole("spinbutton", {
    name: labelRegex,
  }) as HTMLInputElement;
}

function snapshotMix(): Record<string, number> {
  const snap: Record<string, number> = {};
  getSpinboxes().forEach((el) => {
    const lab = (
      el.getAttribute("aria-label") ||
      el.closest("label")?.textContent ||
      ""
    )
      .split("%")[0]
      .trim();
    snap[lab] = Number(el.value || 0);
  });
  return snap;
}

function sumValues(map: Record<string, number>): number {
  return Object.values(map).reduce((a, b) => a + b, 0);
}

function approximately(a: number, b: number, eps = 0.0001) {
  return Math.abs(a - b) <= eps;
}

describe("Mix invariants – manual pipeline", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("Upraviť podľa pravidiel – opraví mix (gold floor, sum=100, dyn+crypto ≤22)", async () => {
    const user = userEvent.setup();
    render(<App />);

    // Wait until baseline captured (Reset button becomes enabled)
    const resetBtn = await screen.findByRole("button", {
      name: /Resetovať hodnoty/i,
    });
    await waitFor(
      () => {
        expect(resetBtn.hasAttribute("disabled")).toBe(false);
      },
      { timeout: 2000 }
    );

    // Force invalid state: set gold to 0; tweak another asset to break 100 sum.
    const gold = valueOf(/Zlato/i);
    const firstOther = getSpinboxes().find(
      (el) =>
        !/Zlato/i.test(
          el.getAttribute("aria-label") ||
            el.closest("label")?.textContent ||
            ""
        )
    )!;
    // Decrease other asset by 3 to create deficit; then set gold 0
    await user.clear(firstOther);
    await user.type(
      firstOther,
      String(Math.max(0, Number(firstOther.value) - 3))
    );
    await user.clear(gold);
    await user.type(gold, "0");

    const before = snapshotMix();
    expect(before).not.toBeNull();
    expect(before["Zlato (fyzické)"] ?? before["Zlato"] ?? 0).toBe(0);
    expect(sumValues(before)).not.toBe(100); // deliberately off

    const applyBtn = screen.getByRole("button", {
      name: /Upraviť podľa pravidiel/i,
    });
    await user.click(applyBtn);

    // Optionally verify toast about modification
    await screen.findByText(/upravené podľa pravidiel/i, {}, { timeout: 1500 });

    const after = snapshotMix();
    const goldVal = after["Zlato (fyzické)"] ?? after["Zlato"] ?? 0;
    expect(goldVal).toBeGreaterThanOrEqual(10);
    const dyn = after["Dynamické riadenie"] ?? 0;
    const crypto = after["Krypto (BTC/ETH)"] ?? 0;
    expect(dyn + crypto).toBeLessThanOrEqual(22);
    expect(Math.round(sumValues(after))).toBe(100);
  });

  it("Idempotencia – druhé kliknutie neurobí zmeny", async () => {
    const user = userEvent.setup();
    render(<App />);
    const applyBtn = await screen.findByRole("button", {
      name: /Upraviť podľa pravidiel/i,
    });
    // First ensure any potential change (e.g., lower gold slightly if >=11)
    const gold = valueOf(/Zlato/i);
    const originalGold = Number(gold.value);
    if (originalGold >= 11) {
      await user.clear(gold);
      await user.type(gold, String(originalGold - 1));
    }
    await user.click(applyBtn);
    const firstSnap = snapshotMix();
    await user.click(applyBtn);
    // Expect toast about no changes
    await screen.findByText(/Žiadne úpravy/i, {}, { timeout: 1500 });
    const secondSnap = snapshotMix();
    expect(secondSnap).toEqual(firstSnap);
  });

  it("Resetovať hodnoty – vráti baselineMix", async () => {
    const user = userEvent.setup();
    render(<App />);
    const resetBtn = await screen.findByRole("button", {
      name: /Resetovať hodnoty/i,
    });
    // Wait for enablement to avoid race with baseline capture
    await waitFor(
      () => {
        expect(resetBtn.hasAttribute("disabled")).toBe(false);
      },
      { timeout: 2000 }
    );
    const baseline = snapshotMix();

    // Modify two assets
    const gold = valueOf(/Zlato/i);
    await user.clear(gold);
    await user.type(gold, String(Math.max(0, Number(gold.value) - 5)));
    const dyn = valueOf(/Dynamické/i);
    await user.clear(dyn);
    await user.type(dyn, String(Math.max(0, Number(dyn.value) + 2)));
    const changed = snapshotMix();
    expect(changed).not.toEqual(baseline);

    await user.click(resetBtn);
    const afterReset = snapshotMix();
    // Allow small rounding drift (fairRoundTo100 may re-normalize). Compare each key within 1 p.b.
    Object.keys(baseline).forEach((k) => {
      if (afterReset[k] === undefined) return; // ignore keys that might differ if assets changed externally
      expect(Math.abs(afterReset[k] - baseline[k])).toBeLessThanOrEqual(1);
    });
  });
});
