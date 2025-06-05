#!/usr/bin/env -S deno run --allow-net --allow-env
/**
 * Deno Server Example
 * 
 * This example shows how to use hypha-core with real WebSocket connections in Deno
 * using the DenoWebSocketServer wrapper.
 * 
 * To run this example:
 * deno run --allow-net --allow-env examples/deno-server-example.js
 */

import { HyphaCore } from '../src/hypha-core.js';
import { DenoWebSocketServer, DenoWebSocketClient } from '../src/deno-websocket-server.js';
import { Workspace } from '../src/workspace.js';

async function startHyphaServer() {
    console.log('🚀 Starting Hypha Core server with real WebSocket support in Deno...');
    
    const config = {
        url: "https://localhost:9527",  // Use localhost instead of local-hypha-server
        ServerClass: DenoWebSocketServer,  // Use our Deno wrapper
        WebSocketClass: DenoWebSocketClient, // Use our Deno WebSocket client wrapper
        jwtSecret: "deno-hypha-secret-key",
        default_service: {
            // Default services always get context (as mentioned by user)
            echo: (message, context) => {
                console.log(`Echo service called with: ${message}`, context ? `from ${context.from}` : '');
                return `Echo: ${message}`;
            },
            get_server_info: (context) => ({
                platform: "Deno",
                version: Deno.version.deno,
                v8: Deno.version.v8,
                typescript: Deno.version.typescript,
                server: "hypha-core-deno"
            })
        }
    };
    
    // Create and start the Hypha server
    const hyphaCore = new HyphaCore(config);
    
    try {
        // Start the server components manually to avoid the self-connection issue
        if (HyphaCore.servers[hyphaCore.url]) {
            throw new Error(`Server already running at ${hyphaCore.url}`);
        }
        
        // Start the WebSocket server
        hyphaCore.server = new DenoWebSocketServer(hyphaCore.wsUrl, { mock: false });
        HyphaCore.servers[hyphaCore.url] = hyphaCore.server;
        
        // Set up workspace manager
        hyphaCore.workspaceManager = new Workspace(hyphaCore);
        await hyphaCore.workspaceManager.setup({
            client_id: hyphaCore.workspaceManagerId,
            method_timeout: 60,
            default_service: Object.assign(hyphaCore.defaultServices, {
                // Add hello as a default service so it's accessible as server.hello()
                hello: (name, context) => {
                    // Default services always get context, handle the case where name might not be provided
                    if (typeof name === 'object' && name.from) {
                        // If first argument is context object, then no name was provided
                        context = name;
                        name = "World";
                    }
                    name = name || "World";
                    const greeting = `Hello, ${name}! Greetings from Deno Hypha Server 🦕`;
                    console.log(`Hello service called: ${greeting}`, context ? `from ${context.from}` : '');
                    return greeting;
                },
                get_time: (context) => {
                    const now = new Date();
                    console.log(`Time service called: ${now.toISOString()}`, context ? `from ${context.from}` : '');
                    return now.toISOString();
                }
            }),
        });
        
        console.log(`✅ Services registered with workspace manager`);
        
        // Set up WebSocket connection handling
        hyphaCore.server.on('connection', async websocket => {
            await hyphaCore._handleWebsocketConnection(websocket);
        });
        
        console.log('✅ Hypha Core server started successfully!');
        console.log(`📍 Server URL: ${hyphaCore.url}`);
        console.log(`🔌 WebSocket URL: ${hyphaCore.wsUrl}`);
        console.log(`🌐 Test health endpoint: ${hyphaCore.url}/health`);
        
        // Test service listing
        console.log('\n📋 Listing all services...');
        try {
            const rootContext = {
                ws: "default",
                from: "default/workspace-manager",
                user: { id: "workspace-manager", is_anonymous: false, email: "system@localhost", roles: ["admin"] }
            };
            const services = await hyphaCore.workspaceManager.listServices({}, rootContext);
            console.log(`Found ${services.length} services:`);
            services.forEach(service => {
                console.log(`  - ${service.id}: ${service.name} (${service.config?.visibility || 'unknown visibility'})`);
            });
        } catch (error) {
            console.error('Error listing services:', error);
        }
        
        console.log('🎉 Services registered successfully!');
        console.log(`🔗 Test the service: ${hyphaCore.url}/default/services/hello-world/hello?name=Deno`);
        
        // Keep the server running
        console.log('🔄 Server is running... Press Ctrl+C to stop');
        
        // Handle graceful shutdown
        const handleShutdown = () => {
            console.log('\n🛑 Shutting down server...');
            hyphaCore.close();
            Deno.exit(0);
        };
        
        // Listen for termination signals
        Deno.addSignalListener("SIGINT", handleShutdown);
        Deno.addSignalListener("SIGTERM", handleShutdown);
        
        // Keep the process alive
        await new Promise(() => {}); // Run forever until interrupted
        
    } catch (error) {
        console.error('❌ Failed to start Hypha server:', error);
        hyphaCore.close();
        Deno.exit(1);
    }
}

// Start the server
if (import.meta.main) {
    await startHyphaServer();
} 