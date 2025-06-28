#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env

/**
 * Context Injection Tests
 * 
 * These tests verify that local services with require_context: true
 * properly receive context with ws, user, and from fields when
 * their methods are called through the HyphaCore system.
 */

import { HyphaCore } from '../../src/hypha-core.js';
import { DenoWebSocketServer } from '../../src/deno-websocket-server.js';

// Simple test framework
class ContextTestRunner {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
    }

    test(name, fn) {
        this.tests.push({ name, fn });
    }

    async run() {
        console.log('🦕 Running Context Injection Tests\n');
        
        for (const { name, fn } of this.tests) {
            try {
                console.log(`🧪 ${name}`);
                await fn();
                console.log(`✅ PASSED\n`);
                this.passed++;
            } catch (error) {
                console.log(`❌ FAILED: ${error.message}\n`);
                console.error(error.stack);
                this.failed++;
            }
        }
        
        console.log(`📊 Context Injection Test Results:`);
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

function assertExists(value, message) {
    if (value === null || value === undefined) {
        throw new Error(message || 'Value should exist');
    }
}

const runner = new ContextTestRunner();

// Test: Local service with require_context receives proper context
runner.test('Local service with require_context receives proper context', async () => {
    const hyphaCore = new HyphaCore({
        ServerClass: DenoWebSocketServer,
        name: 'context-test-server',
        description: 'Test server for context injection',
        port: 9700,
        baseUrl: 'http://localhost:9700'
    });

    let capturedContext = null;

    try {
        const api = await hyphaCore.start();
        
        // Register a service that requires context
        await api.registerService({
            id: 'context-test-service',
            name: 'Context Test Service',
            type: 'functions',
            config: {
                require_context: true,
                visibility: 'public'
            },
            
            // Test method that captures the context
            testContextCapture: (message, context) => {
                capturedContext = context;
                return `Message: ${message}, Workspace: ${context?.ws}`;
            },
            
            // Test method without explicit context parameter
            testImplicitContext: function(data) {
                // The context should be injected as the last argument
                const args = Array.from(arguments);
                const context = args[args.length - 1];
                return {
                    data,
                    hasContext: !!context,
                    workspace: context?.ws,
                    user: context?.user,
                    from: context?.from
                };
            }
        });
        
        // Get the service to test it
        const service = await api.getService('context-test-service');
        assertExists(service, 'Service should be registered');
        
        // Test 1: Call method with explicit context parameter
        const result1 = await service.testContextCapture('Hello World');
        assertExists(capturedContext, 'Context should be captured');
        assertExists(capturedContext.ws, 'Context should have ws field');
        assertExists(capturedContext.user, 'Context should have user field');
        assertExists(capturedContext.from, 'Context should have from field');
        assertEqual(capturedContext.ws, 'default', 'Workspace should be default');
        
        console.log('   📋 Captured context:', {
            ws: capturedContext.ws,
            user: capturedContext.user?.id,
            from: capturedContext.from
        });
        
        // Test 2: Call method that expects context to be injected automatically
        const result2 = await service.testImplicitContext('test data');
        assert(result2.hasContext, 'Method should receive injected context');
        assertEqual(result2.workspace, 'default', 'Injected context should have correct workspace');
        assertExists(result2.user, 'Injected context should have user');
        assertExists(result2.from, 'Injected context should have from');
        
        console.log('   📋 Implicit context result:', {
            hasContext: result2.hasContext,
            workspace: result2.workspace,
            user: result2.user?.id,
            from: result2.from
        });
        
    } finally {
        hyphaCore.close();
    }
});

// Test: Service without require_context does not get context injection
runner.test('Service without require_context does not get context injection', async () => {
    const hyphaCore = new HyphaCore({
        ServerClass: DenoWebSocketServer,
        name: 'no-context-test-server',
        description: 'Test server for no context injection',
        port: 9701,
        baseUrl: 'http://localhost:9701'
    });

    try {
        const api = await hyphaCore.start();
        
        // Register a service without require_context
        await api.registerService({
            id: 'no-context-service',
            name: 'No Context Service',
            type: 'functions',
            config: {
                require_context: false,  // Explicitly disable context
                visibility: 'public'
            },
            
            testNoContext: function() {
                // Check the number of arguments - should not have extra context injected
                return {
                    argCount: arguments.length,
                    args: Array.from(arguments)
                };
            }
        });
        
        const service = await api.getService('no-context-service');
        const result = await service.testNoContext();
        
        assertEqual(result.argCount, 0, 'Service without require_context should not receive injected context');
        
    } finally {
        hyphaCore.close();
    }
});

// Test: Nested service objects also get context injection
runner.test('Nested service objects get context injection', async () => {
    const hyphaCore = new HyphaCore({
        ServerClass: DenoWebSocketServer,
        name: 'nested-context-test',
        description: 'Test server for nested context injection',
        port: 9702,
        baseUrl: 'http://localhost:9702'
    });

    try {
        const api = await hyphaCore.start();
        
        // Register a service with nested objects
        await api.registerService({
            id: 'nested-service',
            name: 'Nested Service',
            type: 'functions',
            config: {
                require_context: true,
                visibility: 'public'
            },
            
            // Top-level method
            topLevel: (data, context) => {
                return {
                    level: 'top',
                    data,
                    hasContext: !!context,
                    workspace: context?.ws
                };
            },
            
            // Nested object with methods
            nested: {
                level1: (data, context) => {
                    return {
                        level: 'nested-1',
                        data,
                        hasContext: !!context,
                        workspace: context?.ws
                    };
                },
                
                deeply: {
                    level2: (data, context) => {
                        return {
                            level: 'nested-2',
                            data,
                            hasContext: !!context,
                            workspace: context?.ws
                        };
                    }
                }
            }
        });
        
        const service = await api.getService('nested-service');
        
        // Test top-level method
        const topResult = await service.topLevel('test');
        assert(topResult.hasContext, 'Top-level method should receive context');
        assertEqual(topResult.workspace, 'default', 'Top-level context should have correct workspace');
        
        // Test nested level 1
        const nested1Result = await service.nested.level1('test');
        assert(nested1Result.hasContext, 'Nested level 1 method should receive context');
        assertEqual(nested1Result.workspace, 'default', 'Nested level 1 context should have correct workspace');
        
        // Test nested level 2
        const nested2Result = await service.nested.deeply.level2('test');
        assert(nested2Result.hasContext, 'Nested level 2 method should receive context');
        assertEqual(nested2Result.workspace, 'default', 'Nested level 2 context should have correct workspace');
        
    } finally {
        hyphaCore.close();
    }
});

// Test: Context merging when partial context is provided
runner.test('Context merging works when partial context is provided', async () => {
    const hyphaCore = new HyphaCore({
        ServerClass: DenoWebSocketServer,
        name: 'context-merge-test',
        description: 'Test server for context merging',
        port: 9703,
        baseUrl: 'http://localhost:9703'
    });

    try {
        const api = await hyphaCore.start();
        
        await api.registerService({
            id: 'merge-test-service',
            name: 'Context Merge Test Service',
            type: 'functions',
            config: {
                require_context: true,
                visibility: 'public'
            },
            
            testMerge: (data, context) => {
                return {
                    data,
                    context: {
                        ws: context?.ws,
                        user: context?.user?.id,
                        from: context?.from,
                        custom: context?.custom
                    }
                };
            }
        });
        
        const service = await api.getService('merge-test-service');
        
        // The service wrapper should merge with existing context and fill in missing fields
        // Pass a context that has at least one context field to trigger merging
        const result = await service.testMerge('test data', { from: 'test-client', custom: 'custom-value' });
        
        // Should have both the custom field and the injected context fields
        assertEqual(result.context.ws, 'default', 'Merged context should have workspace');
        assertExists(result.context.user, 'Merged context should have user');
        assertExists(result.context.from, 'Merged context should have from');
        assertEqual(result.context.custom, 'custom-value', 'Merged context should preserve custom fields');
        
    } finally {
        hyphaCore.close();
    }
});

// Test: HTTP API calls also receive proper context
runner.test('HTTP API calls receive proper context', async () => {
    const hyphaCore = new HyphaCore({
        ServerClass: DenoWebSocketServer,
        name: 'http-context-test',
        description: 'Test HTTP context injection',
        port: 9704,
        baseUrl: 'http://localhost:9704'
    });

    try {
        const api = await hyphaCore.start();
        
        await api.registerService({
            id: 'http-context-service',
            name: 'HTTP Context Service',
            type: 'functions',
            config: {
                require_context: true,
                visibility: 'public'
            },
            
            checkHttpContext: (message, context) => {
                return {
                    message,
                    hasContext: !!context,
                    workspace: context?.ws,
                    userType: typeof context?.user,
                    fromExists: !!context?.from
                };
            }
        });
        
        // Test via HTTP API
        const response = await fetch('http://localhost:9704/default/services/http-context-service/checkHttpContext?message=hello');
        assert(response.ok, 'HTTP request should succeed');
        
        const result = await response.json();
        assert(result.hasContext, 'HTTP API call should receive context');
        assertEqual(result.workspace, 'default', 'HTTP context should have correct workspace');
        assertEqual(result.userType, 'object', 'HTTP context should have user object');
        assert(result.fromExists, 'HTTP context should have from field');
        
    } finally {
        hyphaCore.close();
    }
});

// Test: ASGI services with require_context also get context
runner.test('ASGI services with require_context get context', async () => {
    const hyphaCore = new HyphaCore({
        ServerClass: DenoWebSocketServer,
        name: 'asgi-context-test',
        description: 'Test ASGI context injection',
        port: 9705,
        baseUrl: 'http://localhost:9705'
    });

    try {
        const api = await hyphaCore.start();
        
        let capturedAsgiContext = null;
        
        await api.registerService({
            id: 'asgi-context-service',
            name: 'ASGI Context Service',
            type: 'asgi',
            config: {
                require_context: true,
                visibility: 'public'
            },
            
            async serve({ scope, receive, send }, context) {
                capturedAsgiContext = context;
                
                // Always consume the request body
                await receive();
                
                await send({
                    type: 'http.response.start',
                    status: 200,
                    headers: [
                        [new TextEncoder().encode('content-type'), new TextEncoder().encode('application/json')]
                    ]
                });
                
                const responseBody = JSON.stringify({
                    hasContext: !!context,
                    workspace: context?.ws,
                    userExists: !!context?.user,
                    fromExists: !!context?.from
                });
                
                await send({
                    type: 'http.response.body',
                    body: new TextEncoder().encode(responseBody),
                    more_body: false
                });
            }
        });
        
        // Test via HTTP to the ASGI app
        const response = await fetch('http://localhost:9705/default/apps/asgi-context-service/test');
        assert(response.ok, 'ASGI HTTP request should succeed');
        
        const result = await response.json();
        assert(result.hasContext, 'ASGI service should receive context');
        assertEqual(result.workspace, 'default', 'ASGI context should have correct workspace');
        assert(result.userExists, 'ASGI context should have user');
        assert(result.fromExists, 'ASGI context should have from');
        
        // Also verify the captured context
        assertExists(capturedAsgiContext, 'Context should be captured by ASGI service');
        assertEqual(capturedAsgiContext.ws, 'default', 'Captured ASGI context should have correct workspace');
        
    } finally {
        hyphaCore.close();
    }
});

// Run all tests
if (import.meta.main) {
    const success = await runner.run();
    Deno.exit(success ? 0 : 1);
}

export { runner as contextTestRunner }; 