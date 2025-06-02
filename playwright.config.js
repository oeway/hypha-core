// playwright.config.js
module.exports = {
    testDir: './tests',
    // Look for test files only in tests/integration/
    testMatch: ['**/tests/integration/**/*.test.js'],
    timeout: 30000, // 30 seconds timeout for each test
    use: {
      browserName: 'chromium',
      headless: true,
      viewport: { width: 1280, height: 720 },
      ignoreHTTPSErrors: true,
      video: 'retain-on-failure',
      screenshot: 'only-on-failure',
      // Add trace for debugging
      trace: 'retain-on-failure',
    },
    // Add more browsers for cross-browser testing
    projects: [
      {
        name: 'chromium',
        use: { browserName: 'chromium' },
      },
      {
        name: 'firefox',
        use: { browserName: 'firefox' },
      },
      {
        name: 'webkit',
        use: { browserName: 'webkit' },
      },
    ],
    webServer: {
      command: 'npm start -- --port 8080',
      port: 8080,
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
    },
    // Reporter configuration
    reporter: [
      ['list'], // Console output
      ['html'], // HTML report
      ['json', { outputFile: 'test-results/results.json' }], // JSON results
    ],
    // Retry configuration
    retries: process.env.CI ? 2 : 0,
    // Parallel test execution
    workers: process.env.CI ? 1 : undefined,
  };
  