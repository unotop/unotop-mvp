// Screenshot automation script (Playwright)
import { chromium } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function captureScreenshots() {
  console.log('🚀 Launching browser...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2, // Retina quality
  });
  const page = await context.newPage();

  try {
    console.log('📡 Navigating to http://localhost:5173...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    console.log('✅ Page loaded, waiting for React hydration...');

    // Wait for React hydration - simpler approach
    await page.waitForTimeout(2000); // 2s for React mount + animations
    console.log('✅ Ready for screenshots');

    // Screenshot 1: Full page (left + right)
    const screenshotDir = join(__dirname, '..', 'docs', 'screenshots');
    await page.screenshot({
      path: join(screenshotDir, 'full-layout-sec0-sec5.png'),
      fullPage: true,
    });
    console.log('📸 Screenshot 1: full-layout-sec0-sec5.png');

    // Screenshot 2: Left stack only (crop to left 60%)
    const leftStackBox = await page.locator('main').boundingBox();
    if (leftStackBox) {
      await page.screenshot({
        path: join(screenshotDir, 'left-stack-sec0-sec3.png'),
        clip: {
          x: leftStackBox.x,
          y: 0,
          width: leftStackBox.width,
          height: leftStackBox.height + 200, // Extra padding for sec3
        },
      });
      console.log('📸 Screenshot 2: left-stack-sec0-sec3.png');
    }

    // Screenshot 3: Right panel (crop to right 40%)
    const rightPanelBox = await page.locator('aside').boundingBox();
    if (rightPanelBox) {
      await page.screenshot({
        path: join(screenshotDir, 'right-panel-gauge-metrics.png'),
        clip: {
          x: rightPanelBox.x - 20,
          y: 0,
          width: rightPanelBox.width + 40,
          height: Math.min(rightPanelBox.height, 1200), // Cap height
        },
      });
      console.log('📸 Screenshot 3: right-panel-gauge-metrics.png');
    }

    console.log('✅ All screenshots captured!');
  } catch (error) {
    console.error('❌ Screenshot capture failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// Run
captureScreenshots().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
