const { test, expect } = require('@playwright/test');

test.describe('Debug Console', () => {
    test('should check console errors on page load', async ({ page }) => {
        const logs = [];
        const errors = [];
        
        page.on('console', msg => {
            logs.push(`${msg.type()}: ${msg.text()}`);
            console.log(`Browser console ${msg.type()}: ${msg.text()}`);
        });
        
        page.on('pageerror', error => {
            errors.push(error.message);
            console.log(`Page error: ${error.message}`);
        });
        
        await page.goto('http://localhost:8080/lite.html');
        await page.waitForLoadState('domcontentloaded');
        
        // Wait a bit for module to load
        await page.waitForTimeout(3000);
        
        const pageInfo = await page.evaluate(() => {
            return {
                title: document.title,
                hasHyphaCore: typeof window.hyphaCore !== 'undefined',
                hasHyphaCorePromise: typeof window.hyphaCorePromise !== 'undefined',
                scriptTags: Array.from(document.querySelectorAll('script')).map(s => ({
                    type: s.type,
                    src: s.src,
                    hasText: !!s.textContent
                }))
            };
        });
        
        console.log('Page info:', JSON.stringify(pageInfo, null, 2));
        console.log('Console logs:', logs);
        console.log('Page errors:', errors);
        
        expect(pageInfo.title).toBe('Hypha Lite');
    });
}); 