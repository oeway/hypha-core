#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env

/**
 * Debug ASGI hanging issue
 */

import { HyphaCore } from '../../src/hypha-core.js';
import { DenoWebSocketServer } from '../../src/deno-websocket-server.js';

async function debugAsgiHang() {
    console.log('🔍 Debug: Investigating ASGI hanging issue...');
    
    const hyphaCore = new HyphaCore({
        ServerClass: DenoWebSocketServer,
        name: 'debug-asgi',
        port: 9625,
        baseUrl: 'http://localhost:9625'
    });

    try {
        console.log('🚀 Starting server...');
        const api = await hyphaCore.start();
        
        console.log('📝 Registering ASGI service...');
        await api.registerService({
            id: 'debug-asgi',
            type: 'asgi',
            config: {},
            
            async serve({ scope, receive, send }) {
                console.log('🎯 ASGI serve() called');
                console.log('   scope.type:', scope?.type);
                console.log('   scope.method:', scope?.method);
                console.log('   scope.path:', scope?.path);
                
                if (scope.type !== 'http') {
                    console.log('❌ Non-HTTP scope, returning');
                    return;
                }
                
                try {
                    console.log('📥 About to call receive()...');
                    const requestData = await receive();
                    console.log('✅ receive() completed:', requestData?.type);
                    
                    console.log('📤 About to send response.start...');
                    await send({
                        type: 'http.response.start',
                        status: 200,
                        headers: [
                            [new TextEncoder().encode('content-type'), new TextEncoder().encode('text/plain')]
                        ]
                    });
                    console.log('✅ response.start sent');
                    
                    console.log('📤 About to send response.body...');
                    await send({
                        type: 'http.response.body',
                        body: new TextEncoder().encode('Debug response'),
                        more_body: false
                    });
                    console.log('✅ response.body sent');
                    console.log('🎉 ASGI serve() completed successfully');
                    
                } catch (error) {
                    console.error('💥 Error in ASGI serve():', error);
                    throw error;
                }
            }
        });
        console.log('✅ Service registered');

        // Add a small delay to ensure service is ready
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log('🌐 Making HTTP request...');
        
        // Set a timeout for the fetch to detect hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            console.log('⏰ Request timeout - aborting');
            controller.abort();
        }, 5000); // 5 second timeout
        
        try {
            const response = await fetch('http://localhost:9625/default/apps/debug-asgi/test', {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            
            console.log('📥 Response received! Status:', response.status);
            
            const text = await response.text();
            console.log('📄 Response text:', text);
            
            if (response.ok && text === 'Debug response') {
                console.log('✅ Test PASSED!');
            } else {
                console.log('❌ Test FAILED - unexpected response');
            }
            
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                console.log('💀 Request was aborted due to timeout - THIS IS THE HANGING ISSUE!');
            } else {
                console.log('💥 Request failed:', error.message);
            }
        }
        
    } catch (error) {
        console.error('💥 Test setup failed:', error);
    } finally {
        console.log('🧹 Cleaning up...');
        hyphaCore.close();
        console.log('✅ Cleanup complete');
    }
}

if (import.meta.main) {
    await debugAsgiHang();
} 