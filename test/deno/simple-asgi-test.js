#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env

/**
 * Simple ASGI test to debug hanging issue
 */

import { HyphaCore } from '../../src/hypha-core.js';
import { DenoWebSocketServer } from '../../src/deno-websocket-server.js';

async function testSimpleAsgi() {
    console.log('🧪 Testing simple ASGI functionality...');
    
    const hyphaCore = new HyphaCore({
        ServerClass: DenoWebSocketServer,
        name: 'simple-asgi-test',
        description: 'Simple ASGI test',
        port: 9620,
        baseUrl: 'http://localhost:9620'
    });

    try {
        console.log('1. Starting HyphaCore...');
        const api = await hyphaCore.start();
        console.log('✅ HyphaCore started');

        console.log('2. Registering simple ASGI service...');
        await api.registerService({
            id: 'simple-asgi',
            type: 'asgi',
            config: {},
            
            async serve({ scope, receive, send }) {
                console.log('🔄 ASGI serve called with scope:', scope.type, scope.method, scope.path);
                
                if (scope.type !== 'http') {
                    console.log('❌ Non-HTTP scope, returning');
                    return;
                }
                
                // Always consume the request body (ASGI protocol requirement)
                console.log('📥 Receiving request data...');
                const requestData = await receive();
                console.log('✅ Request data received');
                
                console.log('📤 Sending response start...');
                await send({
                    type: 'http.response.start',
                    status: 200,
                    headers: [
                        [new TextEncoder().encode('content-type'), new TextEncoder().encode('text/plain')]
                    ]
                });
                console.log('✅ Response start sent');
                
                console.log('📤 Sending response body...');
                await send({
                    type: 'http.response.body',
                    body: new TextEncoder().encode('Hello from simple ASGI!'),
                    more_body: false
                });
                console.log('✅ Response body sent');
            }
        });
        console.log('✅ Service registered');

        console.log('3. Making HTTP request...');
        const response = await fetch('http://localhost:9620/default/apps/simple-asgi/test');
        console.log('📥 Response received, status:', response.status);
        
        const text = await response.text();
        console.log('📄 Response text:', text);
        
        if (text === 'Hello from simple ASGI!') {
            console.log('✅ Test PASSED!');
        } else {
            console.log('❌ Test FAILED - unexpected response');
        }
        
    } catch (error) {
        console.error('💥 Test failed:', error);
    } finally {
        console.log('4. Cleaning up...');
        hyphaCore.close();
        console.log('✅ Cleanup complete');
    }
}

if (import.meta.main) {
    await testSimpleAsgi();
} 