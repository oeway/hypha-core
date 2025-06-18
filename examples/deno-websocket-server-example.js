/**
 * Example: Using Deno WebSocket Server from hypha-core package
 * 
 * This example demonstrates how to import and use the Deno WebSocket server
 * functionality from the hypha-core npm package in a Deno environment.
 * 
 * To run this example in Deno:
 * deno run --allow-net --allow-read --allow-env examples/deno-websocket-server-example.js
 * 
 * This example uses hypha-core@0.20.56-pre8 from npm.
 * For local development, use deno-websocket-server-local-test.js instead.
 */

// Import the main hypha-core functionality from npm
import { HyphaCore } from 'npm:hypha-core@0.20.56-pre9';

// Import Deno-specific WebSocket server functionality from npm
import { 
    DenoWebSocketServer, 
    DenoWebSocketClient,
    HyphaServiceProxy,
} from 'npm:hypha-core@0.20.56-pre9/deno-websocket-server';

async function main() {
    console.log('🚀 Starting Deno WebSocket Server Example');
    
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

// Example client usage
async function clientExample() {
    console.log('\n🔌 Testing WebSocket Client');
    
    try {
        // Create a WebSocket client
        const client = new DenoWebSocketClient('ws://localhost:8080/ws');
        
        client.on('open', () => {
            console.log('✓ Client connected');
            
            // Send a test message
            client.send('Hello from Deno client!');
        });
        
        client.on('message', (data) => {
            console.log('📨 Client received:', data);
        });
        
        client.on('close', () => {
            console.log('✓ Client disconnected');
        });
        
    } catch (error) {
        console.error('❌ Client error:', error);
    }
}

// Run the example
if (import.meta.main) {
    try {
        await main();
        
        // Wait a bit then test the client
        setTimeout(clientExample, 2000);
        
    } catch (error) {
        console.error('❌ Error starting server:', error);
        Deno.exit(1);
    }
} 