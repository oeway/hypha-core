/**
 * Deno ASGI Application Example
 * 
 * This example demonstrates how to create and serve ASGI applications
 * with the Deno Hypha server, similar to FastAPI but implemented in pure JavaScript.
 * 
 * Run with: deno run --allow-net examples/deno-asgi-example.js
 */

import { HyphaCore } from '../src/hypha-core.js';

/**
 * Simple ASGI application that mimics FastAPI behavior
 */
class SimpleAsgiApp {
    constructor() {
        this.routes = new Map();
    }

    /**
     * Add a route to the application
     */
    addRoute(path, method, handler) {
        const key = `${method.toUpperCase()}:${path}`;
        this.routes.set(key, handler);
    }

    /**
     * ASGI application callable
     */
    async serve(args) {
        const { scope, receive, send } = args;
        
        if (scope.type !== 'http') {
            throw new Error('Only HTTP requests are supported');
        }

        const method = scope.method;
        const path = scope.path;
        const key = `${method}:${path}`;
        
        // Check for exact route match
        let handler = this.routes.get(key);
        
        // If no exact match, try pattern matching (simple implementation)
        if (!handler) {
            for (const [routeKey, routeHandler] of this.routes.entries()) {
                const [routeMethod, routePath] = routeKey.split(':');
                if (routeMethod === method && this.matchPath(routePath, path)) {
                    handler = routeHandler;
                    break;
                }
            }
        }

        if (!handler) {
            // 404 Not Found
            await send({
                type: 'http.response.start',
                status: 404,
                headers: [
                    [new TextEncoder().encode('content-type'), new TextEncoder().encode('application/json')]
                ]
            });
            await send({
                type: 'http.response.body',
                body: new TextEncoder().encode(JSON.stringify({ detail: 'Not Found' })),
                more_body: false
            });
            return;
        }

        try {
            // Parse query string
            const queryString = new TextDecoder().decode(scope.query_string);
            const queryParams = new URLSearchParams(queryString);
            
            // Get request body
            const requestEvent = await receive();
            let body = null;
            if (requestEvent.body && requestEvent.body.length > 0) {
                const bodyStr = new TextDecoder().decode(requestEvent.body);
                try {
                    body = JSON.parse(bodyStr);
                } catch (e) {
                    body = bodyStr;
                }
            }

            // Create request context
            const request = {
                method,
                path,
                query: Object.fromEntries(queryParams.entries()),
                body,
                headers: this.parseHeaders(scope.headers)
            };

            // Call the handler
            const response = await handler(request);
            
            // Send response
            const status = response.status || 200;
            const headers = response.headers || {};
            const responseBody = response.body || '';

            // Convert headers to ASGI format
            const asgiHeaders = [];
            for (const [key, value] of Object.entries(headers)) {
                asgiHeaders.push([
                    new TextEncoder().encode(key.toLowerCase()),
                    new TextEncoder().encode(value.toString())
                ]);
            }

            await send({
                type: 'http.response.start',
                status,
                headers: asgiHeaders
            });

            let bodyBytes;
            if (typeof responseBody === 'string') {
                bodyBytes = new TextEncoder().encode(responseBody);
            } else if (responseBody instanceof Uint8Array) {
                bodyBytes = responseBody;
            } else {
                bodyBytes = new TextEncoder().encode(JSON.stringify(responseBody));
            }

            await send({
                type: 'http.response.body',
                body: bodyBytes,
                more_body: false
            });

        } catch (error) {
            console.error('Error in ASGI handler:', error);
            
            // 500 Internal Server Error
            await send({
                type: 'http.response.start',
                status: 500,
                headers: [
                    [new TextEncoder().encode('content-type'), new TextEncoder().encode('application/json')]
                ]
            });
            await send({
                type: 'http.response.body',
                body: new TextEncoder().encode(JSON.stringify({ detail: 'Internal Server Error' })),
                more_body: false
            });
        }
    }

    /**
     * Simple path matching (supports basic patterns)
     */
    matchPath(pattern, path) {
        // Convert pattern to regex (very basic implementation)
        const regexPattern = pattern
            .replace(/\{[^}]+\}/g, '([^/]+)')  // Replace {param} with capture group
            .replace(/\*/g, '.*');             // Replace * with .*
        
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(path);
    }

    /**
     * Parse ASGI headers format to object
     */
    parseHeaders(asgiHeaders) {
        const headers = {};
        for (const [key, value] of asgiHeaders) {
            const keyStr = new TextDecoder().decode(key);
            const valueStr = new TextDecoder().decode(value);
            headers[keyStr] = valueStr;
        }
        return headers;
    }
}

/**
 * Create a simple FastAPI-like application
 */
function createApp() {
    const app = new SimpleAsgiApp();

    // Add routes
    app.addRoute('/', 'GET', async (request) => {
        return {
            status: 200,
            headers: { 'content-type': 'text/html' },
            body: `
                <html>
                    <head><title>Deno ASGI Cat App</title></head>
                    <body>
                        <h1>🦕 Deno ASGI Cat App</h1>
                        <img src="https://cataas.com/cat?type=square" alt="Random Cat" style="max-width: 400px;">
                        <p><a href="/api/v1/test">Test API endpoint</a></p>
                        <p><a href="/api/v1/info">App info</a></p>
                    </body>
                </html>
            `
        };
    });

    app.addRoute('/api/v1/test', 'GET', async (request) => {
        return {
            status: 200,
            headers: { 'content-type': 'application/json' },
            body: { 
                message: "Hello from Deno ASGI! 🦕", 
                timestamp: new Date().toISOString(),
                query: request.query
            }
        };
    });

    app.addRoute('/api/v1/info', 'GET', async (request) => {
        return {
            status: 200,
            headers: { 'content-type': 'application/json' },
            body: {
                app: "Deno ASGI Example",
                deno_version: Deno.version.deno,
                v8_version: Deno.version.v8,
                typescript_version: Deno.version.typescript,
                platform: Deno.build.os,
                arch: Deno.build.arch
            }
        };
    });

    app.addRoute('/api/v1/echo', 'POST', async (request) => {
        return {
            status: 200,
            headers: { 'content-type': 'application/json' },
            body: {
                message: "Echo response",
                received: request.body,
                method: request.method,
                headers: request.headers
            }
        };
    });

    return app;
}

/**
 * Start the Hypha server and register the ASGI application
 */
async function startAsgiExample() {
    console.log('🦕 Starting Deno ASGI Application Example...');

    try {
        // Create ASGI app
        const app = createApp();

        // Start Hypha Core server
        const hyphaCore = new HyphaCore({
            name: "Deno ASGI Server",
            server_url: "ws://local-hypha-server:8080",
            workspace: "default"
        });

        await hyphaCore.start();
        console.log('✅ Hypha Core server started');

        // Get the workspace API
        const api = hyphaCore.workspaceManager.getDefaultService();

        // Register the ASGI service
        await api.registerService({
            id: "deno-asgi-cat-app",
            name: "Deno ASGI Cat App",
            description: "A simple ASGI application built with Deno that shows cat images",
            type: "asgi",  // This is the key - marks it as an ASGI service
            config: {
                require_context: true,
                visibility: "public"
            },
            serve: app.serve.bind(app)  // The ASGI callable
        });

        console.log('✅ ASGI service registered successfully!');
        console.log('🌐 Access your ASGI app at: http://localhost:8080/default/apps/deno-asgi-cat-app/');
        console.log('📋 Available endpoints:');
        console.log('   - / (HTML page with cat image)');
        console.log('   - /api/v1/test (JSON test endpoint)');
        console.log('   - /api/v1/info (App information)');
        console.log('   - /api/v1/echo (POST echo endpoint)');

        // Also register a regular function service for comparison
        await api.registerService({
            id: "deno-function-service",
            name: "Deno Function Service",
            description: "A regular function service for comparison",
            type: "functions",  // This is a regular function service
            config: {
                require_context: true,
                visibility: "public"
            },
            hello: (name = "World") => {
                return `Hello, ${name}! This is a function service response. 🦕`;
            },
            index: async (scope) => {
                // Function services get a scope object and should return response format
                return {
                    status: 200,
                    headers: { 'content-type': 'text/html' },
                    body: `
                        <html>
                            <head><title>Function Service</title></head>
                            <body>
                                <h1>🦕 Function Service Response</h1>
                                <p>This is served by a function service, not ASGI!</p>
                                <p>Method: ${scope.method}</p>
                                <p>Path: ${scope.path}</p>
                            </body>
                        </html>
                    `
                };
            }
        });

        console.log('✅ Function service also registered!');
        console.log('🌐 Access function service at: http://localhost:8080/default/apps/deno-function-service/');
        console.log('📋 Function service endpoints:');
        console.log('   - / (index function)');
        console.log('   - /hello (via services API: http://localhost:8080/default/services/deno-function-service/hello)');

        // Keep the server running
        console.log('\n🚀 Server is running! Press Ctrl+C to stop.');
        
        // Handle graceful shutdown
        const cleanup = async () => {
            console.log('\n🛑 Shutting down...');
            await hyphaCore.close();
            Deno.exit(0);
        };

        // Handle Ctrl+C
        Deno.addSignalListener("SIGINT", cleanup);
        Deno.addSignalListener("SIGTERM", cleanup);

        // Keep the process alive
        await new Promise(() => {}); // Run forever

    } catch (error) {
        console.error('❌ Failed to start ASGI example:', error);
        Deno.exit(1);
    }
}

// Run the example if this file is executed directly
if (import.meta.main) {
    await startAsgiExample();
}

export { createApp, SimpleAsgiApp }; 