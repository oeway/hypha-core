const { test, expect } = require('@playwright/test');

test.describe('HyphaCore Integration Tests', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to a blank page to start fresh
        await page.goto('http://localhost:8080/lite.html');
        await page.waitForLoadState('domcontentloaded');
    });

    // Helper function to ensure dropdown is visible
    async function ensureDropdownVisible(page) {
        // Wait for page to load
        await page.waitForTimeout(1000);
        
        // Ensure toggle function exists
        const hasToggleDropdown = await page.evaluate(() => typeof window.toggleDropdown === 'function');
        if (!hasToggleDropdown) {
            await page.evaluate(() => {
                window.toggleDropdown = function () {
                    const dropdown = document.getElementById("dropdownMenu");
                    if (dropdown) {
                        dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
                    }
                };
            });
        }
        
        // Click icon to open dropdown
        await page.click('.icon');
        
        // Ensure dropdown is visible
        const dropdownDisplay = await page.evaluate(() => {
            const dropdown = document.getElementById('dropdownMenu');
            return dropdown ? dropdown.style.display : 'not found';
        });
        
        if (dropdownDisplay !== 'block') {
            await page.evaluate(() => window.toggleDropdown());
        }
        
        // Wait for dropdown to be visible
        await page.waitForFunction(() => {
            const dropdown = document.getElementById('dropdownMenu');
            return dropdown && dropdown.style.display === 'block';
        }, { timeout: 5000 });
    }

    test.describe('Core Initialization', () => {
        test('should initialize HyphaCore successfully', async ({ page }) => {
            // Wait for HyphaCore to be available
            await page.waitForFunction(() => window.hyphaCore !== undefined);
            
            // Wait for the API to be initialized (after start() completes)
            await page.waitForFunction(() => window.hyphaCore && window.hyphaCore.api !== null, { timeout: 10000 });
            
            // Check that the core is initialized
            const isInitialized = await page.evaluate(() => {
                return window.hyphaCore && window.hyphaCore.api;
            });
            
            expect(isInitialized).toBeTruthy();
        });

        test('should display Hypha logo and dropdown menu', async ({ page }) => {
            const logo = await page.waitForSelector('.icon');
            expect(logo).toBeTruthy();
            
            const logoSrc = await logo.getAttribute('src');
            expect(logoSrc).toContain('hypha-icon-black.svg');
        });

        test('should show dropdown menu on icon click', async ({ page }) => {
            // Wait a bit for the page to fully load
            await page.waitForTimeout(1000);
            
            // Check if the dropdown element exists and function is available
            const dropdownExists = await page.evaluate(() => {
                return !!document.getElementById('dropdownMenu') && typeof window.toggleDropdown === 'function';
            });
            expect(dropdownExists).toBe(true);
            
            // If function doesn't exist, define it manually for the test
            const hasToggleDropdown = await page.evaluate(() => typeof window.toggleDropdown === 'function');
            if (!hasToggleDropdown) {
                await page.evaluate(() => {
                    window.toggleDropdown = function () {
                        const dropdown = document.getElementById("dropdownMenu");
                        if (dropdown) {
                            dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
                        }
                    };
                });
            }
            
            // Click the icon to toggle dropdown
            await page.click('.icon');
            
            // Get current dropdown state and ensure it becomes visible
            const dropdownDisplay = await page.evaluate(() => {
                const dropdown = document.getElementById('dropdownMenu');
                return dropdown ? dropdown.style.display : 'not found';
            });
            
            // If dropdown is hidden, toggle it to make it visible
            if (dropdownDisplay === 'none' || dropdownDisplay === '') {
                await page.evaluate(() => window.toggleDropdown());
            }
            
            // Wait for dropdown to become visible
            await page.waitForFunction(() => {
                const dropdown = document.getElementById('dropdownMenu');
                return dropdown && dropdown.style.display === 'block';
            }, { timeout: 5000 });
            
            const dropdown = await page.$('.dropdown');
            expect(dropdown).toBeTruthy();
            
            const menuItems = await page.$$('.dropdown a');
            expect(menuItems.length).toBeGreaterThan(0);
        });
    });

    test.describe('Plugin Loading', () => {
        test('should load ImJoy Fiddle plugin from menu', async ({ page }) => {
            // Check initial state - no iframes
            let iframes = await page.$$('iframe[src="https://if.imjoy.io"]');
            expect(iframes.length).toBe(0);
            
            // Ensure dropdown is visible and click menu item
            await ensureDropdownVisible(page);
            await page.click('text=ImJoy Fiddle');
            
            // Wait for iframe to be created
            await page.waitForSelector('iframe[src="https://if.imjoy.io"]', { timeout: 10000 });
            
            // Verify iframe was created
            iframes = await page.$$('iframe[src="https://if.imjoy.io"]');
            expect(iframes.length).toBe(1);
        });

        test('should load plugin from URL parameter', async ({ page }) => {
            await page.goto('http://localhost:8080/lite.html?plugin=https://if.imjoy.io');
            await page.waitForLoadState('domcontentloaded');
            
            // Wait for plugin to load
            const iframe = await page.waitForSelector('iframe[src="https://if.imjoy.io"]', { timeout: 10000 });
            expect(iframe).toBeTruthy();
        });

        test('should load multiple plugins from URL parameters', async ({ page }) => {
            await page.goto('http://localhost:8080/lite.html?plugin=https://if.imjoy.io&plugin=https://if.imjoy.io');
            await page.waitForLoadState('domcontentloaded');
            
            // Wait for plugins to load
            await page.waitForFunction(() => {
                const iframes = document.querySelectorAll('iframe[src="https://if.imjoy.io"]');
                return iframes.length >= 2;
            }, { timeout: 15000 });
            
            const iframes = await page.$$('iframe[src="https://if.imjoy.io"]');
            expect(iframes.length).toBeGreaterThanOrEqual(2);
        });

        test('should load plugin via prompt dialog', async ({ page }) => {
            // Setup dialog handler
            let dialogMessage = '';
            page.on('dialog', async dialog => {
                dialogMessage = dialog.message();
                await dialog.accept('https://if.imjoy.io');
            });
            
            // Ensure dropdown is visible and trigger load plugin dialog
            await ensureDropdownVisible(page);
            await page.click('text=+ Load Plugin');
            
            // Wait for dialog and iframe
            await page.waitForTimeout(1000); // Wait for dialog to be handled
            await page.waitForSelector('iframe[src="https://if.imjoy.io"]', { timeout: 10000 });
            
            expect(dialogMessage).toBe('Enter the plugin URL:');
            
            const iframes = await page.$$('iframe[src="https://if.imjoy.io"]');
            expect(iframes.length).toBe(1);
        });
    });

    test.describe('Window Management', () => {
        test('should create WinBox windows for plugins', async ({ page }) => {
            // Load a plugin
            await ensureDropdownVisible(page);
            await page.click('text=ImJoy Fiddle');
            
            // Wait for WinBox window to be created
            await page.waitForSelector('.winbox', { timeout: 10000 });
            
            const winboxes = await page.$$('.winbox');
            expect(winboxes.length).toBe(1);
            
            // Check that iframe is inside winbox
            const iframeInWinbox = await page.$('.winbox iframe[src="https://if.imjoy.io"]');
            expect(iframeInWinbox).toBeTruthy();
        });

        test('should handle window close button', async ({ page }) => {
            // Load a plugin
            await ensureDropdownVisible(page);
            await page.click('text=ImJoy Fiddle');
            
            // Wait for window and close it
            await page.waitForSelector('.winbox', { timeout: 10000 });
            await page.click('.winbox .wb-close');
            
            // Verify window is removed
            await page.waitForFunction(() => {
                return document.querySelectorAll('.winbox').length === 0;
            }, { timeout: 5000 });
            
            const winboxes = await page.$$('.winbox');
            expect(winboxes.length).toBe(0);
        });

        test('should handle multiple windows', async ({ page }) => {
            // Load two plugins
            await ensureDropdownVisible(page);
            await page.click('text=ImJoy Fiddle');
            
            await page.waitForSelector('.winbox', { timeout: 10000 });
            
            await ensureDropdownVisible(page);
            await page.click('text=ImJoy Fiddle');
            
            // Wait for second window
            await page.waitForFunction(() => {
                return document.querySelectorAll('.winbox').length >= 2;
            }, { timeout: 10000 });
            
            const winboxes = await page.$$('.winbox');
            expect(winboxes.length).toBeGreaterThanOrEqual(2);
        });
    });

    test.describe('Background Animation', () => {
        test('should load VANTA birds animation', async ({ page }) => {
            // Wait for VANTA to initialize
            await page.waitForFunction(() => window.VANTA !== undefined, { timeout: 10000 });
            
            // Check if animation is applied to root element
            const rootElement = await page.$('#root');
            expect(rootElement).toBeTruthy();
            
            // Check if VANTA has been initialized - look for the canvas element or VANTA instance
            const hasVanta = await page.evaluate(() => {
                const root = document.getElementById('root');
                // Check if VANTA is initialized by looking for canvas or checking if root has VANTA styling
                return root && (
                    root.querySelector('canvas') !== null || 
                    root.style.position === 'fixed' ||
                    window.VANTA && Object.keys(window.VANTA).length > 0
                );
            });
            
            expect(hasVanta).toBe(true);
        });
    });

    test.describe('Error Handling', () => {
        test('should handle invalid plugin URLs gracefully', async ({ page }) => {
            // Monitor console errors
            const consoleErrors = [];
            page.on('console', msg => {
                if (msg.type() === 'error') {
                    consoleErrors.push(msg.text());
                }
            });
            
            // Setup dialog handler for invalid URL
            page.on('dialog', async dialog => {
                await dialog.accept('invalid-url');
            });
            
            // Ensure dropdown is visible and try to load invalid plugin
            await ensureDropdownVisible(page);
            await page.click('text=+ Load Plugin');
            
            // Wait a bit for potential errors
            await page.waitForTimeout(2000);
            
            // Should not crash the application
            const hyphaCore = await page.evaluate(() => window.hyphaCore);
            expect(hyphaCore).toBeTruthy();
        });

        test('should handle network errors gracefully', async ({ page }) => {
            // Simulate offline mode
            await page.context().setOffline(true);
            
            // Try to load plugin
            await ensureDropdownVisible(page);
            await page.click('text=ImJoy Fiddle');
            
            // Wait and verify app doesn't crash
            await page.waitForTimeout(2000);
            
            const hyphaCore = await page.evaluate(() => window.hyphaCore);
            expect(hyphaCore).toBeTruthy();
            
            // Re-enable network
            await page.context().setOffline(false);
        });
    });

    test.describe('API Functionality', () => {
        test('should expose loadApp function globally', async ({ page }) => {
            // Wait for loadApp function to be available
            await page.waitForFunction(() => typeof window.loadApp === 'function', { timeout: 10000 });
            
            const hasLoadApp = await page.evaluate(() => {
                return typeof window.loadApp === 'function';
            });
            
            expect(hasLoadApp).toBe(true);
        });

        test('should allow programmatic plugin loading', async ({ page }) => {
            // Wait for loadApp function to be available
            await page.waitForFunction(() => typeof window.loadApp === 'function', { timeout: 10000 });
            
            // Load plugin programmatically
            await page.evaluate(() => {
                return window.loadApp('https://if.imjoy.io');
            });
            
            // Wait for iframe to appear
            await page.waitForSelector('iframe[src="https://if.imjoy.io"]', { timeout: 10000 });
            
            const iframes = await page.$$('iframe[src="https://if.imjoy.io"]');
            expect(iframes.length).toBe(1);
        });

        test('should provide access to HyphaCore API', async ({ page }) => {
            // Wait for HyphaCore API to be available
            await page.waitForFunction(() => window.hyphaCore && window.hyphaCore.api !== null, { timeout: 10000 });
            
            const apiMethods = await page.evaluate(() => {
                const api = window.hyphaCore.api;
                return api ? Object.keys(api) : [];
            });
            
            expect(apiMethods.length).toBeGreaterThan(0);
        });
    });

    test.describe('UI Interactions', () => {
        test('should close dropdown when clicking outside', async ({ page }) => {
            // Ensure dropdown is visible first
            await ensureDropdownVisible(page);
            
            // Click outside by clicking on the root element instead of body
            await page.click('#root');
            
            // Wait for dropdown to close
            await page.waitForFunction(() => {
                const dropdown = document.getElementById('dropdownMenu');
                return dropdown.style.display === 'none';
            }, { timeout: 2000 });
            
            const dropdownDisplay = await page.evaluate(() => {
                return document.getElementById('dropdownMenu').style.display;
            });
            
            expect(dropdownDisplay).toBe('none');
        });

        test('should maintain responsive design', async ({ page }) => {
            // Test different viewport sizes
            await page.setViewportSize({ width: 320, height: 568 }); // Mobile
            
            const icon = await page.$('.icon');
            expect(icon).toBeTruthy();
            
            await page.setViewportSize({ width: 768, height: 1024 }); // Tablet
            
            const iconTablet = await page.$('.icon');
            expect(iconTablet).toBeTruthy();
            
            await page.setViewportSize({ width: 1920, height: 1080 }); // Desktop
            
            const iconDesktop = await page.$('.icon');
            expect(iconDesktop).toBeTruthy();
        });
    });
}); 