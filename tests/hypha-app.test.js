// tests/plugin-load.test.js
const { test, expect } = require('@playwright/test');

test('should load', async ({ page }) => {
  await page.goto('http://localhost:8080/');
  await page.waitForLoadState('domcontentloaded');
  
});
