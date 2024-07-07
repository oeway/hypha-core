// tests/plugin-load.test.js
const { test, expect } = require('@playwright/test');

test('should load and load Plugin via menu', async ({ page }) => {
  await page.goto('http://localhost:8080/lite.html');
  await page.waitForLoadState('domcontentloaded');
  const iframes = await page.$$('iframe[src="https://if.imjoy.io"]');
  await expect(iframes).toHaveLength(0);
  // Test loading a plugin via UI
  await page.click('.icon');
  await page.click('text=ImJoy Fiddle');
  const newIframes = await page.$$('iframe[src="https://if.imjoy.io"]');
  await expect(newIframes).toHaveLength(1);
  
});

test('should load and run a plugin from URL', async ({ page }) => {
    await page.goto('http://localhost:8080/lite.html?plugin=https://if.imjoy.io');
    await page.waitForLoadState('domcontentloaded');
    const iframe = await page.waitForSelector('iframe[src="https://if.imjoy.io"]');
    expect(iframe).toBeTruthy();
});
