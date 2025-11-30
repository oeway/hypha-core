#!/usr/bin/env -S deno run --allow-net
/**
 * Deno Client Example
 * 
 * This example shows how to connect to a Deno Hypha server using hypha-rpc.
 * Make sure the server is running first (deno-server-example.js)
 * 
 * To run this example:
 * deno run --allow-net examples/deno-client-example.js
 */

// Import hypha-rpc for WebSocket client
// Note: In real usage, you might want to use a CDN import or npm import
import hyphaRPC from "https://cdn.jsdelivr.net/npm/hypha-rpc@0.20.84/dist/hypha-rpc-websocket.min.js";
const { connectToServer } = hyphaRPC;

async function connectToHyphaServer() {
    console.log('🔌 Connecting to Deno Hypha server...');
    
    const serverUrl = "http://localhost:9527";
    
    try {
        // Connect to the server
        const server = await connectToServer({
            server_url: serverUrl,
            workspace: "default", // Connect to default workspace
            client_id: "deno-client-" + Math.random().toString(36).substr(2, 9)
        });
        
        console.log('✅ Connected to Hypha server successfully!');
        console.log(`📍 Connected to workspace: ${server.config.workspace}`);
        console.log(`🆔 Client ID: ${server.config.client_id}`);
        
        // Test the echo service from default services
        console.log('\n🧪 Testing echo service...');
        const echoResponse = await server.echo("Hello from Deno client!");
        console.log(`Echo response: ${echoResponse}`);
        
        // Test the server info service
        console.log('\n📊 Getting server info...');
        const serverInfo = await server.get_server_info();
        console.log('Server info:', serverInfo);
        
        // Get the hello-world service
        console.log('\n🌍 Testing hello-world service...');
        const helloService = await server.get_service("hello-world");
        
        // Call the hello method
        const helloResponse = await helloService.hello("Deno Client");
        console.log(`Hello response: ${helloResponse}`);
        
        // Call the get_time method
        const timeResponse = await helloService.get_time();
        console.log(`Server time: ${timeResponse}`);
        
        // Register our own service
        console.log('\n📝 Registering client service...');
        const clientService = await server.register_service({
            id: "deno-client-service",
            name: "Deno Client Service",
            description: "A service registered from Deno client",
            config: {
                visibility: "public"
            },
            compute_fibonacci: (n) => {
                console.log(`Computing fibonacci(${n})...`);
                if (n <= 1) return n;
                let a = 0, b = 1;
                for (let i = 2; i <= n; i++) {
                    [a, b] = [b, a + b];
                }
                return b;
            },
            get_client_info: () => ({
                client: "Deno",
                platform: Deno.build.os,
                arch: Deno.build.arch,
                version: Deno.version.deno
            })
        });
        
        console.log(`✅ Service registered with ID: ${clientService.id}`);
        console.log(`🧮 Test fibonacci: ${serverUrl}/default/services/${clientService.id.split('/')[1]}/compute_fibonacci?n=10`);
        
        // Test our own service
        const fibResult = await clientService.compute_fibonacci(10);
        console.log(`Fibonacci(10) = ${fibResult}`);
        
        console.log('\n🎉 All tests completed successfully!');
        console.log('🔄 Keeping connection alive... Press Ctrl+C to disconnect');
        
        // Keep the client alive
        await new Promise(() => {});
        
    } catch (error) {
        console.error('❌ Failed to connect or execute:', error);
        Deno.exit(1);
    }
}

// Handle graceful shutdown
const handleShutdown = () => {
    console.log('\n👋 Disconnecting client...');
    Deno.exit(0);
};

Deno.addSignalListener("SIGINT", handleShutdown);
Deno.addSignalListener("SIGTERM", handleShutdown);

// Start the client
if (import.meta.main) {
    await connectToHyphaServer();
} 