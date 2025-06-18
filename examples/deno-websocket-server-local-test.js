/**
 * Local Test: Using Deno WebSocket Server from hypha-core package (local development)
 * 
 * This example demonstrates how to import and use the Deno WebSocket server
 * functionality from the local hypha-core build in a Deno environment.
 * 
 * To run this example in Deno:
 * deno run --allow-net --allow-read examples/deno-websocket-server-local-test.js
 */

// Import the main hypha-core functionality (Deno-specific build)
import { HyphaCore } from '../deno.js';

// Import Deno-specific WebSocket server functionality (clean Deno build)
import { 
    DenoWebSocketServer, 
    DenoWebSocketClient, 
    HyphaServiceProxy, 
    RedisClusterManager 
} from '../dist/deno/deno-websocket-server.js';

async function main() {
    console.log('🚀 Starting Deno WebSocket Server Local Test');
    
    // Create a HyphaCore instance
    const hyphaCore = new HyphaCore({
        host: 'localhost',
        port: 8080
    });
    
    // Start the hypha core server
    await hyphaCore.start();
    console.log('✓ HyphaCore started');
    
    // Create a Deno WebSocket server with hypha-core integration
    const server = new DenoWebSocketServer('ws://localhost:8080/ws', {
        hyphaCore: hyphaCore,
        clustered: false, // Set to true if using Redis clustering
        // redis: redisClient, // Uncomment if using clustering
    });
    
    console.log('✓ Deno WebSocket Server created and started');
    
    // Handle new client connections
    server.on('connection', (websocket) => {
        console.log('📱 New client connected');
        
        // Handle messages from the client
        websocket.on('message', (data) => {
            console.log('📨 Received message:', data);
            
            // Echo the message back
            websocket.send(data);
        });
        
        // Handle client disconnection
        websocket.on('close', () => {
            console.log('📱 Client disconnected');
        });
    });
    
    // Example of HTTP service proxy usage
    const serviceProxy = new HyphaServiceProxy(hyphaCore);
    console.log('✓ HTTP Service Proxy created');
    
    // Example: Get cluster status (if clustering is enabled)
    const clusterStatus = await server.getClusterStatus();
    console.log('📊 Cluster Status:', clusterStatus);
    
    // Example: List connected clients
    const clients = server.getClients();
    console.log(`👥 Connected clients: ${clients.length}`);
    
    console.log('\n🎉 Server is running!');
    console.log('   - WebSocket endpoint: ws://localhost:8080/ws');
    console.log('   - HTTP services: http://localhost:8080/{workspace}/services');
    console.log('   - ASGI apps: http://localhost:8080/{workspace}/apps/{service_id}');
    console.log('\n   Press Ctrl+C to stop the server');
    
    // Graceful shutdown
    const cleanup = async () => {
        console.log('\n🛑 Shutting down server...');
        await server.close();
        await hyphaCore.close();
        console.log('✓ Server stopped');
        Deno.exit(0);
    };
    
    // Handle shutdown signals
    Deno.addSignalListener('SIGINT', cleanup);
    Deno.addSignalListener('SIGTERM', cleanup);
}

// Simplified client test that doesn't interfere with server startup
async function testHttpEndpoints() {
    console.log('\n🌐 Testing HTTP endpoints...');
    
    try {
        // Test health endpoint
        const healthResponse = await fetch('http://localhost:8080/health');
        if (healthResponse.ok) {
            const health = await healthResponse.json();
            console.log('✓ Health endpoint working:', health);
        }
        
        // Test workspace services endpoint
        try {
            const servicesResponse = await fetch('http://localhost:8080/default/services');
            if (servicesResponse.ok) {
                const services = await servicesResponse.json();
                console.log('✓ Services endpoint working, found', services.length, 'services');
            } else {
                console.log('ℹ️ Services endpoint returned:', servicesResponse.status);
            }
        } catch (e) {
            console.log('ℹ️ Services endpoint test:', e.message);
        }
        
    } catch (error) {
        console.log('ℹ️ HTTP endpoint tests:', error.message);
    }
}

// Run the example
if (import.meta.main) {
    try {
        await main();
        
        // Wait a bit then test HTTP endpoints
        setTimeout(testHttpEndpoints, 3000);
        
    } catch (error) {
        console.error('❌ Error starting server:', error);
        Deno.exit(1);
    }
} 