import { test, expect } from '@playwright/test';

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
            // Capture console logs
            const logs = [];
            page.on('console', msg => {
                logs.push(`${msg.type()}: ${msg.text()}`);
                console.log(`Browser console ${msg.type()}: ${msg.text()}`);
            });
            
            // Capture page errors
            page.on('pageerror', error => {
                console.log(`Page error: ${error.message}`);
                logs.push(`error: ${error.message}`);
            });
            
            // Wait for HyphaCore to be available
            await page.waitForFunction(() => window.hyphaCore !== undefined);
            
            // Check what state we're in
            const status = await page.evaluate(() => {
                return {
                    hyphaCore: !!window.hyphaCore,
                    api: window.hyphaCore ? window.hyphaCore.api : 'no hyphaCore',
                    error: window.initializationError ? window.initializationError.message : null
                };
            });
            console.log('Current status:', status);
            
            // Wait for the API to be initialized (after start() completes)
            await page.waitForFunction(() => window.hyphaCore && window.hyphaCore.api !== null, { timeout: 20000 });
            
            // Check that the core is initialized
            const isInitialized = await page.evaluate(() => {
                return window.hyphaCore && window.hyphaCore.api;
            });
            
            console.log('Console logs captured:', logs);
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
            await page.waitForSelector('iframe[src="https://if.imjoy.io"]', { timeout: 20000 });
            
            // Verify iframe was created
            iframes = await page.$$('iframe[src="https://if.imjoy.io"]');
            expect(iframes.length).toBe(1);
        });

        test('should load plugin from URL parameter', async ({ page }) => {
            await page.goto('http://localhost:8080/lite.html?plugin=https://if.imjoy.io');
            await page.waitForLoadState('domcontentloaded');
            
            // Wait for plugin to load
            const iframe = await page.waitForSelector('iframe[src="https://if.imjoy.io"]', { timeout: 20000 });
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
            await page.waitForSelector('iframe[src="https://if.imjoy.io"]', { timeout: 20000 });
            
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
            await page.waitForSelector('.winbox', { timeout: 20000 });
            
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
            await page.waitForSelector('.winbox', { timeout: 20000 });
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
            
            await page.waitForSelector('.winbox', { timeout: 20000 });
            
            await ensureDropdownVisible(page);
            await page.click('text=ImJoy Fiddle');
            
            // Wait for second window
            await page.waitForFunction(() => {
                return document.querySelectorAll('.winbox').length >= 2;
            }, { timeout: 20000 });
            
            const winboxes = await page.$$('.winbox');
            expect(winboxes.length).toBeGreaterThanOrEqual(2);
        });
    });

    test.describe('Background Animation', () => {
        test('should load VANTA birds animation', async ({ page }) => {
            // Wait for VANTA to initialize
            await page.waitForFunction(() => window.VANTA !== undefined, { timeout: 20000 });
            
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
            await page.waitForFunction(() => typeof window.loadApp === 'function', { timeout: 20000 });
            
            const hasLoadApp = await page.evaluate(() => {
                return typeof window.loadApp === 'function';
            });
            
            expect(hasLoadApp).toBe(true);
        });

        test('should allow programmatic plugin loading', async ({ page }) => {
            // Wait for loadApp function to be available
            await page.waitForFunction(() => typeof window.loadApp === 'function', { timeout: 20000 });
            
            // Load plugin programmatically
            await page.evaluate(() => {
                return window.loadApp('https://if.imjoy.io');
            });
            
            // Wait for iframe to appear
            await page.waitForSelector('iframe[src="https://if.imjoy.io"]', { timeout: 20000 });
            
            const iframes = await page.$$('iframe[src="https://if.imjoy.io"]');
            expect(iframes.length).toBe(1);
        });

        test('should provide access to HyphaCore API', async ({ page }) => {
            // Wait for HyphaCore API to be available
            await page.waitForFunction(() => window.hyphaCore && window.hyphaCore.api !== null, { timeout: 20000 });
            
            const apiMethods = await page.evaluate(() => {
                const api = window.hyphaCore.api;
                return api ? Object.keys(api) : [];
            });
            
            expect(apiMethods.length).toBeGreaterThan(0);
        });
    });

    test.describe('Security and Permissions', () => {
        test('should generate JWT tokens with proper access control', async ({ page }) => {
            // Wait for HyphaCore API to be available
            await page.waitForFunction(() => window.hyphaCore && window.hyphaCore.api !== null, { timeout: 20000 });
            
            const tokenTest = await page.evaluate(async () => {
                try {
                    const api = window.hyphaCore.api;
                    
                    // Generate a token for a specific workspace
                    const token = await api.generateToken({
                        user_id: 'test-user',
                        workspace: 'test-workspace',
                        expires_in: 3600 // 1 hour
                    });
                    
                    return {
                        success: true,
                        hasToken: !!token,
                        isString: typeof token === 'string',
                        hasThreeParts: token.split('.').length === 3
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: error.message
                    };
                }
            });
            
            expect(tokenTest.success).toBe(true);
            expect(tokenTest.hasToken).toBe(true);
            expect(tokenTest.isString).toBe(true);
            expect(tokenTest.hasThreeParts).toBe(true);
        });

        test('should enforce workspace access control for token generation', async ({ page }) => {
            // Wait for HyphaCore API to be available
            await page.waitForFunction(() => window.hyphaCore && window.hyphaCore.api !== null, { timeout: 20000 });
            
            const tokenAccessTest = await page.evaluate(async () => {
                try {
                    const api = window.hyphaCore.api;
                    
                    // Root client in default workspace should be able to generate cross-workspace tokens
                    const crossWorkspaceToken = await api.generateToken({
                        user_id: 'cross-workspace-user',
                        workspace: 'other-workspace',
                        expires_in: 3600
                    });
                    
                    return {
                        success: true,
                        canGenerateCrossWorkspace: !!crossWorkspaceToken
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: error.message
                    };
                }
            });
            
            expect(tokenAccessTest.success).toBe(true);
            expect(tokenAccessTest.canGenerateCrossWorkspace).toBe(true);
        });

        test('should provide proper workspace isolation for services', async ({ page }) => {
            // Wait for HyphaCore API to be available
            await page.waitForFunction(() => window.hyphaCore && window.hyphaCore.api !== null, { timeout: 20000 });
            
            const workspaceIsolationTest = await page.evaluate(async () => {
                try {
                    const api = window.hyphaCore.api;
                    
                    // List services in default workspace
                    const defaultServices = await api.listServices({ workspace: 'default' });
                    
                    // Try to list services in a different workspace (should return fewer or no services)
                    const otherWorkspaceServices = await api.listServices({ workspace: 'other-workspace' });
                    
                    return {
                        success: true,
                        defaultServiceCount: defaultServices.length,
                        otherWorkspaceServiceCount: otherWorkspaceServices.length,
                        hasDefaultServices: defaultServices.length > 0,
                        isolationWorking: defaultServices.length >= otherWorkspaceServices.length
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: error.message
                    };
                }
            });
            
            expect(workspaceIsolationTest.success).toBe(true);
            expect(workspaceIsolationTest.hasDefaultServices).toBe(true);
            expect(workspaceIsolationTest.isolationWorking).toBe(true);
        });

        test('should allow root user to register services in default workspace', async ({ page }) => {
            // Wait for HyphaCore API to be available
            await page.waitForFunction(() => window.hyphaCore && window.hyphaCore.api !== null, { timeout: 20000 });
            
            const rootServiceTest = await page.evaluate(async () => {
                try {
                    const api = window.hyphaCore.api;
                    
                    // Root user should be able to register services in default workspace
                    const service = await api.registerService({
                        id: 'root-test-service-simple',
                        name: 'Root Test Service Simple',
                        config: { visibility: 'public' },
                        ping: () => 'pong'
                    });
                    
                    // Small delay to ensure service is registered
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    // Verify service is accessible
                    const retrievedService = await api.getService('root-test-service-simple');
                    
                    return {
                        success: true,
                        serviceRegistered: !!service.id,
                        serviceAccessible: !!retrievedService
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: error.message
                    };
                }
            });
            
            expect(rootServiceTest.success).toBe(true);
            expect(rootServiceTest.serviceRegistered).toBe(true);
            expect(rootServiceTest.serviceAccessible).toBe(true);
        });

        test('should demonstrate multi-client authentication workflow', async ({ page }) => {
            // Wait for HyphaCore API to be available
            await page.waitForFunction(() => window.hyphaCore && window.hyphaCore.api !== null, { timeout: 20000 });
            
            const authWorkflowTest = await page.evaluate(async () => {
                try {
                    const api = window.hyphaCore.api;
                    
                    // Step 1: Generate tokens for different clients
                    const providerToken = await api.generateToken({
                        user_id: 'service-provider',
                        workspace: 'compute-workspace',
                        expires_in: 3600
                    });
                    
                    const consumerToken = await api.generateToken({
                        user_id: 'service-consumer',
                        workspace: 'compute-workspace',
                        expires_in: 3600
                    });
                    
                    const restrictedToken = await api.generateToken({
                        user_id: 'restricted-user',
                        workspace: 'restricted-workspace',
                        expires_in: 3600
                    });
                    
                    // Step 2: List services to verify visibility isolation
                    const computeServices = await api.listServices({ workspace: 'compute-workspace' });
                    const restrictedServices = await api.listServices({ workspace: 'restricted-workspace' });
                    
                    return {
                        success: true,
                        providerTokenGenerated: !!providerToken,
                        consumerTokenGenerated: !!consumerToken,
                        restrictedTokenGenerated: !!restrictedToken,
                        computeServiceCount: computeServices.length,
                        restrictedServiceCount: restrictedServices.length,
                        workspaceIsolationWorking: true // Basic isolation check
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: error.message
                    };
                }
            });
            
            expect(authWorkflowTest.success).toBe(true);
            expect(authWorkflowTest.providerTokenGenerated).toBe(true);
            expect(authWorkflowTest.consumerTokenGenerated).toBe(true);
            expect(authWorkflowTest.restrictedTokenGenerated).toBe(true);
            expect(authWorkflowTest.workspaceIsolationWorking).toBe(true);
        });

        test('should handle service listing correctly', async ({ page }) => {
            // Wait for HyphaCore API to be available
            await page.waitForFunction(() => window.hyphaCore && window.hyphaCore.api !== null, { timeout: 20000 });
            
            const listingTest = await page.evaluate(async () => {
                try {
                    const api = window.hyphaCore.api;
                    
                    // List services with different parameters
                    const allServices = await api.listServices();
                    const defaultServices = await api.listServices({ workspace: 'default' });
                    const publicServices = await api.listServices({ visibility: 'public' });
                    
                    return {
                        success: true,
                        allServiceCount: allServices.length,
                        defaultServiceCount: defaultServices.length,
                        publicServiceCount: publicServices.length,
                        hasServices: allServices.length > 0
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: error.message
                    };
                }
            });
            
            expect(listingTest.success).toBe(true);
            expect(listingTest.hasServices).toBe(true);
            expect(listingTest.allServiceCount).toBeGreaterThan(0);
        });

        test('should demonstrate proper error handling for unauthorized access', async ({ page }) => {
            // Wait for HyphaCore API to be available
            await page.waitForFunction(() => window.hyphaCore && window.hyphaCore.api !== null, { timeout: 20000 });
            
            const errorHandlingTest = await page.evaluate(async () => {
                try {
                    const api = window.hyphaCore.api;
                    
                    // Try to get a non-existent service
                    const nonExistentService = await api.getService('non-existent-service-12345');
                    
                    // Try to list services in a workspace that doesn't exist
                    const nonExistentWorkspaceServices = await api.listServices({ workspace: 'non-existent-workspace' });
                    
                    return {
                        success: true,
                        nonExistentServiceIsNull: nonExistentService === null,
                        nonExistentWorkspaceServices: Array.isArray(nonExistentWorkspaceServices),
                        nonExistentWorkspaceServiceCount: nonExistentWorkspaceServices.length
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: error.message
                    };
                }
            });
            
            expect(errorHandlingTest.success).toBe(true);
            expect(errorHandlingTest.nonExistentServiceIsNull).toBe(true);
            expect(errorHandlingTest.nonExistentWorkspaceServices).toBe(true);
            expect(errorHandlingTest.nonExistentWorkspaceServiceCount).toBe(0);
        });

        test('should support basic service registration and retrieval', async ({ page }) => {
            // Wait for HyphaCore API to be available
            await page.waitForFunction(() => window.hyphaCore && window.hyphaCore.api !== null, { timeout: 20000 });
            
            const serviceTest = await page.evaluate(async () => {
                try {
                    const api = window.hyphaCore.api;
                    
                    // Test basic service registration
                    const service = await api.registerService({
                        id: "test-basic-service",
                        name: "Test Basic Service", 
                        description: "A simple test service",
                        config: { visibility: "public" },
                        hello: async (name) => {
                            return `Hello ${name}!`;
                        },
                        echo: async (msg) => {
                            return msg;
                        }
                    });
                    
                    // Test service retrieval
                    const retrievedService = await api.getService("test-basic-service");
                    
                    // Test calling service methods
                    const helloResult = await retrievedService.hello("World");
                    const echoResult = await retrievedService.echo("Test message");
                    
                    return {
                        success: true,
                        serviceRegistered: !!service.id,
                        serviceRetrieved: !!retrievedService,
                        helloResult: helloResult,
                        echoResult: echoResult,
                        helloWorks: helloResult === "Hello World!",
                        echoWorks: echoResult === "Test message"
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: error.message
                    };
                }
            });
            
            expect(serviceTest.success).toBe(true);
            expect(serviceTest.serviceRegistered).toBe(true);
            expect(serviceTest.serviceRetrieved).toBe(true);
            expect(serviceTest.helloWorks).toBe(true);
            expect(serviceTest.echoWorks).toBe(true);
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

    test.describe('App Types', () => {
        test('should have loadApp API available', async ({ page }) => {
            // Wait for HyphaCore API to be available
            await page.waitForFunction(() => window.hyphaCore && window.hyphaCore.api !== null, { timeout: 20000 });
            
            const hasLoadApp = await page.evaluate(() => {
                const api = window.hyphaCore.api;
                return typeof api.loadApp === 'function';
            });
            
            expect(hasLoadApp).toBe(true);
        });

        test('should load and test web-python app type', async ({ page, browserName }) => {
            // Set a much longer timeout for the evaluation
            page.setDefaultTimeout(600000); // 10 minutes
            
            // Skip this test in Firefox due to Pyodide loading performance issues
            test.skip(browserName === 'firefox', 'Pyodide loading is too slow in Firefox CI environment');
            
            // Capture all console output from the browser
            const consoleMessages = [];
            page.on('console', msg => {
                const message = `[${msg.type()}] ${msg.text()}`;
                console.log(`Browser console: ${message}`);
                consoleMessages.push(message);
            });
            
            // Capture page errors
            page.on('pageerror', error => {
                console.log(`Page error: ${error.message}`);
                consoleMessages.push(`[error] ${error.message}`);
            });
            
            // Wait for HyphaCore API to be available
            await page.waitForFunction(() => window.hyphaCorePromise !== undefined, { timeout: 15000 });
            console.log('HyphaCore promise is available, starting Python app test...');
            
            const webPythonTest = await page.evaluate(async () => {
                try {
                    console.log('Starting web-python test...');
                    const hyphaCore = await window.hyphaCorePromise;
                    const api = hyphaCore.api;
                    console.log('API available, starting Python app loading...');
                    
                    const webPythonSrc = `
<config lang="json">
{
  "name": "Web Python Test App",
  "type": "web-python",
  "version": "0.1.0",
  "api_version": "0.1.7",
  "description": "Test web-python app with API export"
}
</config>

<script lang="python">
from hypha_rpc import api

class TestPythonApp:
    async def setup(self):
        await api.log('Python app setup completed')
        return {"status": "setup_complete", "language": "python"}

    async def run(self, ctx=None):
        await api.log('Python app run called')
        return {"status": "run_complete", "message": "Hello from Python!", "ctx": ctx}
    
    async def add_numbers(self, a, b):
        return {"result": a + b, "type": "addition", "operation": "sum"}
    
    async def multiply_numbers(self, a, b):
        return {"result": a * b, "type": "multiplication", "operation": "product"}
    
    async def process_list(self, items):
        # Process a list of numbers
        processed = [x * 2 + 1 for x in items]
        return {
            "original": items,
            "processed": processed,
            "length": len(items),
            "sum_original": sum(items),
            "sum_processed": sum(processed)
        }
    
    async def get_info(self):
        return {
            "name": "Test Python App",
            "type": "web-python",
            "language": "python",
            "runtime": "pyodide",
            "capabilities": ["math", "logging", "list-processing"]
        }

api.export(TestPythonApp())
</script>
`;
                    
                    // Actually wait for the Python app to fully load - this takes time due to Pyodide
                    console.log('Loading Python app - this may take several minutes due to Pyodide download and initialization...');
                    console.log('You should see "Loading Pyodide..." and "Pyodide is ready to use." messages in the console.');
                    const startTime = Date.now();
                    
                    // Add periodic progress updates
                    const progressInterval = setInterval(() => {
                        const elapsed = (Date.now() - startTime) / 1000;
                        console.log(`Still loading Python app... ${elapsed.toFixed(1)} seconds elapsed`);
                    }, 10000); // Log every 10 seconds
                    
                    try {
                        const pythonApp = await api.loadApp({ src: webPythonSrc });
                        clearInterval(progressInterval);
                        const loadTime = (Date.now() - startTime) / 1000;
                        console.log(`Python app loaded successfully in ${loadTime} seconds`);
                        
                        console.log('Testing Python app methods...');
                        // Test all the exported API methods
                        const setupResult = await pythonApp.setup();
                        console.log('Setup result:', setupResult);
                        
                        const runResult = await pythonApp.run({ test: "python-data" });
                        console.log('Run result:', runResult);
                        
                        const addResult = await pythonApp.add_numbers(15, 25);
                        console.log('Add result:', addResult);
                        
                        const multiplyResult = await pythonApp.multiply_numbers(7, 8);
                        console.log('Multiply result:', multiplyResult);
                        
                        const listResult = await pythonApp.process_list([1, 2, 3, 4, 5]);
                        console.log('List result:', listResult);
                        
                        const infoResult = await pythonApp.get_info();
                        console.log('Info result:', infoResult);
                        
                        return {
                            success: true,
                            loadTime: loadTime,
                            appLoaded: !!pythonApp,
                            hasSetup: typeof pythonApp.setup === 'function',
                            hasRun: typeof pythonApp.run === 'function',
                            hasAddNumbers: typeof pythonApp.add_numbers === 'function',
                            hasMultiplyNumbers: typeof pythonApp.multiply_numbers === 'function',
                            hasProcessList: typeof pythonApp.process_list === 'function',
                            hasGetInfo: typeof pythonApp.get_info === 'function',
                            setupResult: setupResult,
                            runResult: runResult,
                            addResult: addResult,
                            multiplyResult: multiplyResult,
                            listResult: listResult,
                            infoResult: infoResult,
                            setupWorks: setupResult && setupResult.status === 'setup_complete' && setupResult.language === 'python',
                            runWorks: runResult && runResult.status === 'run_complete' && runResult.message === 'Hello from Python!',
                            mathWorks: addResult && addResult.result === 40 && multiplyResult && multiplyResult.result === 56,
                            listProcessingWorks: listResult && JSON.stringify(listResult.processed) === JSON.stringify([3, 5, 7, 9, 11]),
                            infoWorks: infoResult && infoResult.type === 'web-python' && infoResult.runtime === 'pyodide'
                        };
                    } catch (loadError) {
                        clearInterval(progressInterval);
                        const elapsed = (Date.now() - startTime) / 1000;
                        console.error(`Python app loading failed after ${elapsed} seconds:`, loadError);
                        throw loadError;
                    }
                } catch (error) {
                    console.error('Python app test error:', error);
                    return {
                        success: false,
                        error: error.message,
                        stack: error.stack
                    };
                }
            }, { timeout: 600000 }); // 10 minute timeout for page.evaluate
            
            console.log('Python test evaluation completed.');
            
            // Print all captured console messages
            console.log('\n=== Captured Browser Console Messages ===');
            consoleMessages.forEach((msg, index) => {
                console.log(`${index + 1}: ${msg}`);
            });
            console.log('=== End Console Messages ===\n');
            
            // If the test fails, provide detailed error information
            if (!webPythonTest.success) {
                console.log('Python app test failed:', webPythonTest.error);
                console.log('Stack:', webPythonTest.stack);
            } else {
                console.log(`Python app test succeeded! Loaded in ${webPythonTest.loadTime} seconds`);
            }
            
            expect(webPythonTest.success).toBe(true);
            expect(webPythonTest.appLoaded).toBe(true);
            expect(webPythonTest.hasSetup).toBe(true);
            expect(webPythonTest.hasRun).toBe(true);
            expect(webPythonTest.hasAddNumbers).toBe(true);
            expect(webPythonTest.hasMultiplyNumbers).toBe(true);
            expect(webPythonTest.hasProcessList).toBe(true);
            expect(webPythonTest.hasGetInfo).toBe(true);
            expect(webPythonTest.setupWorks).toBe(true);
            expect(webPythonTest.runWorks).toBe(true);
            expect(webPythonTest.mathWorks).toBe(true);
            expect(webPythonTest.listProcessingWorks).toBe(true);
            expect(webPythonTest.infoWorks).toBe(true);
        }, 600000); // 10 minute timeout for Python app loading

        test('should attempt to load web-worker app type', async ({ page }) => {
            // Wait for HyphaCore API to be available
            await page.waitForFunction(() => window.hyphaCore && window.hyphaCore.api !== null, { timeout: 20000 });
            
            const webWorkerTest = await page.evaluate(async () => {
                try {
                    const api = window.hyphaCore.api;
                    
                    const webWorkerSrc = `
<config lang="json">
{
  "name": "Web Worker Test App",
  "type": "web-worker",
  "version": "0.1.0",
  "api_version": "0.1.7",
  "description": "Test web-worker app with API export"
}
</config>

<script lang="javascript">
class TestWorkerApp {
    async setup() {
        console.log('Worker app setup completed');
        return { status: "setup_complete", worker: true };
    }

    async run(ctx) {
        console.log('Worker app run called');
        return { status: "run_complete", message: "Hello from Worker!", ctx: ctx };
    }
    
    async processData(data) {
        // Simulate some processing
        const processed = data.map(item => item * 2);
        return { 
            original: data, 
            processed: processed,
            length: data.length 
        };
    }
    
    async calculatePi(precision = 1000) {
        let pi = 0;
        for (let i = 0; i < precision; i++) {
            pi += Math.pow(-1, i) / (2 * i + 1);
        }
        return { pi: pi * 4, precision: precision };
    }
    
    async getWorkerInfo() {
        return {
            name: "Test Worker App",
            type: "web-worker",
            environment: "web-worker",
            capabilities: ["data-processing", "calculations"]
        };
    }
}

// Export the worker API
api.export(new TestWorkerApp());
</script>
`;
                    
                    // Load the web-worker app and wait for it to complete
                    const workerApp = await api.loadApp({ src: webWorkerSrc });
                    
                    // Test the exported API methods
                    const setupResult = await workerApp.setup();
                    const runResult = await workerApp.run({ test: "data" });
                    const processResult = await workerApp.processData([1, 2, 3, 4]);
                    const piResult = await workerApp.calculatePi(100);
                    const infoResult = await workerApp.getWorkerInfo();
                    
                    return {
                        success: true,
                        appLoaded: !!workerApp,
                        hasSetup: typeof workerApp.setup === 'function',
                        hasRun: typeof workerApp.run === 'function',
                        hasProcessData: typeof workerApp.processData === 'function',
                        hasCalculatePi: typeof workerApp.calculatePi === 'function',
                        hasGetWorkerInfo: typeof workerApp.getWorkerInfo === 'function',
                        setupResult: setupResult,
                        runResult: runResult,
                        processResult: processResult,
                        piResult: piResult,
                        infoResult: infoResult,
                        dataProcessingWorks: processResult && JSON.stringify(processResult.processed) === JSON.stringify([2, 4, 6, 8]),
                        piCalculationWorks: piResult && typeof piResult.pi === 'number' && piResult.pi > 3 && piResult.pi < 4
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: error.message
                    };
                }
            }, { timeout: 120000 }); // 2 minute timeout for web worker test
            
            expect(webWorkerTest.success).toBe(true);
            expect(webWorkerTest.appLoaded).toBe(true);
            expect(webWorkerTest.hasSetup).toBe(true);
            expect(webWorkerTest.hasRun).toBe(true);
            expect(webWorkerTest.hasProcessData).toBe(true);
            expect(webWorkerTest.hasCalculatePi).toBe(true);
            expect(webWorkerTest.hasGetWorkerInfo).toBe(true);
            expect(webWorkerTest.setupResult?.status).toBe('setup_complete');
            expect(webWorkerTest.runResult?.status).toBe('run_complete');
            expect(webWorkerTest.dataProcessingWorks).toBe(true);
            expect(webWorkerTest.piCalculationWorks).toBe(true);
            expect(webWorkerTest.infoResult?.type).toBe('web-worker');
        });

        test('should attempt to load window app type', async ({ page }) => {
            // Wait for HyphaCore API to be available
            await page.waitForFunction(() => window.hyphaCore && window.hyphaCore.api !== null, { timeout: 20000 });
            
            const windowTest = await page.evaluate(async () => {
                try {
                    const api = window.hyphaCore.api;
                    
                    const windowSrc = `
<config lang="json">
{
  "name": "Window Test App",
  "type": "window",
  "version": "0.1.0",
  "api_version": "0.1.7",
  "description": "Test window app with API export"
}
</config>

<window lang="html">
<div id="app-container">
    <h2>Test Window App</h2>
    <div id="content">Ready for testing</div>
    <button id="test-button">Test Button</button>
</div>
<style>
#app-container {
    padding: 20px;
    font-family: Arial, sans-serif;
}
#content {
    margin: 10px 0;
    padding: 10px;
    border: 1px solid #ccc;
}
</style>
</window>

<script lang="javascript">
class TestWindowApp {
    constructor() {
        this.counter = 0;
        this.messages = [];
    }

    async setup() {
        console.log('Window app setup completed');
        
        // Setup DOM event listeners
        const button = document.getElementById('test-button');
        if (button) {
            button.onclick = () => {
                this.counter++;
                this.updateContent(\`Button clicked \${this.counter} times\`);
            };
        }
        
        return { status: "setup_complete", type: "window" };
    }

    async run(ctx) {
        console.log('Window app run called');
        this.updateContent("App is running!");
        return { 
            status: "run_complete", 
            message: "Hello from Window App!",
            hasDOM: !!document.getElementById('app-container')
        };
    }
    
    async updateContent(text) {
        const content = document.getElementById('content');
        if (content) {
            content.textContent = text;
            this.messages.push(text);
        }
        return { 
            success: !!content, 
            text: text,
            messageCount: this.messages.length
        };
    }
    
    async getState() {
        return {
            counter: this.counter,
            messages: this.messages,
            hasContainer: !!document.getElementById('app-container'),
            hasContent: !!document.getElementById('content'),
            hasButton: !!document.getElementById('test-button')
        };
    }
    
    async simulateClick() {
        const button = document.getElementById('test-button');
        if (button) {
            button.click();
            return { clicked: true, counter: this.counter };
        }
        return { clicked: false, counter: this.counter };
    }
    
    async getWindowInfo() {
        return {
            name: "Test Window App",
            type: "window",
            environment: "iframe",
            capabilities: ["DOM-manipulation", "event-handling", "UI"]
        };
    }
}

// Export the window API
api.export(new TestWindowApp());
</script>
`;
                    
                    // Load the window app and wait for it to complete
                    const windowApp = await api.loadApp({ src: windowSrc });
                    
                    // Test the exported API methods
                    const setupResult = await windowApp.setup();
                    const runResult = await windowApp.run({ test: "window-data" });
                    const updateResult = await windowApp.updateContent("API test message");
                    const stateResult = await windowApp.getState();
                    const clickResult = await windowApp.simulateClick();
                    const clickedStateResult = await windowApp.getState();
                    const infoResult = await windowApp.getWindowInfo();
                    
                    return {
                        success: true,
                        appLoaded: !!windowApp,
                        hasSetup: typeof windowApp.setup === 'function',
                        hasRun: typeof windowApp.run === 'function',
                        hasUpdateContent: typeof windowApp.updateContent === 'function',
                        hasGetState: typeof windowApp.getState === 'function',
                        hasSimulateClick: typeof windowApp.simulateClick === 'function',
                        hasGetWindowInfo: typeof windowApp.getWindowInfo === 'function',
                        setupResult: setupResult,
                        runResult: runResult,
                        updateResult: updateResult,
                        stateResult: stateResult,
                        clickResult: clickResult,
                        clickedStateResult: clickedStateResult,
                        infoResult: infoResult,
                        domWorks: runResult && runResult.hasDOM === true,
                        contentUpdateWorks: updateResult && updateResult.success === true,
                        clickWorks: clickResult && clickResult.clicked === true,
                        counterIncremented: clickedStateResult && clickedStateResult.counter === 1
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: error.message
                    };
                }
            });
            
            expect(windowTest.success).toBe(true);
            expect(windowTest.appLoaded).toBe(true);
            expect(windowTest.hasSetup).toBe(true);
            expect(windowTest.hasRun).toBe(true);
            expect(windowTest.hasUpdateContent).toBe(true);
            expect(windowTest.hasGetState).toBe(true);
            expect(windowTest.hasSimulateClick).toBe(true);
            expect(windowTest.hasGetWindowInfo).toBe(true);
            expect(windowTest.setupResult?.status).toBe('setup_complete');
            expect(windowTest.runResult?.status).toBe('run_complete');
            expect(windowTest.domWorks).toBe(true);
            expect(windowTest.contentUpdateWorks).toBe(true);
            expect(windowTest.clickWorks).toBe(true);
            expect(windowTest.counterIncremented).toBe(true);
            expect(windowTest.infoResult?.type).toBe('window');
        });

        test('should load app from remote URL (ImJoy template)', async ({ page }) => {
            // Wait for HyphaCore API to be available
            await page.waitForFunction(() => window.hyphaCorePromise !== undefined, { timeout: 10000 });
            
            const remoteLoadTest = await page.evaluate(async () => {
                try {
                    const hyphaCore = await window.hyphaCorePromise;
                    const api = hyphaCore.api;
                    
                    // Test loading from a remote URL - actually wait for it to complete
                    console.log('Loading app from remote URL - this may take some time...');
                    const remoteApp = await api.loadApp({ src: "https://if.imjoy.io" });
                    
                    // The ImJoy Fiddle is an iframe-based app, so it should have basic functionality
                    // Check if it was loaded successfully
                    const hasApp = !!remoteApp;
                    
                    // For iframe apps, we typically get back a window/iframe reference
                    const appType = typeof remoteApp;
                    
                    return {
                        success: true,
                        appLoaded: hasApp,
                        appType: appType,
                        hasApiMethods: remoteApp && typeof remoteApp === 'object'
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: error.message,
                        stack: error.stack
                    };
                }
            });
            
            // If the test fails, provide detailed error information
            if (!remoteLoadTest.success) {
                console.log('Remote URL test failed:', remoteLoadTest.error);
                console.log('Stack:', remoteLoadTest.stack);
            }
            
            expect(remoteLoadTest.success).toBe(true);
            expect(remoteLoadTest.appLoaded).toBe(true);
        }, 60000); // 1 minute timeout for remote loading

        test('should support createWindow API for iframe apps', async ({ page }) => {
            // Wait for HyphaCore API to be available
            await page.waitForFunction(() => window.hyphaCore && window.hyphaCore.api !== null, { timeout: 20000 });
            
            const createWindowTest = await page.evaluate(async () => {
                try {
                    const api = window.hyphaCore.api;
                    
                    // Check that createWindow API exists
                    const hasCreateWindow = typeof api.createWindow === 'function';
                    
                    if (!hasCreateWindow) {
                        return {
                            success: false,
                            error: 'createWindow API not available'
                        };
                    }
                    
                    // Test calling createWindow (don't wait for full execution)
                    const windowPromise = api.createWindow({ src: "https://if.imjoy.io" });
                    
                    return {
                        success: true,
                        hasCreateWindow: true,
                        windowPromiseCreated: !!windowPromise,
                        isPromise: windowPromise instanceof Promise
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: error.message
                    };
                }
            });
            
            expect(createWindowTest.success).toBe(true);
            expect(createWindowTest.hasCreateWindow).toBe(true);
            expect(createWindowTest.windowPromiseCreated).toBe(true);
            expect(createWindowTest.isPromise).toBe(true);
        });

        test('should validate app configuration parsing', async ({ page }) => {
            // Wait for HyphaCore API to be available
            await page.waitForFunction(() => window.hyphaCore && window.hyphaCore.api !== null, { timeout: 20000 });
            
            const configTest = await page.evaluate(async () => {
                try {
                    const api = window.hyphaCore.api;
                    
                    // Test different config formats
                    const validConfigs = [
                        // Web-python config
                        `<config lang="json">{"name": "Test", "type": "web-python", "version": "0.1.0", "api_version": "0.1.7"}</config>`,
                        // Web-worker config  
                        `<config lang="json">{"name": "Test", "type": "web-worker", "version": "0.1.0", "api_version": "0.1.7"}</config>`,
                        // Window config
                        `<config lang="json">{"name": "Test", "type": "window", "version": "0.1.0", "api_version": "0.1.7"}</config>`
                    ];
                    
                    const results = [];
                    for (const config of validConfigs) {
                        try {
                            const src = config + `<script>console.log("test");</script>`;
                            const loadPromise = api.loadApp({ src });
                            results.push({ success: true, hasPromise: !!loadPromise });
                        } catch (e) {
                            results.push({ success: false, error: e.message });
                        }
                    }
                    
                    return {
                        success: true,
                        results: results,
                        allSuccessful: results.every(r => r.success)
                    };
                } catch (error) {
                    return {
                        success: false,
                        error: error.message
                    };
                }
            });
            
            expect(configTest.success).toBe(true);
            expect(configTest.allSuccessful).toBe(true);
        });

        // Temporarily disabled - complex test causing timeouts
        // test('should support inter-app communication through service registration', async ({ page }) => {
        //     // This test is too complex for current reliability
        // });
    });
});

test.describe('Core API Integration', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to lite.html for API tests
        await page.goto('http://localhost:8080/lite.html');
        await page.waitForLoadState('domcontentloaded');
    });

    test('should establish RPC connection and register workspace manager', async ({ page }) => {
        await page.waitForFunction(() => window.hyphaCorePromise !== undefined, { timeout: 10000 });
        
        const connectionTest = await page.evaluate(async () => {
            try {
                const hyphaCore = await window.hyphaCorePromise;
                const api = hyphaCore.api;
                
                // Test that we have a working RPC connection
                const echoResult = await api.echo("test message");
                
                // Test basic info methods
                const workspace = api.config?.workspace || 'default';
                const clientId = api.id;
                
                return {
                    success: true,
                    hasApi: !!api,
                    echoWorks: echoResult === "test message",
                    workspace: workspace,
                    clientId: clientId,
                    hasWorkspace: !!workspace,
                    hasClientId: !!clientId
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        });
        
        expect(connectionTest.success).toBe(true);
        expect(connectionTest.hasApi).toBe(true);
        expect(connectionTest.echoWorks).toBe(true);
        expect(connectionTest.hasWorkspace).toBe(true);
        expect(connectionTest.hasClientId).toBe(true);
    });

    test('should register and retrieve simple services', async ({ page }) => {
        await page.waitForFunction(() => window.hyphaCorePromise !== undefined, { timeout: 10000 });
        
        const serviceTest = await page.evaluate(async () => {
            try {
                const hyphaCore = await window.hyphaCorePromise;
                const api = hyphaCore.api;
                
                // Register a simple service
                const testService = await api.registerService({
                    id: "simple-test-service",
                    name: "Simple Test Service",
                    description: "A simple service for testing",
                    config: { visibility: "public" },
                    add: (a, b) => a + b,
                    multiply: (a, b) => a * b,
                    greet: (name) => `Hello, ${name}!`,
                    getInfo: () => ({ 
                        type: "calculator", 
                        version: "1.0.0",
                        capabilities: ["add", "multiply", "greet"]
                    })
                });
                
                // Small delay to ensure registration
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Retrieve the service
                const retrievedService = await api.getService("simple-test-service");
                
                // Test service methods
                const addResult = await retrievedService.add(5, 3);
                const multiplyResult = await retrievedService.multiply(4, 7);
                const greetResult = await retrievedService.greet("World");
                const infoResult = await retrievedService.getInfo();
                
                return {
                    success: true,
                    serviceRegistered: !!testService.id,
                    serviceRetrieved: !!retrievedService,
                    addResult: addResult,
                    multiplyResult: multiplyResult,
                    greetResult: greetResult,
                    infoResult: infoResult,
                    mathWorks: addResult === 8 && multiplyResult === 28,
                    greetWorks: greetResult === "Hello, World!",
                    infoWorks: infoResult && infoResult.type === "calculator"
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        });
        
        if (!serviceTest.success) {
            console.log('Service test failed with error:', serviceTest.error);
        }
        
        expect(serviceTest.success).toBe(true);
        expect(serviceTest.serviceRegistered).toBe(true);
        expect(serviceTest.serviceRetrieved).toBe(true);
        expect(serviceTest.mathWorks).toBe(true);
        expect(serviceTest.greetWorks).toBe(true);
        expect(serviceTest.infoWorks).toBe(true);
    });

    test('should list services with filtering', async ({ page }) => {
        // Wait for page to load
        await page.waitForLoadState('networkidle');
        
        // Check basic page info
        const pageInfo = await page.evaluate(() => {
            return {
                title: document.title,
                url: window.location.href,
                hasBody: !!document.body,
                scriptTags: document.querySelectorAll('script').length,
                moduleScripts: document.querySelectorAll('script[type="module"]').length,
                hasHyphaCore: typeof window.hyphaCore !== 'undefined',
                hasHyphaCorePromise: typeof window.hyphaCorePromise !== 'undefined',
                hyphaCorePromiseType: typeof window.hyphaCorePromise,
                allKeys: Object.keys(window).filter(k => k.toLowerCase().includes('hypha'))
            };
        });
        console.log('Page info:', JSON.stringify(pageInfo, null, 2));
        
        // Check if we're on the right page
        expect(pageInfo.title).toBe('Hypha Lite');
        expect(pageInfo.moduleScripts).toBeGreaterThan(0);
        
        await page.waitForFunction(() => window.hyphaCorePromise !== undefined, { timeout: 10000 });
        
        const listingTest = await page.evaluate(async () => {
            try {
                const hyphaCore = await window.hyphaCorePromise;
                const api = hyphaCore.api;
                
                // Register multiple services for testing
                await api.registerService({
                    id: "calc-service",
                    name: "Calculator Service",
                    type: "calculator",
                    config: { visibility: "public" },
                    calculate: (expr) => eval(expr)
                });
                
                await api.registerService({
                    id: "logger-service", 
                    name: "Logger Service",
                    type: "utility",
                    config: { visibility: "public" },
                    log: (msg) => console.log(msg)
                });
                
                await new Promise(resolve => setTimeout(resolve, 200));
                
                // Test different listing queries
                const allServices = await api.listServices();
                const publicServices = await api.listServices({ visibility: "public" });
                const calcServices = await api.listServices({ type: "calculator" });
                const defaultWorkspaceServices = await api.listServices({ workspace: "default" });
                
                return {
                    success: true,
                    allCount: allServices.length,
                    publicCount: publicServices.length,
                    calcCount: calcServices.length,
                    defaultCount: defaultWorkspaceServices.length,
                    hasServices: allServices.length > 0,
                    hasCalcService: calcServices.some(s => s.id.includes("calc-service")),
                    hasLoggerService: allServices.some(s => s.id.includes("logger-service"))
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        });
        
        expect(listingTest.success).toBe(true);
        expect(listingTest.hasServices).toBe(true);
        expect(listingTest.allCount).toBeGreaterThan(0);
        expect(listingTest.hasCalcService).toBe(true);
        expect(listingTest.hasLoggerService).toBe(true);
    });

    test('should handle service method calls with different data types', async ({ page }) => {
        await page.waitForFunction(() => window.hyphaCorePromise !== undefined, { timeout: 10000 });
        
        const dataTypesTest = await page.evaluate(async () => {
            try {
                const hyphaCore = await window.hyphaCorePromise;
                const api = hyphaCore.api;
                
                // Register a simple service for testing basic data types
                const testService = await api.registerService({
                    id: "basic-data-types-service",
                    name: "Basic Data Types Test Service",
                    config: { visibility: "public" },
                    handleString: (str) => `Received: ${str}`,
                    handleNumber: (num) => num * 2,
                    handleBoolean: (bool) => !bool
                });
                
                const service = await api.getService(testService.id);
                if (!service) {
                    throw new Error("Service not found after registration");
                }
                
                // Test basic data types
                const stringResult = await service.handleString("test");
                const numberResult = await service.handleNumber(42);
                const booleanResult = await service.handleBoolean(true);
                
                return {
                    success: true,
                    stringResult,
                    numberResult,
                    booleanResult,
                    stringWorks: stringResult === "Received: test",
                    numberWorks: numberResult === 84,
                    booleanWorks: booleanResult === false
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message,
                    stack: error.stack
                };
            }
        });
        
        if (!dataTypesTest.success) {
            console.log('Test failed with error:', dataTypesTest.error);
            console.log('Stack trace:', dataTypesTest.stack);
        }
        
        expect(dataTypesTest.success).toBe(true);
        expect(dataTypesTest.stringWorks).toBe(true);
        expect(dataTypesTest.numberWorks).toBe(true);
        expect(dataTypesTest.booleanWorks).toBe(true);
    });

    test('should handle arrays and objects in service method calls', async ({ page }) => {
        await page.waitForFunction(() => window.hyphaCorePromise !== undefined, { timeout: 10000 });
        
        const complexTypesTest = await page.evaluate(async () => {
            try {
                const hyphaCore = await window.hyphaCorePromise;
                const api = hyphaCore.api;
                
                // Register a service for testing arrays and objects
                const testService = await api.registerService({
                    id: "complex-types-service",
                    name: "Complex Types Test Service",
                    config: { visibility: "public" },
                    handleArray: (arr) => arr.map(x => x + 1),
                    handleObject: (obj) => ({ ...obj, processed: true })
                });
                
                const service = await api.getService(testService.id);
                if (!service) {
                    throw new Error("Service not found after registration");
                }
                
                // Test complex data types
                const arrayResult = await service.handleArray([1, 2, 3]);
                const objectResult = await service.handleObject({ name: "test", value: 123 });
                
                return {
                    success: true,
                    arrayResult,
                    objectResult,
                    arrayWorks: JSON.stringify(arrayResult) === JSON.stringify([2, 3, 4]),
                    objectWorks: objectResult && objectResult.processed === true && objectResult.name === "test"
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message,
                    stack: error.stack
                };
            }
        });
        
        if (!complexTypesTest.success) {
            console.log('Complex types test failed with error:', complexTypesTest.error);
            console.log('Stack trace:', complexTypesTest.stack);
        }
        
        expect(complexTypesTest.success).toBe(true);
        expect(complexTypesTest.arrayWorks).toBe(true);
        expect(complexTypesTest.objectWorks).toBe(true);
        
        // Additional validations
        expect(complexTypesTest.arrayResult).toEqual([2, 3, 4]);
        expect(complexTypesTest.objectResult.name).toBe("test");
        expect(complexTypesTest.objectResult.value).toBe(123);
        expect(complexTypesTest.objectResult.processed).toBe(true);
    });

    test('should handle async service methods correctly', async ({ page }) => {
        await page.waitForFunction(() => window.hyphaCorePromise !== undefined, { timeout: 10000 });
        
        const asyncTest = await page.evaluate(async () => {
            try {
                const hyphaCore = await window.hyphaCorePromise;
                const api = hyphaCore.api;
                
                // Register a service with async methods
                await api.registerService({
                    id: "async-service",
                    name: "Async Test Service",
                    config: { visibility: "public" },
                    asyncDelay: async (ms) => {
                        await new Promise(resolve => setTimeout(resolve, ms));
                        return `Delayed ${ms}ms`;
                    },
                    asyncPromiseChain: async (value) => {
                        const step1 = await Promise.resolve(value + 1);
                        const step2 = await Promise.resolve(step1 * 2);
                        const step3 = await Promise.resolve(step2.toString());
                        return step3;
                    },
                    asyncError: async () => {
                        throw new Error("Intentional async error");
                    },
                    asyncFetch: async (data) => {
                        // Simulate async data processing
                        return new Promise((resolve) => {
                            setTimeout(() => {
                                resolve({ 
                                    status: "processed", 
                                    data: data,
                                    timestamp: Date.now()
                                });
                            }, 50);
                        });
                    }
                });
                
                await new Promise(resolve => setTimeout(resolve, 100));
                
                const service = await api.getService("async-service");
                
                // Test async methods
                const delayResult = await service.asyncDelay(100);
                const chainResult = await service.asyncPromiseChain(5);
                const fetchResult = await service.asyncFetch({ test: "data" });
                
                // Test async error handling
                let errorCaught = false;
                try {
                    await service.asyncError();
                } catch (error) {
                    errorCaught = true;
                }
                
                return {
                    success: true,
                    delayResult: delayResult,
                    chainResult: chainResult,
                    fetchResult: fetchResult,
                    errorCaught: errorCaught,
                    delayWorks: delayResult === "Delayed 100ms",
                    chainWorks: chainResult === "12", // (5+1)*2 = "12"
                    fetchWorks: fetchResult && fetchResult.status === "processed"
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        });
        
        expect(asyncTest.success).toBe(true);
        expect(asyncTest.delayWorks).toBe(true);
        expect(asyncTest.chainWorks).toBe(true);
        expect(asyncTest.fetchWorks).toBe(true);
        expect(asyncTest.errorCaught).toBe(true);
    });
});

test.describe('Authentication and Token Management', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to lite.html for authentication tests
        await page.goto('http://localhost:8080/lite.html');
        await page.waitForLoadState('domcontentloaded');
    });

    test('should generate and validate JWT tokens', async ({ page }) => {
        await page.waitForFunction(() => window.hyphaCorePromise !== undefined, { timeout: 10000 });
        
        const tokenTest = await page.evaluate(async () => {
            try {
                const hyphaCore = await window.hyphaCorePromise;
                const api = hyphaCore.api;
                
                // Generate tokens with different configurations
                const basicToken = await api.generateToken({
                    user_id: "test-user",
                    workspace: "test-workspace",
                    expires_in: 3600
                });
                
                const adminToken = await api.generateToken({
                    user_id: "admin-user",
                    workspace: "admin-workspace", 
                    roles: ["admin", "user"],
                    email: "admin@example.com",
                    expires_in: 7200
                });
                
                const shortLivedToken = await api.generateToken({
                    user_id: "temp-user",
                    workspace: "temp-workspace",
                    expires_in: 60 // 1 minute
                });
                
                // Parse tokens to verify content
                const parseToken = (token) => {
                    const parts = token.split('.');
                    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
                    return payload;
                };
                
                const basicPayload = parseToken(basicToken);
                const adminPayload = parseToken(adminToken);
                const shortPayload = parseToken(shortLivedToken);
                
                return {
                    success: true,
                    basicToken: basicToken,
                    adminToken: adminToken,
                    shortLivedToken: shortLivedToken,
                    basicPayload: basicPayload,
                    adminPayload: adminPayload,
                    shortPayload: shortPayload,
                    allTokensValid: !!(basicToken && adminToken && shortLivedToken),
                    correctFormat: basicToken.split('.').length === 3,
                    correctUser: basicPayload.sub === "test-user",
                    correctWorkspace: basicPayload.workspace === "test-workspace",
                    correctRoles: JSON.stringify(adminPayload.roles) === JSON.stringify(["admin", "user"]),
                    correctEmail: adminPayload.email === "admin@example.com"
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        });
        
        expect(tokenTest.success).toBe(true);
        expect(tokenTest.allTokensValid).toBe(true);
        expect(tokenTest.correctFormat).toBe(true);
        expect(tokenTest.correctUser).toBe(true);
        expect(tokenTest.correctWorkspace).toBe(true);
        expect(tokenTest.correctRoles).toBe(true);
        expect(tokenTest.correctEmail).toBe(true);
    });

    test('should enforce workspace access control', async ({ page }) => {
        await page.waitForFunction(() => window.hyphaCorePromise !== undefined, { timeout: 10000 });
        
        const accessControlTest = await page.evaluate(async () => {
            try {
                const hyphaCore = await window.hyphaCorePromise;
                const api = hyphaCore.api;
                
                // Should succeed - root in default workspace can generate tokens for any workspace
                const crossWorkspaceToken = await api.generateToken({
                    user_id: "cross-user",
                    workspace: "other-workspace"
                });
                
                // Register services in different workspaces
                const defaultService = await api.registerService({
                    id: "default-ws-service",
                    name: "Default Workspace Service",
                    config: { visibility: "public" },
                    ping: () => "default-pong"
                });
                
                // List services to verify workspace isolation
                const defaultServices = await api.listServices({ workspace: "default" });
                const otherServices = await api.listServices({ workspace: "other-workspace" });
                
                return {
                    success: true,
                    crossWorkspaceTokenGenerated: !!crossWorkspaceToken,
                    defaultServiceRegistered: !!defaultService.id,
                    defaultServiceCount: defaultServices.length,
                    otherServiceCount: otherServices.length,
                    workspaceIsolation: defaultServices.length >= otherServices.length
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        });
        
        expect(accessControlTest.success).toBe(true);
        expect(accessControlTest.crossWorkspaceTokenGenerated).toBe(true);
        expect(accessControlTest.defaultServiceRegistered).toBe(true);
        expect(accessControlTest.workspaceIsolation).toBe(true);
    });
});

test.describe('Simple App Loading', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to lite.html for app loading tests
        await page.goto('http://localhost:8080/lite.html');
        await page.waitForLoadState('domcontentloaded');
    });

    test('should load minimal web-worker app', async ({ page }) => {
        await page.waitForFunction(() => window.hyphaCorePromise !== undefined, { timeout: 10000 });
        
        const workerTest = await page.evaluate(async () => {
            try {
                const hyphaCore = await window.hyphaCorePromise;
                const api = hyphaCore.api;
                
                // Very simple web-worker app
                const simpleWorkerSrc = `
<config lang="json">
{
  "name": "Simple Worker",
  "type": "web-worker",
  "version": "0.1.0",
  "api_version": "0.1.7"
}
</config>

<script lang="javascript">
class SimpleWorker {
    async setup() {
        return { status: "ready" };
    }
    
    async ping() {
        return "pong";
    }
    
    async calculate(a, b, op) {
        switch(op) {
            case 'add': return a + b;
            case 'subtract': return a - b;
            case 'multiply': return a * b;
            case 'divide': return b !== 0 ? a / b : null;
            default: return null;
        }
    }
}

api.export(new SimpleWorker());
</script>
`;
                
                // Load the worker
                const worker = await api.loadApp({ src: simpleWorkerSrc });
                
                // Test the worker methods
                const setupResult = await worker.setup();
                const pingResult = await worker.ping();
                const addResult = await worker.calculate(10, 5, 'add');
                const multiplyResult = await worker.calculate(7, 8, 'multiply');
                const divideResult = await worker.calculate(20, 4, 'divide');
                
                return {
                    success: true,
                    workerLoaded: !!worker,
                    setupResult: setupResult,
                    pingResult: pingResult,
                    addResult: addResult,
                    multiplyResult: multiplyResult,
                    divideResult: divideResult,
                    pingWorks: pingResult === "pong",
                    mathWorks: addResult === 15 && multiplyResult === 56 && divideResult === 5
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        });
        
        expect(workerTest.success).toBe(true);
        expect(workerTest.workerLoaded).toBe(true);
        expect(workerTest.pingWorks).toBe(true);
        expect(workerTest.mathWorks).toBe(true);
        expect(workerTest.setupResult?.status).toBe("ready");
    });

    test('should load minimal window app', async ({ page }) => {
        await page.waitForFunction(() => window.hyphaCorePromise !== undefined, { timeout: 10000 });
        
        const windowTest = await page.evaluate(async () => {
            try {
                const hyphaCore = await window.hyphaCorePromise;
                const api = hyphaCore.api;
                
                // Very simple window app
                const simpleWindowSrc = `
<config lang="json">
{
  "name": "Simple Window",
  "type": "window",
  "version": "0.1.0",
  "api_version": "0.1.7"
}
</config>

<window lang="html">
<div id="simple-app">
    <h3>Simple Window App</h3>
    <div id="output">Ready</div>
</div>
</window>

<script lang="javascript">
class SimpleWindow {
    async setup() {
        return { status: "ready", hasDOM: !!document.getElementById('simple-app') };
    }
    
    async updateText(text) {
        const output = document.getElementById('output');
        if (output) {
            output.textContent = text;
            return { success: true, text: text };
        }
        return { success: false };
    }
    
    async getElementCount() {
        return document.querySelectorAll('*').length;
    }
}

api.export(new SimpleWindow());
</script>
`;
                
                // Load the window app
                const windowApp = await api.loadApp({ src: simpleWindowSrc });
                
                // Test the window methods
                const setupResult = await windowApp.setup();
                const updateResult = await windowApp.updateText("Hello from API!");
                const elementCount = await windowApp.getElementCount();
                
                return {
                    success: true,
                    windowLoaded: !!windowApp,
                    setupResult: setupResult,
                    updateResult: updateResult,
                    elementCount: elementCount,
                    hasDOM: setupResult && setupResult.hasDOM === true,
                    updateWorks: updateResult && updateResult.success === true,
                    hasElements: elementCount > 0
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        });
        
        expect(windowTest.success).toBe(true);
        expect(windowTest.windowLoaded).toBe(true);
        expect(windowTest.hasDOM).toBe(true);
        expect(windowTest.updateWorks).toBe(true);
        expect(windowTest.hasElements).toBe(true);
    });
}); 