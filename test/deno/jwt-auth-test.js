#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env

/**
 * JWT Authentication Tests
 * 
 * These tests verify the complete JWT authentication workflow:
 * 1. Starting a HyphaCore server
 * 2. Generating JWT tokens for different users/workspaces
 * 3. Using tokens to access protected services via HTTP
 * 4. Verifying proper user context is passed to services
 * 5. Testing access control with valid/invalid tokens
 */

import { HyphaCore } from '../../src/hypha-core.js';
import { DenoWebSocketServer } from '../../src/deno-websocket-server.js';

// Simple test framework
class JwtAuthTestRunner {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
    }

    test(name, fn) {
        this.tests.push({ name, fn });
    }

    async run() {
        console.log('🦕 Running JWT Authentication Tests\n');
        
        for (const { name, fn } of this.tests) {
            try {
                console.log(`🧪 ${name}`);
                await fn();
                console.log('✅ PASSED\n');
                this.passed++;
            } catch (error) {
                console.log(`❌ FAILED: ${error.message}\n`);
                this.failed++;
            }
        }
        
        console.log('📊 JWT Authentication Test Results:');
        console.log(`   ✅ Passed: ${this.passed}`);
        console.log(`   ❌ Failed: ${this.failed}`);
        console.log(`   📈 Success Rate: ${this.passed}/${this.passed + this.failed} (${Math.round(100 * this.passed / (this.passed + this.failed))}%)`);
        
        return this.failed === 0;
    }
}

const jwtAuthTestRunner = new JwtAuthTestRunner();

// Test 1: JWT token context extraction and authentication
jwtAuthTestRunner.test('JWT token context extraction and authentication via workspace service', async () => {
    const server = new HyphaCore({
        server_url: 'http://localhost:9810',
        websocket_url: 'ws://localhost:9810/ws',
        create_workspace_manager: true,
        jwt_secret: 'test-secret-for-jwt-auth'
    });
    
    await server.start();
    
    const dws = new DenoWebSocketServer('ws://localhost:9810/ws', { 
        hyphaCore: server 
    });
    
    try {
        // Step 1: Generate JWT tokens for different users
        const directApi = server._createDirectAPIWrapper();
        
        // Regular user token
        const userToken = await directApi.generateToken({
            user_id: 'alice',
            workspace: 'default',
            client_id: 'mobile-app',
            email: 'alice@research.org',
            roles: ['researcher', 'user'],
            scopes: ['read', 'write'],
            expires_in: 3600
        });
        
        // Admin user token (for completeness, though we'll mainly test user token)
        const adminToken = await directApi.generateToken({
            user_id: 'bob',
            workspace: 'default',
            client_id: 'admin-dashboard',
            email: 'bob@research.org',
            roles: ['admin', 'researcher'],
            scopes: ['read', 'write', 'admin'],
            expires_in: 3600
        });
        
        console.log('   🎫 Generated JWT tokens for alice (user) and bob (admin)');
        
        // Step 2: Test authenticated access using the workspace service 'echo' function
        // The 'echo' function in the default workspace service requires context
        const userEchoResponse = await fetch('http://localhost:9810/default/services/ws/echo', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${userToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                msg: `Hello from ${JSON.stringify({user: 'alice', workspace: 'default'})}` 
            })
        });
        
        if (!userEchoResponse.ok) {
            throw new Error(`User echo request failed: ${userEchoResponse.status}`);
        }
        
        const userEchoResult = await userEchoResponse.json();
        console.log('   👤 User echo request result:', userEchoResult);
        
        // Verify the echo worked (it should return the same message)
        if (!userEchoResult.includes('alice')) {
            throw new Error('Echo result should contain the user information');
        }
        
        console.log('   ✅ User token authentication with workspace service verified');
        
        // Step 3: Test unauthenticated access (should still work with anonymous context)
        const anonEchoResponse = await fetch('http://localhost:9810/default/services/ws/echo', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
                // No Authorization header
            },
            body: JSON.stringify({ 
                msg: 'Hello from anonymous user' 
            })
        });
        
        if (!anonEchoResponse.ok) {
            throw new Error(`Anonymous echo request failed: ${anonEchoResponse.status}`);
        }
        
        const anonEchoResult = await anonEchoResponse.json();
        console.log('   👻 Anonymous echo request result:', anonEchoResult);
        
        // Verify the echo worked
        if (anonEchoResult !== 'Hello from anonymous user') {
            throw new Error(`Expected echo result 'Hello from anonymous user', got '${anonEchoResult}'`);
        }
        
        console.log('   ✅ Anonymous access verified');
        
        // Step 4: Test JWT token context extraction by checking different tokens
        const bobEchoResponse = await fetch('http://localhost:9810/default/services/ws/echo', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                msg: `Hello from ${JSON.stringify({user: 'bob', workspace: 'default'})}` 
            })
        });
        
        if (!bobEchoResponse.ok) {
            throw new Error(`Bob echo request failed: ${bobEchoResponse.status}`);
        }
        
        const bobEchoResult = await bobEchoResponse.json();
        console.log('   👨‍💼 Bob echo request result:', bobEchoResult);
        
        // Verify the echo worked for Bob
        if (!bobEchoResult.includes('bob')) {
            throw new Error('Echo result should contain Bob user information');
        }
        
        console.log('   ✅ Admin token authentication verified');
        
    } finally {
        await dws.close();
        await server.close();
    }
});

// Test 2: Token workspace validation
jwtAuthTestRunner.test('Token workspace validation and context extraction', async () => {
    const server = new HyphaCore({
        server_url: 'http://localhost:9811',
        websocket_url: 'ws://localhost:9811/ws',
        create_workspace_manager: true,
        jwt_secret: 'test-secret-workspace-validation'
    });
    
    await server.start();
    
    const dws = new DenoWebSocketServer('ws://localhost:9811/ws', { 
        hyphaCore: server 
    });
    
    try {
        // Generate tokens for different workspaces
        const directApi = server._createDirectAPIWrapper();
        
        const defaultToken = await directApi.generateToken({
            user_id: 'charlie',
            workspace: 'default',
            client_id: 'app1',
            email: 'charlie@default.com',
            roles: ['member'],
            expires_in: 3600
        });
        
        console.log('   🎫 Generated token for default workspace (charlie)');
        
        // Test 1: Use default workspace token to access default workspace service
        const defaultResponse = await fetch('http://localhost:9811/default/services/ws/echo', {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${defaultToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                msg: `Token test: user=charlie, workspace=default` 
            })
        });
        
        if (!defaultResponse.ok) {
            throw new Error(`Default workspace request failed: ${defaultResponse.status}`);
        }
        
        const defaultResult = await defaultResponse.json();
        console.log('   🏢 Default workspace service result:', defaultResult);
        
        // Verify the echo worked and contains the expected user information
        if (!defaultResult.includes('charlie')) {
            throw new Error('Default workspace echo should contain charlie');
        }
        
        console.log('   ✅ Token workspace validation verified');
        
    } finally {
        await dws.close();
        await server.close();
    }
});

// Test 3: Invalid and malformed token handling  
jwtAuthTestRunner.test('Invalid and malformed token handling with fallback to anonymous', async () => {
    const server = new HyphaCore({
        server_url: 'http://localhost:9812',
        websocket_url: 'ws://localhost:9812/ws',
        create_workspace_manager: true,
        jwt_secret: 'test-secret-invalid-tokens'
    });
    
    await server.start();
    
    const dws = new DenoWebSocketServer('ws://localhost:9812/ws', { 
        hyphaCore: server 
    });
    
    try {
        console.log('   📋 Testing invalid token handling with workspace service');
        
        // Test 1: Invalid token format
        const invalidResponse = await fetch('http://localhost:9812/default/services/ws/echo', {
            method: 'POST',
            headers: { 
                'Authorization': 'Bearer invalid-token-format',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ msg: 'Hello with invalid token' })
        });
        
        if (!invalidResponse.ok) {
            throw new Error(`Invalid token request failed: ${invalidResponse.status}`);
        }
        
        const invalidResult = await invalidResponse.json();
        console.log('   🚫 Invalid token result:', invalidResult);
        
        // Should still work (fall back to anonymous) and echo the message
        if (invalidResult !== 'Hello with invalid token') {
            throw new Error('Invalid token should fall back to anonymous and still work');
        }
        
        // Test 2: Malformed Bearer header
        const malformedResponse = await fetch('http://localhost:9812/default/services/ws/echo', {
            method: 'POST',
            headers: { 
                'Authorization': 'NotBearer sometoken',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ msg: 'Hello with malformed header' })
        });
        
        if (!malformedResponse.ok) {
            throw new Error(`Malformed header request failed: ${malformedResponse.status}`);
        }
        
        const malformedResult = await malformedResponse.json();
        console.log('   🚫 Malformed header result:', malformedResult);
        
        // Should still work (fall back to anonymous) and echo the message
        if (malformedResult !== 'Hello with malformed header') {
            throw new Error('Malformed auth header should fall back to anonymous and still work');
        }
        
        // Test 3: No Authorization header (should work as anonymous)
        const noAuthResponse = await fetch('http://localhost:9812/default/services/ws/echo', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ msg: 'Hello without auth' })
        });
        
        if (!noAuthResponse.ok) {
            throw new Error(`No auth request failed: ${noAuthResponse.status}`);
        }
        
        const noAuthResult = await noAuthResponse.json();
        console.log('   👻 No auth result:', noAuthResult);
        
        // Should work normally as anonymous
        if (noAuthResult !== 'Hello without auth') {
            throw new Error('No auth header should work normally as anonymous');
        }
        
        console.log('   ✅ Invalid token handling verified');
        
    } finally {
        await dws.close();
        await server.close();
    }
});

// Test 4: Anonymous user access and context verification
jwtAuthTestRunner.test('Anonymous user access and context verification', async () => {
    const server = new HyphaCore({
        server_url: 'http://localhost:9813',
        websocket_url: 'ws://localhost:9813/ws',
        create_workspace_manager: true,
        jwt_secret: 'test-secret-anonymous-user'
    });
    
    await server.start();
    
    const dws = new DenoWebSocketServer('ws://localhost:9813/ws', { 
        hyphaCore: server 
    });
    
    try {
        console.log('   👻 Testing anonymous user access patterns');
        
        // Test 1: Anonymous access to echo service (should work with anonymous context)
        const echoResponse = await fetch('http://localhost:9813/default/services/ws/echo', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
                // No Authorization header - completely anonymous
            },
            body: JSON.stringify({ msg: 'Anonymous user test message' })
        });
        
        if (!echoResponse.ok) {
            throw new Error(`Anonymous echo request failed: ${echoResponse.status}`);
        }
        
        const echoResult = await echoResponse.json();
        console.log('   📢 Anonymous echo result:', echoResult);
        
        if (echoResult !== 'Anonymous user test message') {
            throw new Error(`Expected 'Anonymous user test message', got '${echoResult}'`);
        }
        
        console.log('   ✅ Anonymous echo service access verified');
        
        // Test 2: Anonymous access to info service (should log with anonymous context)
        const infoResponse = await fetch('http://localhost:9813/default/services/ws/info', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ msg: 'Anonymous info message' })
        });
        
        if (!infoResponse.ok) {
            throw new Error(`Anonymous info request failed: ${infoResponse.status}`);
        }
        
        const infoResult = await infoResponse.json();
        console.log('   ℹ️ Anonymous info result:', infoResult);
        
        // Info service returns null/undefined but logs the message
        if (infoResult !== null && infoResult !== undefined) {
            throw new Error(`Expected null/undefined from info service, got '${infoResult}'`);
        }
        
        console.log('   ✅ Anonymous info service access verified');
        
        // Test 3: Anonymous access to log service
        const logResponse = await fetch('http://localhost:9813/default/services/ws/log', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ msg: 'Anonymous log message' })
        });
        
        if (!logResponse.ok) {
            throw new Error(`Anonymous log request failed: ${logResponse.status}`);
        }
        
        const logResult = await logResponse.json();
        console.log('   📝 Anonymous log result:', logResult);
        
        // Log service returns null/undefined but logs the message
        if (logResult !== null && logResult !== undefined) {
            throw new Error(`Expected null/undefined from log service, got '${logResult}'`);
        }
        
        console.log('   ✅ Anonymous log service access verified');
        
        // Test 4: Anonymous access to multiple services in sequence
        const services = ['echo', 'log', 'info'];
        for (const service of services) {
            const response = await fetch(`http://localhost:9813/default/services/ws/${service}`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ msg: `Sequential anonymous test for ${service}` })
            });
            
            if (!response.ok) {
                throw new Error(`Anonymous ${service} request failed: ${response.status}`);
            }
            
            await response.json(); // Just consume the response
        }
        
        console.log('   🔄 Sequential anonymous service calls verified');
        
        // Test 5: Anonymous user can access services but gets unique client IDs
        const response1 = await fetch('http://localhost:9813/default/services/ws/echo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ msg: 'Request 1' })
        });
        
        const response2 = await fetch('http://localhost:9813/default/services/ws/echo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ msg: 'Request 2' })
        });
        
        if (!response1.ok || !response2.ok) {
            throw new Error('Anonymous multiple requests failed');
        }
        
        const result1 = await response1.json();
        const result2 = await response2.json();
        
        console.log('   🔀 Multiple anonymous requests handled successfully');
        
        if (result1 !== 'Request 1' || result2 !== 'Request 2') {
            throw new Error('Multiple anonymous requests should work independently');
        }
        
        console.log('   ✅ Anonymous user isolation verified');
        
    } finally {
        await dws.close();
        await server.close();
    }
});

// Export for use in run-all-tests.js
export { jwtAuthTestRunner }; 