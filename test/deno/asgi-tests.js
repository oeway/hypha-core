#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env

/**
 * Deno ASGI Tests
 * These tests run in the Deno environment and test the ASGI functionality
 * that requires the DenoWebSocketServer to actually run.
 */

import { HyphaCore } from '../../src/hypha-core.js';
import { DenoWebSocketServer } from '../../src/deno-websocket-server.js';

// Simple test framework
class DenoTestRunner {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
    }

    test(name, fn) {
        this.tests.push({ name, fn });
    }

    async run() {
        console.log('🦕 Running Deno ASGI Tests\n');
        
        for (const { name, fn } of this.tests) {
            try {
                console.log(`🧪 ${name}`);
                await fn();
                console.log(`✅ PASSED\n`);
                this.passed++;
            } catch (error) {
                console.log(`❌ FAILED: ${error.message}\n`);
                this.failed++;
            }
        }
        
        console.log(`📊 Test Results:`);
        console.log(`   ✅ Passed: ${this.passed}`);
        console.log(`   ❌ Failed: ${this.failed}`);
        console.log(`   📈 Success Rate: ${this.passed}/${this.tests.length} (${Math.round(this.passed/this.tests.length*100)}%)`);
        
        return this.failed === 0;
    }
}

// Assertion helpers
function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message || 'Values not equal'}\nExpected: ${expected}\nActual: ${actual}`);
    }
}

function assertContains(str, substring, message) {
    if (!str.includes(substring)) {
        throw new Error(`${message || 'String does not contain substring'}\nString: ${str}\nSubstring: ${substring}`);
    }
}

const runner = new DenoTestRunner();

// Test: Basic server startup and service registration
runner.test('HyphaCore can start in Deno environment', async () => {
    const hyphaCore = new HyphaCore({
        ServerClass: DenoWebSocketServer,
        name: 'deno-test-server',
        description: 'Test server for Deno environment',
        port: 9610,
        baseUrl: 'http://localhost:9610',
        ServerClass: DenoWebSocketServer
    });

    await hyphaCore.start();
    
    // Test that server is running
    const response = await fetch('http://localhost:9610/health');
    assert(response.ok, 'Health endpoint should be accessible');
    
    hyphaCore.close();
});

// Test: Service registration and HTTP API
runner.test('Can register services and access via HTTP API', async () => {
    const hyphaCore = new HyphaCore({
        ServerClass: DenoWebSocketServer,
        name: 'deno-api-test',
        description: 'API test server',
        port: 9611,
        baseUrl: 'http://localhost:9611'
    });

    const api = await hyphaCore.start();
    
    await api.registerService({
        id: 'test-functions-service',
        type: 'functions',
        config: {},
        sayHello: async (name = 'World') => {
            return `Hello, ${name}!`;
        },
        calculate: async (a, b, operation = 'add') => {
            switch (operation) {
                case 'add': return a + b;
                case 'multiply': return a * b;
                default: return 0;
            }
        }
    });

    // Test service info endpoint
    const serviceResponse = await fetch('http://localhost:9611/default/services/test-functions-service');
    assert(serviceResponse.ok, 'Service info endpoint should work');
    
    const serviceInfo = await serviceResponse.json();
    assertEqual(serviceInfo.id, 'test-functions-service', 'Service ID should match');

    // Test function calls via HTTP
    const helloResponse = await fetch('http://localhost:9611/default/services/test-functions-service/sayHello?name=Deno');
    assert(helloResponse.ok, 'Function call should work');
    
    const helloResult = await helloResponse.json();
    assertEqual(helloResult, 'Hello, Deno!', 'Function should return correct result');

    hyphaCore.close();
});

// Test: ASGI app registration and routing
runner.test('ASGI apps work with proper routing', async () => {
    const hyphaCore = new HyphaCore({
        ServerClass: DenoWebSocketServer,
        name: 'deno-asgi-test',
        description: 'ASGI routing test',
        port: 9612,
        baseUrl: 'http://localhost:9612'
    });

    const api = await hyphaCore.start();
    
    // Register ASGI app
    await api.registerService({
        id: 'test-asgi-app',
        type: 'asgi',
        config: {},
        
        async serve({ scope, receive, send }) {
            if (scope.type !== 'http') return;
            
            // Always consume the request body (ASGI protocol requirement)
            const requestData = await receive();
            
            let response_body = '';
            let status = 200;
            
            // Simple routing based on path
            if (scope.path === '/') {
                response_body = 'ASGI App Home';
            } else if (scope.path === '/hello') {
                response_body = 'Hello from ASGI!';
            } else if (scope.path === '/json') {
                response_body = JSON.stringify({
                    message: 'JSON response from ASGI',
                    method: scope.method,
                    path: scope.path,
                    timestamp: new Date().toISOString()
                });
            } else {
                response_body = 'Not Found';
                status = 404;
            }
            
            const headers = [];
            if (scope.path === '/json') {
                headers.push([
                    new TextEncoder().encode('content-type'), 
                    new TextEncoder().encode('application/json')
                ]);
            } else {
                headers.push([
                    new TextEncoder().encode('content-type'), 
                    new TextEncoder().encode('text/plain')
                ]);
            }
            
            await send({
                type: 'http.response.start',
                status,
                headers
            });
            
            await send({
                type: 'http.response.body',
                body: new TextEncoder().encode(response_body),
                more_body: false
            });
        }
    });

    // Test app home route
    const homeResponse = await fetch('http://localhost:9612/default/apps/test-asgi-app/');
    assert(homeResponse.ok, 'ASGI app home should be accessible');
    
    const homeText = await homeResponse.text();
    assertEqual(homeText, 'ASGI App Home', 'Home route should return correct content');

    // Test hello route
    const helloResponse = await fetch('http://localhost:9612/default/apps/test-asgi-app/hello');
    assert(helloResponse.ok, 'ASGI app hello route should work');
    
    const helloText = await helloResponse.text();
    assertEqual(helloText, 'Hello from ASGI!', 'Hello route should return correct content');

    // Test JSON route
    const jsonResponse = await fetch('http://localhost:9612/default/apps/test-asgi-app/json');
    assert(jsonResponse.ok, 'ASGI app JSON route should work');
    
    const jsonData = await jsonResponse.json();
    assertEqual(jsonData.message, 'JSON response from ASGI', 'JSON route should return correct data');
    assertEqual(jsonData.path, '/json', 'Path should be correctly passed to ASGI app');

    hyphaCore.close();
});

// Test: Streaming responses
runner.test('ASGI streaming responses work correctly', async () => {
    const hyphaCore = new HyphaCore({
        ServerClass: DenoWebSocketServer,
        name: 'deno-streaming-test',
        description: 'Streaming test server',
        port: 9613,
        baseUrl: 'http://localhost:9613'
    });

    const api = await hyphaCore.start();
    
    await api.registerService({
        id: 'streaming-app',
        type: 'asgi',
        config: {},
        
        async serve({ scope, receive, send }) {
            if (scope.type !== 'http') return;
            
            // Always consume the request body (ASGI protocol requirement)
            const requestData = await receive();
            
            await send({
                type: 'http.response.start',
                status: 200,
                headers: [
                    [new TextEncoder().encode('content-type'), new TextEncoder().encode('text/plain')]
                ]
            });
            
            // Send chunks with delays to test streaming
            const chunks = ['First chunk\n', 'Second chunk\n', 'Third chunk\n'];
            
            for (let i = 0; i < chunks.length; i++) {
                await send({
                    type: 'http.response.body',
                    body: new TextEncoder().encode(chunks[i]),
                    more_body: i < chunks.length - 1
                });
                
                // Small delay between chunks
                if (i < chunks.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }
        }
    });

    const startTime = Date.now();
    const response = await fetch('http://localhost:9613/default/apps/streaming-app/stream');
    assert(response.ok, 'Streaming response should be successful');
    
    const text = await response.text();
    const endTime = Date.now();
    
    assertContains(text, 'First chunk', 'Response should contain first chunk');
    assertContains(text, 'Second chunk', 'Response should contain second chunk'); 
    assertContains(text, 'Third chunk', 'Response should contain third chunk');
    
    // Verify it took some time (indicating streaming delays worked)
    const duration = endTime - startTime;
    assert(duration >= 80, `Response should take time due to streaming delays (took ${duration}ms)`);

    hyphaCore.close();
});

// Test: Error handling and 404 responses
runner.test('Error handling works correctly for ASGI apps', async () => {
    const hyphaCore = new HyphaCore({
        ServerClass: DenoWebSocketServer,
        name: 'deno-error-test',
        description: 'Error handling test',
        port: 9614,
        baseUrl: 'http://localhost:9614'
    });

    const api = await hyphaCore.start();
    
    await api.registerService({
        id: 'error-app',
        type: 'asgi',
        config: {},
        
        async serve({ scope, receive, send }) {
            if (scope.type !== 'http') return;
            
            // Always consume the request body (ASGI protocol requirement)
            const requestData = await receive();
            
            if (scope.path === '/error') {
                await send({
                    type: 'http.response.start',
                    status: 500,
                    headers: [
                        [new TextEncoder().encode('content-type'), new TextEncoder().encode('text/plain')]
                    ]
                });
                
                await send({
                    type: 'http.response.body',
                    body: new TextEncoder().encode('Internal Server Error'),
                    more_body: false
                });
            } else {
                await send({
                    type: 'http.response.start',
                    status: 404,
                    headers: [
                        [new TextEncoder().encode('content-type'), new TextEncoder().encode('text/plain')]
                    ]
                });
                
                await send({
                    type: 'http.response.body',
                    body: new TextEncoder().encode('Not Found'),
                    more_body: false
                });
            }
        }
    });

    // Test 404 response
    const notFoundResponse = await fetch('http://localhost:9614/default/apps/error-app/notfound');
    assertEqual(notFoundResponse.status, 404, 'Should return 404 for unknown routes');
    
    const notFoundText = await notFoundResponse.text();
    assertEqual(notFoundText, 'Not Found', 'Should return correct 404 message');

    // Test 500 error response
    const errorResponse = await fetch('http://localhost:9614/default/apps/error-app/error');
    assertEqual(errorResponse.status, 500, 'Should return 500 for error routes');
    
    const errorText = await errorResponse.text();
    assertEqual(errorText, 'Internal Server Error', 'Should return correct error message');

    hyphaCore.close();
});

// Run all tests
if (import.meta.main) {
    console.log('Starting Deno ASGI test suite...\n');
    
    const success = await runner.run();
    
    if (success) {
        console.log('\n🎉 All tests passed!');
        Deno.exit(0);
    } else {
        console.log('\n💥 Some tests failed!');
        Deno.exit(1);
    }
} 