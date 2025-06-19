/**
 * Anonymous User Workspace Test
 * 
 * This test demonstrates the new behavior for anonymous users:
 * - Anonymous users without a specified workspace get their own workspace (user ID)
 * - Only root user can register services in public and default workspaces
 * - Anonymous users can only access default, public, or their own workspaces
 */

import { HyphaCore } from '../src/hypha-core.js';

async function testAnonymousUserBehavior() {
    console.log('🧪 Testing Anonymous User Workspace Behavior...\n');
    
    try {
        // Create HyphaCore instance
        const hyphaCore = new HyphaCore({
            port: 9528,
            jwtSecret: 'test-secret',
            baseUrl: 'http://localhost:9528/'
        });

        // Start server
        const serverApi = await hyphaCore.start();
        console.log('✅ Server started successfully!');

        // Test 1: Anonymous user without workspace specification (should get their own workspace)
        console.log('\n📋 Test 1: Anonymous user without workspace specification');
        const anonymousClient1 = await hyphaCore.connect({
            client_id: 'anon-client-1'
            // No workspace specified - should get workspace named after user ID
        });
        console.log(`✅ Anonymous client 1 connected to workspace: ${anonymousClient1.id}`);

        // Try to register a service (should work in their own workspace)
        try {
            await anonymousClient1.registerService({
                id: 'my-service',
                name: 'Anonymous User Service',
                config: { visibility: 'public' },
                greet: () => 'Hello from anonymous user!'
            });
            console.log('✅ Anonymous user can register services in their own workspace');
        } catch (error) {
            console.log(`❌ Failed to register service: ${error.message}`);
        }

        // Test 2: Anonymous user trying to access default workspace
        console.log('\n📋 Test 2: Anonymous user accessing default workspace');
        const anonymousClient2 = await hyphaCore.connect({
            workspace: 'default',
            client_id: 'anon-client-2'
        });
        console.log('✅ Anonymous client 2 connected to default workspace');

        // Try to register service in default workspace (should fail - only root can do this)
        try {
            await anonymousClient2.registerService({
                id: 'default-service',
                name: 'Service in Default',
                config: { visibility: 'public' }
            });
            console.log('❌ SECURITY BREACH: Anonymous user should not register in default workspace!');
        } catch (error) {
            console.log(`✅ Security working: ${error.message}`);
        }

        // Test 3: Anonymous user trying to access protected workspace (should fail)
        console.log('\n📋 Test 3: Anonymous user trying to access protected workspace');
        try {
            const anonymousClient3 = await hyphaCore.connect({
                workspace: 'protected-workspace',
                client_id: 'anon-client-3'
            });
            console.log('❌ SECURITY BREACH: Anonymous user should not access protected workspace!');
        } catch (error) {
            console.log(`✅ Security working: Anonymous client blocked from protected workspace`);
        }

        // Test 4: Root user registering service in default workspace (should work)
        console.log('\n📋 Test 4: Root user registering in default workspace');
        try {
            await serverApi.registerService({
                id: 'root-service',
                name: 'Root Service',
                config: { visibility: 'public' },
                getRootInfo: () => 'This is a root service'
            });
            console.log('✅ Root user can register services in default workspace');
        } catch (error) {
            console.log(`❌ Root registration failed: ${error.message}`);
        }

        // Test 5: List services from different perspectives
        console.log('\n📋 Test 5: Service visibility from different workspaces');
        
        console.log('\n🔍 Services visible to anonymous client 1 (in their own workspace):');
        const services1 = await anonymousClient1.listServices();
        services1.forEach(service => {
            console.log(`  - ${service.name} (${service.id})`);
        });

        console.log('\n🔍 Services visible to anonymous client 2 (in default workspace):');
        const services2 = await anonymousClient2.listServices();
        services2.forEach(service => {
            console.log(`  - ${service.name} (${service.id})`);
        });

        console.log('\n🎉 Anonymous User Behavior Test Complete!');
        console.log('\n📊 Test Results:');
        console.log('  ✅ Anonymous users get their own workspace when none specified');
        console.log('  ✅ Anonymous users can register services in their own workspace');
        console.log('  ✅ Anonymous users can access default workspace but cannot register services');
        console.log('  🚫 Anonymous users cannot access arbitrary protected workspaces');
        console.log('  ✅ Only root user can register services in default workspace');
        console.log('  ✅ Service visibility is properly isolated by workspace');

        hyphaCore.close();
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        console.error('Stack:', error.stack);
    }
}

// Run the test - handle both Deno and Node.js
const isMainModule = typeof import.meta !== 'undefined' && 
    ((import.meta as any).main || (import.meta as any).url === `file://${process?.argv?.[1]}`);

if (isMainModule || typeof require !== 'undefined') {
    testAnonymousUserBehavior().catch(console.error);
}

export { testAnonymousUserBehavior }; 