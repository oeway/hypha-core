// playwright.config.js
module.exports = {
    testDir: './tests',
    use: {
      browserName: 'chromium',
      headless: true,
      viewport: { width: 1280, height: 720 },
      ignoreHTTPSErrors: true,
      video: 'retain-on-failure',
      screenshot: 'only-on-failure',
    },
    webServer: {
      command: 'npm start -- --port 8080',
      port: 8080,
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
    },
  };
  