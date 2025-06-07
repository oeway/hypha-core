const { test, expect } = require('@playwright/test');

test.describe('Debug API State', () => {
    test.beforeEach(async ({ page }) => {
        // Navigate to lite.html like the other tests
        await page.goto('http://localhost:8080/lite.html');
        await page.waitForLoadState('domcontentloaded');
    });

    test('debug API initialization state', async ({ page }) => {
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

        // Wait a bit for the page to load
        await page.waitForTimeout(2000);

        // Check the state step by step
        console.log('=== Checking HyphaCore state ===');
        
        const hyphaExists = await page.evaluate(() => {
            return !!window.hyphaCore;
        });
        console.log('HyphaCore exists:', hyphaExists);

        if (hyphaExists) {
            const apiState = await page.evaluate(() => {
                return {
                    api: window.hyphaCore.api,
                    apiIsNull: window.hyphaCore.api === null,
                    apiIsUndefined: window.hyphaCore.api === undefined,
                    apiType: typeof window.hyphaCore.api,
                    apiKeys: window.hyphaCore.api ? Object.keys(window.hyphaCore.api) : [],
                    initError: window.initializationError ? window.initializationError.message : null
                };
            });
            console.log('API State:', JSON.stringify(apiState, null, 2));

            // Wait a bit more and check again
            await page.waitForTimeout(3000);
            
            const apiState2 = await page.evaluate(() => {
                return {
                    api: window.hyphaCore.api,
                    apiIsNull: window.hyphaCore.api === null,
                    apiIsUndefined: window.hyphaCore.api === undefined,
                    apiType: typeof window.hyphaCore.api,
                    apiKeys: window.hyphaCore.api ? Object.keys(window.hyphaCore.api) : [],
                };
            });
            console.log('API State after 3s:', JSON.stringify(apiState2, null, 2));

            // Check if we can wait for API to be ready
            try {
                await page.waitForFunction(() => window.hyphaCore && window.hyphaCore.api !== null, { timeout: 10000 });
                console.log('API became ready!');
                
                const finalApiState = await page.evaluate(() => {
                    return {
                        apiType: typeof window.hyphaCore.api,
                        apiKeys: Object.keys(window.hyphaCore.api).slice(0, 10), // First 10 keys
                        hasEcho: typeof window.hyphaCore.api.echo === 'function',
                        hasListServices: typeof window.hyphaCore.api.listServices === 'function'
                    };
                });
                console.log('Final API State:', JSON.stringify(finalApiState, null, 2));
                
            } catch (error) {
                console.log('API never became ready:', error.message);
            }
        }

        console.log('=== Console logs captured ===');
        logs.forEach(log => console.log(log));
        
        // This test just provides debug info
        expect(true).toBe(true);
    });
}); 