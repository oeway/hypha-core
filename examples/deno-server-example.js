#!/usr/bin/env -S deno run --allow-net --allow-env
/**
 * Deno Server Example
 * 
 * This example shows how to use hypha-core with real WebSocket connections in Deno
 * using the DenoWebSocketServer wrapper. It also exposes HTTP service endpoints
 * for REST API access to registered services.
 * 
 * To run this example:
 * deno run --allow-net --allow-env examples/deno-server-example.js
 */

import { HyphaCore } from '../src/hypha-core.js';
import { DenoWebSocketServer, DenoWebSocketClient } from '../src/deno-websocket-server.js';

async function startHyphaServer() {
    console.log('🚀 Starting Hypha Core server with real WebSocket support and HTTP API in Deno...');
    
    const config = {
        url: "http://localhost:9527",  // Use localhost instead of local-hypha-server
        ServerClass: DenoWebSocketServer,  // Use our Deno wrapper
        WebSocketClass: DenoWebSocketClient, // Use our Deno WebSocket client wrapper
        jwtSecret: "deno-hypha-secret-key",
        defaultService: {
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
    const api = await hyphaCore.start();
    
    try {
        await api.registerService({
            id: "hello-world",  // Use proper service ID format
            name: "Hello World Demo Service",
            description: "A demo service with greeting, time, and math functions",
            config: {
                require_context: true,
                visibility: "public"
            },
            // Service functions
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
            },
            get_server_info: (context) => ({
                platform: "Deno",
                version: Deno.version.deno,
                v8: Deno.version.v8,
                typescript: Deno.version.typescript,
                server: "hypha-core-deno"
            }),
            math: {
                add: (a, b, context) => {
                    const result = a + b;
                    console.log(`Math.add called: ${a} + ${b} = ${result}`, context ? `from ${context.from}` : '');
                    return result;
                },
                multiply: (a, b, context) => {
                    const result = a * b;
                    console.log(`Math.multiply called: ${a} * ${b} = ${result}`, context ? `from ${context.from}` : '');
                    return result;
                }
            }
        });
        
        console.log(`✅ Hello-world service registered`);
        
        // Set up WebSocket connection handling
       
        
        console.log('✅ Hypha Core server started successfully!');
        console.log(`📍 Server URL: ${hyphaCore.url}`);
        console.log(`🔌 WebSocket URL: ${hyphaCore.wsUrl}`);
        console.log(`🌐 Test health endpoint: ${hyphaCore.url}/health`);
        
        // Test service listing
        console.log('\n📋 Listing all services...');
        try {
            const services = await api.listServices();
            console.log(`Found ${services.length} services:`);
            services.forEach(service => {
                console.log(`  - ${service.id}: ${service.name} (${service.config?.visibility || 'unknown visibility'})`);
            });
        } catch (error) {
            console.error('Error listing services:', error);
        }
        
        console.log('🎉 Services registered successfully!');
        
        // Display available HTTP endpoints
        console.log('\n🌐 Available HTTP API endpoints:');
        console.log('📋 Service Management:');
        console.log(`  GET  ${hyphaCore.url}/default/services`);
        console.log(`  GET  ${hyphaCore.url}/default/services/{service_id}`);
        console.log('\n🔧 Service Functions:');
        console.log(`  GET  ${hyphaCore.url}/default/services/hello-world/hello?name=Deno`);
        console.log(`  POST ${hyphaCore.url}/default/services/hello-world/hello`);
        console.log(`  GET  ${hyphaCore.url}/default/services/hello-world/get_time`);
        console.log(`  GET  ${hyphaCore.url}/default/services/hello-world/math.add?a=5&b=3`);
        console.log(`  POST ${hyphaCore.url}/default/services/hello-world/math.multiply`);
        console.log(`  GET  ${hyphaCore.url}/default/services/hello-world/get_server_info`);
        console.log('\n📝 Example POST request body:');
        console.log('  Content-Type: application/json');
        console.log('  {"name": "Deno User"}');
        console.log('  {"a": 10, "b": 20}');
        
        console.log('\n💡 Test examples:');
        console.log(`  curl "${hyphaCore.url}/default/services/hello-world/hello?name=TestUser"`);
        console.log(`  curl "${hyphaCore.url}/default/services/hello-world/math.add?a=10&b=5"`);
        console.log(`  curl -X POST -H "Content-Type: application/json" -d '{"name":"API User"}' "${hyphaCore.url}/default/services/hello-world/hello"`);
        
        // Keep the server running
        console.log('\n🔄 Server is running... Press Ctrl+C to stop');
        
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