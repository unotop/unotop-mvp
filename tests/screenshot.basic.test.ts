/**
 * Screenshot test pre BASIC režim
 * Generuje screenshoty aktuálneho stavu appky
 */
import { test, expect } from '@playwright/test';

test.describe('BASIC režim screenshots', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:5173/');
    // Počkaj na hydráciu
    await page.waitForTimeout(1000);
  });

  test('01-basic-full-page', async ({ page }) => {
    // Nastaviť BASIC režim
    await page.evaluate(() => {
      const data = { profile: { modeUi: 'BASIC' } };
      localStorage.setItem('unotop:v3', JSON.stringify(data));
      localStorage.setItem('unotop_v3', JSON.stringify(data));
    });
    await page.reload();
    await page.waitForTimeout(500);

    // Screenshot celej stránky
    await page.screenshot({
      path: 'docs/screenshots/01-basic-full-page.png',
      fullPage: true,
    });
  });

  test('02-basic-nastavenia-panel', async ({ page }) => {
    await page.evaluate(() => {
      const data = { profile: { modeUi: 'BASIC' } };
      localStorage.setItem('unotop:v3', JSON.stringify(data));
      localStorage.setItem('unotop_v3', JSON.stringify(data));
    });
    await page.reload();
    await page.waitForTimeout(500);

    // Otvor Nastavenia panel
    const settingsBtn = page.locator('button:has-text("Nastavenia")').first();
    if (await settingsBtn.isVisible()) {
      await settingsBtn.click();
      await page.waitForTimeout(300);
    }

    // Screenshot ľavej časti
    const leftCol = page.locator('[data-testid="left-col"]');
    await leftCol.screenshot({
      path: 'docs/screenshots/02-basic-nastavenia-panel.png',
    });
  });

  test('03-basic-projekcia-graf', async ({ page }) => {
    await page.evaluate(() => {
      const data = { 
        profile: { 
          modeUi: 'BASIC',
          lumpSumEur: 10000,
          monthlyVklad: 500,
          horizonYears: 15,
          goalAssetsEur: 150000,
        },
        mix: [
          { key: 'gold', pct: 20 },
          { key: 'etf', pct: 40 },
          { key: 'bonds', pct: 30 },
          { key: 'dyn', pct: 10 },
        ],
      };
      localStorage.setItem('unotop:v3', JSON.stringify(data));
      localStorage.setItem('unotop_v3', JSON.stringify(data));
    });
    await page.reload();
    await page.waitForTimeout(1000);

    // Screenshot grafu (pravý panel)
    const projectionPanel = page.locator('text=Projekcia & Metriky').locator('..');
    await projectionPanel.screenshot({
      path: 'docs/screenshots/03-basic-projekcia-graf.png',
    });
  });

  test('04-pro-full-page', async ({ page }) => {
    // Prepni na PRO
    await page.evaluate(() => {
      const data = { profile: { modeUi: 'PRO' } };
      localStorage.setItem('unotop:v3', JSON.stringify(data));
      localStorage.setItem('unotop_v3', JSON.stringify(data));
    });
    await page.reload();
    await page.waitForTimeout(500);

    await page.screenshot({
      path: 'docs/screenshots/04-pro-full-page.png',
      fullPage: true,
    });
  });
});
