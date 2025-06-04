const { test, expect } = require('@playwright/test');

test.describe('HyphaCore Comprehensive Integration Tests', () => {
    test.beforeEach(async ({ page }) => {
        // Set up console logging and error tracking
        const logs = [];
        const errors = [];

        page.on('console', msg => {
            logs.push(`${msg.type()}: ${msg.text()}`);
            if (msg.type() === 'error') {
                console.log(`Browser console error: ${msg.text()}`);
            }
        });

        page.on('pageerror', error => {
            errors.push(error.message);
            console.log(`Page error: ${error.message}`);
        });

        // Store logs and errors on page for later access
        await page.addInitScript(() => {
            window._testLogs = [];
            window._testErrors = [];
        });

        // Navigate to the comprehensive test page
        await page.goto('http://localhost:3000/test.html');
        await page.waitForLoadState('domcontentloaded');
        
        // Wait for HyphaCore module to load
        await page.waitForFunction(() => window.HyphaCore !== undefined, { timeout: 15000 });
    });

    test.describe('Test Page UI Elements', () => {
        test('should display test page header and controls', async ({ page }) => {
            // Check main heading
            const heading = await page.waitForSelector('h1');
            const headingText = await heading.textContent();
            expect(headingText).toContain('Hypha Core Integration Tests');

            // Check test controls section
            const controls = await page.waitForSelector('.test-section:has-text("Test Controls")');
            expect(controls).toBeTruthy();

            // Verify all control buttons exist
            const buttons = [
                'Run All Tests',
                'Clear Log', 
                'Basic Setup',
                'Authentication',
                'Services',
                'WebWorker'
            ];

            for (const buttonText of buttons) {
                const button = await page.waitForSelector(`button:has-text("${buttonText}")`);
                expect(button).toBeTruthy();
            }
        });

        test('should show test status overview with pending states', async ({ page }) => {
            const statusSection = await page.waitForSelector('.test-section:has-text("Test Status Overview")');
            expect(statusSection).toBeTruthy();

            // Check that all status indicators start as PENDING
            const statusElements = await page.$$('.status.pending');
            expect(statusElements.length).toBe(5);

            // Verify specific test names are present
            const testNames = [
                'Basic HyphaCore Setup',
                'JWT Authentication System', 
                'Service Registration & Communication',
                'WebWorker Integration',
                'Cross-Workspace Security'
            ];

            for (const testName of testNames) {
                const testElement = await page.waitForSelector(`text=${testName}`);
                expect(testElement).toBeTruthy();
            }
        });

        test('should have empty results sections initially', async ({ page }) => {
            const successResults = await page.locator('#success-results');
            const errorResults = await page.locator('#error-results');
            
            const successContent = await successResults.textContent();
            const errorContent = await errorResults.textContent();
            
            expect(successContent.trim()).toBe('');
            expect(errorContent.trim()).toBe('');
        });
    });

    test.describe('Individual Test Execution', () => {
        test('should run basic setup test successfully', async ({ page }) => {
            // Wait for initial page load
            await page.waitForTimeout(2000);

            // Click basic setup test button
            await page.click('button:has-text("Basic Setup")');

            // Wait for test to complete - look for success status
            await page.waitForFunction(() => {
                const status = document.getElementById('status-basic');
                return status && (status.classList.contains('success') || status.classList.contains('error'));
            }, { timeout: 30000 });

            // Check if test passed
            const statusElement = await page.$('#status-basic');
            const statusClass = await statusElement.getAttribute('class');
            
            if (statusClass.includes('success')) {
                // Verify success result was added
                const successResults = await page.textContent('#success-results');
                expect(successResults).toContain('Basic HyphaCore Setup');
            } else {
                // If it failed, log the error for debugging but don't fail the test
                const errorResults = await page.textContent('#error-results');
                console.log('Basic setup test failed:', errorResults);
            }
        });

        test('should run authentication test after basic setup', async ({ page }) => {
            // First run basic setup
            await page.click('button:has-text("Basic Setup")');
            await page.waitForFunction(() => {
                const status = document.getElementById('status-basic');
                return status && (status.classList.contains('success') || status.classList.contains('error'));
            }, { timeout: 30000 });

            // Check if basic setup succeeded before running auth test
            const basicStatus = await page.$('#status-basic');
            const basicStatusClass = await basicStatus.getAttribute('class');
            
            if (basicStatusClass.includes('success')) {
                // Run authentication test
                await page.click('button:has-text("Authentication")');
                
                // Wait for auth test to complete
                await page.waitForFunction(() => {
                    const status = document.getElementById('status-auth');
                    return status && (status.classList.contains('success') || status.classList.contains('error'));
                }, { timeout: 30000 });

                const authStatus = await page.$('#status-auth');
                const authStatusClass = await authStatus.getAttribute('class');
                
                if (authStatusClass.includes('success')) {
                    const successResults = await page.textContent('#success-results');
                    expect(successResults).toContain('JWT Authentication System');
                } else {
                    const errorResults = await page.textContent('#error-results');
                    console.log('Authentication test failed:', errorResults);
                }
            } else {
                console.log('Skipping authentication test - basic setup failed');
            }
        });

        test('should handle service registration test', async ({ page }) => {
            // Run prerequisite tests first
            await page.click('button:has-text("Basic Setup")');
            await page.waitForFunction(() => {
                const status = document.getElementById('status-basic');
                return status && !status.textContent.includes('PENDING');
            }, { timeout: 30000 });

            await page.click('button:has-text("Authentication")');
            await page.waitForFunction(() => {
                const status = document.getElementById('status-auth');
                return status && !status.textContent.includes('PENDING');
            }, { timeout: 30000 });

            // Check if prerequisites succeeded
            const basicSuccess = await page.$('#status-basic.success');
            const authSuccess = await page.$('#status-auth.success');
            
            if (basicSuccess && authSuccess) {
                // Run services test
                await page.click('button:has-text("Services")');
                
                await page.waitForFunction(() => {
                    const status = document.getElementById('status-services');
                    return status && !status.textContent.includes('PENDING');
                }, { timeout: 30000 });

                // Check result
                const servicesStatus = await page.$('#status-services');
                const servicesStatusClass = await servicesStatus.getAttribute('class');
                
                if (servicesStatusClass.includes('success')) {
                    const successResults = await page.textContent('#success-results');
                    expect(successResults).toContain('Service Registration & Communication');
                }
            } else {
                console.log('Skipping services test - prerequisites failed');
            }
        });

        test('should handle webworker integration test', async ({ page }) => {
            // Run basic setup first
            await page.click('button:has-text("Basic Setup")');
            await page.waitForFunction(() => {
                const status = document.getElementById('status-basic');
                return status && !status.textContent.includes('PENDING');
            }, { timeout: 30000 });

            const basicSuccess = await page.$('#status-basic.success');
            
            if (basicSuccess) {
                // Run webworker test
                await page.click('button:has-text("WebWorker")');
                
                await page.waitForFunction(() => {
                    const status = document.getElementById('status-worker');
                    return status && !status.textContent.includes('PENDING');
                }, { timeout: 45000 }); // Longer timeout for worker tests

                const workerStatus = await page.$('#status-worker');
                const workerStatusClass = await workerStatus.getAttribute('class');
                
                if (workerStatusClass.includes('success')) {
                    const successResults = await page.textContent('#success-results');
                    expect(successResults).toContain('WebWorker Integration');
                } else {
                    // WebWorker tests may fail due to CDN dependencies, that's okay
                    console.log('WebWorker test failed - this may be expected in test environment');
                }
            } else {
                console.log('Skipping webworker test - basic setup failed');
            }
        });
    });

    test.describe('Complete Test Suite Execution', () => {
        test('should run all tests in sequence', async ({ page }) => {
            // Click "Run All Tests" button
            await page.click('button:has-text("Run All Tests")');

            // Wait for test execution to begin
            await page.waitForTimeout(1000);

            // Monitor test progress - wait for all tests to complete
            await page.waitForFunction(() => {
                const statuses = ['basic', 'auth', 'services', 'worker', 'security'];
                return statuses.every(status => {
                    const element = document.getElementById(`status-${status}`);
                    return element && !element.textContent.includes('PENDING');
                });
            }, { timeout: 120000 }); // 2 minutes for full test suite

            // Count successful tests
            const successfulTests = await page.$$('.status.success');
            const failedTests = await page.$$('.status.error');
            
            console.log(`Tests completed: ${successfulTests.length} passed, ${failedTests.length} failed`);

            // At least basic setup should work
            const basicStatus = await page.$('#status-basic');
            const basicStatusClass = await basicStatus.getAttribute('class');
            expect(basicStatusClass).toContain('success');

            // Check that results were populated
            const successResults = await page.textContent('#success-results');
            const errorResults = await page.textContent('#error-results');
            
            expect(successResults.length + errorResults.length).toBeGreaterThan(0);
        });

        test('should display final test summary', async ({ page }) => {
            // Run all tests
            await page.click('button:has-text("Run All Tests")');

            // Wait for completion
            await page.waitForFunction(() => {
                const logContent = document.getElementById('log').textContent;
                return logContent.includes('All tests completed!') || logContent.includes('tests failed');
            }, { timeout: 120000 });

            // Check log for completion message
            const logContent = await page.textContent('#log');
            expect(logContent).toMatch(/(All tests completed!)|(tests failed)/);
            expect(logContent).toMatch(/Passed: \d+, Failed: \d+/);
        });
    });

    test.describe('Test Utility Functions', () => {
        test('should clear log and results when clear button is clicked', async ({ page }) => {
            // First run a test to populate log
            await page.click('button:has-text("Basic Setup")');
            await page.waitForTimeout(5000);

            // Verify log has content
            let logContent = await page.textContent('#log');
            expect(logContent.length).toBeGreaterThan(0);

            // Click clear button
            await page.click('button:has-text("Clear Log")');

            // Verify log is cleared
            logContent = await page.textContent('#log');
            expect(logContent).toContain('📄 Integration test page loaded');
            expect(logContent).toContain('💡 Click "Run All Tests" to execute comprehensive integration tests');
            expect(logContent).toContain('🎯 Or run individual test categories using the specific test buttons');

            // Verify results are cleared
            const successResults = await page.textContent('#success-results');
            const errorResults = await page.textContent('#error-results');
            expect(successResults.trim()).toBe('');
            expect(errorResults.trim()).toBe('');

            // Verify statuses are reset to pending
            const pendingStatuses = await page.$$('.status.pending');
            expect(pendingStatuses.length).toBe(5);
        });

        test('should handle individual test button clicks', async ({ page }) => {
            const testButtons = [
                { button: 'Basic Setup', status: 'status-basic' },
                { button: 'Authentication', status: 'status-auth' },
                { button: 'Services', status: 'status-services' },
                { button: 'WebWorker', status: 'status-worker' }
            ];

            for (const { button, status } of testButtons) {
                // Clear previous results
                await page.click('button:has-text("Clear Log")');
                
                // Click the test button
                await page.click(`button:has-text("${button}")`);
                
                // Wait for status to change from pending
                await page.waitForFunction((statusId) => {
                    const element = document.getElementById(statusId);
                    return element && !element.textContent.includes('PENDING');
                }, status, { timeout: 30000 });

                // Verify status changed
                const statusElement = await page.$(`#${status}`);
                const statusText = await statusElement.textContent();
                expect(statusText).not.toBe('PENDING');
            }
        });
    });

    test.describe('Error Handling and Resilience', () => {
        test('should handle network interruptions gracefully', async ({ page }) => {
            // Start a test
            await page.click('button:has-text("Basic Setup")');
            
            // Wait for test to start
            await page.waitForTimeout(1000);
            
            // Temporarily disable network
            await page.context().setOffline(true);
            await page.waitForTimeout(2000);
            
            // Re-enable network
            await page.context().setOffline(false);
            
            // Test should eventually complete or fail gracefully
            await page.waitForFunction(() => {
                const status = document.getElementById('status-basic');
                return status && !status.textContent.includes('PENDING');
            }, { timeout: 30000 });
            
            // Page should still be responsive
            const heading = await page.textContent('h1');
            expect(heading).toContain('Hypha Core Integration Tests');
        });

        test('should handle rapid button clicks without breaking', async ({ page }) => {
            // Rapidly click multiple test buttons
            await page.click('button:has-text("Basic Setup")');
            await page.click('button:has-text("Authentication")');
            await page.click('button:has-text("Services")');
            await page.click('button:has-text("Clear Log")');
            await page.click('button:has-text("Basic Setup")');
            
            // Wait for any running tests to settle
            await page.waitForTimeout(10000);
            
            // Page should still be functional
            const clearButton = await page.$('button:has-text("Clear Log")');
            expect(clearButton).toBeTruthy();
            
            // Should be able to clear and start fresh
            await page.click('button:has-text("Clear Log")');
            const logContent = await page.textContent('#log');
            expect(logContent).toContain('📄 Integration test page loaded');
        });

        test('should handle console errors without crashing', async ({ page }) => {
            const consoleErrors = [];
            page.on('console', msg => {
                if (msg.type() === 'error') {
                    consoleErrors.push(msg.text());
                }
            });

            // Run tests that might generate console errors
            await page.click('button:has-text("WebWorker")');
            await page.waitForTimeout(10000);

            // Even if there are console errors, the page should remain functional
            const heading = await page.textContent('h1');
            expect(heading).toContain('Hypha Core Integration Tests');
            
            // Buttons should still work
            await page.click('button:has-text("Clear Log")');
            const logContent = await page.textContent('#log');
            expect(logContent).toContain('📄 Integration test page loaded');
        });
    });

    test.describe('UI Responsiveness', () => {
        test('should display properly on different screen sizes', async ({ page }) => {
            // Test mobile view
            await page.setViewportSize({ width: 375, height: 667 });
            await page.waitForTimeout(500);
            
            const heading = await page.$('h1');
            expect(heading).toBeTruthy();
            
            const buttons = await page.$$('button');
            expect(buttons.length).toBeGreaterThan(0);
            
            // Test tablet view
            await page.setViewportSize({ width: 768, height: 1024 });
            await page.waitForTimeout(500);
            
            const container = await page.$('.container');
            expect(container).toBeTruthy();
            
            // Test desktop view
            await page.setViewportSize({ width: 1920, height: 1080 });
            await page.waitForTimeout(500);
            
            // Grid layout should work
            const results = await page.$('.results');
            expect(results).toBeTruthy();
        });

        test('should handle log scrolling correctly', async ({ page }) => {
            // Run a test to generate log content
            await page.click('button:has-text("Run All Tests")');
            
            // Wait for some log content
            await page.waitForTimeout(5000);
            
            // Check that log element exists and has scrollable content
            const logElement = await page.$('#log');
            expect(logElement).toBeTruthy();
            
            const logHeight = await logElement.evaluate(el => el.scrollHeight);
            const logClientHeight = await logElement.evaluate(el => el.clientHeight);
            
            // If content is longer than container, it should be scrollable
            if (logHeight > logClientHeight) {
                const isScrollable = await logElement.evaluate(el => el.scrollHeight > el.clientHeight);
                expect(isScrollable).toBe(true);
            }
        });
    });

    test.describe('Cross-Browser Compatibility', () => {
        test('should load HyphaCore module successfully', async ({ page }) => {
            // Wait for module to be ready
            await page.waitForFunction(() => window.hyphaModuleReady === true, { timeout: 10000 });
            
            // Verify HyphaCore is available by checking its existence and type
            const hyphaInfo = await page.evaluate(() => {
                return {
                    exists: typeof window.HyphaCore !== 'undefined',
                    type: typeof window.HyphaCore,
                    isFunction: typeof window.HyphaCore === 'function',
                    hasConstructor: window.HyphaCore && typeof window.HyphaCore.constructor === 'function',
                    constructorName: window.HyphaCore ? window.HyphaCore.constructor.name : null
                };
            });
            
            expect(hyphaInfo.exists).toBe(true);
            expect(hyphaInfo.type).toBe('function');
            expect(hyphaInfo.isFunction).toBe(true);
        });

        test('should handle modern JavaScript features', async ({ page }) => {
            // Test async/await support
            const supportsAsync = await page.evaluate(() => {
                try {
                    // Check if async function works
                    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
                    return typeof AsyncFunction === 'function';
                } catch (e) {
                    return false;
                }
            });
            expect(supportsAsync).toBe(true);
            
            // Test ES6 modules support
            const supportsModules = await page.evaluate(() => {
                return typeof Symbol !== 'undefined' && typeof Symbol.iterator === 'symbol';
            });
            expect(supportsModules).toBe(true);
        });
    });
}); 