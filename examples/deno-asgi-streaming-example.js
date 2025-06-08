/**
 * Deno ASGI Streaming Application Example
 * 
 * This example demonstrates streaming responses with ASGI applications
 * in the Deno Hypha server, similar to FastAPI streaming.
 * 
 * Run with: deno run --allow-net examples/deno-asgi-streaming-example.js
 */

import { HyphaCore } from '../src/hypha-core.js';
import { SimpleAsgiApp } from './deno-asgi-example.js';

/**
 * Create a streaming ASGI application
 */
function createStreamingApp() {
    const app = new SimpleAsgiApp();

    // Home page with links to streaming endpoints
    app.addRoute('/', 'GET', async (request) => {
        return {
            status: 200,
            headers: { 'content-type': 'text/html' },
            body: `
                <html>
                    <head><title>🦕 Deno ASGI Streaming Demo</title></head>
                    <body>
                        <h1>🦕 Deno ASGI Streaming Demo</h1>
                        <p>Try these streaming endpoints:</p>
                        <ul>
                            <li><a href="/stream/text">📝 Text Streaming</a> - Incremental text chunks</li>
                            <li><a href="/stream/json">📊 JSON Streaming</a> - JSON data chunks</li>
                            <li><a href="/stream/progress">⏱️ Progress Updates</a> - Real-time progress</li>
                            <li><a href="/stream/large-data">💾 Large Dataset</a> - Simulated large response</li>
                            <li><a href="/stream/events">📡 Server-Sent Events</a> - Event stream</li>
                        </ul>
                        <p><strong>Note:</strong> These endpoints stream data in real-time!</p>
                    </body>
                </html>
            `
        };
    });

    // Text streaming endpoint
    app.addRoute('/stream/text', 'GET', async (request) => {
        return {
            status: 200,
            headers: { 'content-type': 'text/plain' },
            body: createTextStream()
        };
    });

    // JSON streaming endpoint
    app.addRoute('/stream/json', 'GET', async (request) => {
        return {
            status: 200,
            headers: { 'content-type': 'application/json' },
            body: createJsonStream()
        };
    });

    // Progress updates streaming
    app.addRoute('/stream/progress', 'GET', async (request) => {
        return {
            status: 200,
            headers: { 'content-type': 'text/html' },
            body: createProgressStream()
        };
    });

    // Large dataset simulation
    app.addRoute('/stream/large-data', 'GET', async (request) => {
        return {
            status: 200,
            headers: { 'content-type': 'application/json' },
            body: createLargeDataStream()
        };
    });

    // Server-Sent Events
    app.addRoute('/stream/events', 'GET', async (request) => {
        return {
            status: 200,
            headers: { 
                'content-type': 'text/event-stream',
                'cache-control': 'no-cache',
                'connection': 'keep-alive'
            },
            body: createEventStream()
        };
    });

    return app;
}

/**
 * Create a text streaming generator
 */
async function* createTextStream() {
    const words = [
        "🦕 Deno", "ASGI", "streaming", "is", "working!", "\n",
        "This", "text", "is", "being", "streamed", "word", "by", "word.", "\n",
        "Each", "chunk", "is", "sent", "separately", "to", "demonstrate", "\n",
        "real-time", "streaming", "capabilities", "in", "Hypha!", "\n\n",
        "🚀 Streaming", "complete!"
    ];

    for (const word of words) {
        yield word + " ";
        // Add delay to simulate real-time streaming
        await new Promise(resolve => setTimeout(resolve, 200));
    }
}

/**
 * Create a JSON streaming generator
 */
async function* createJsonStream() {
    yield '{\n  "streaming": true,\n  "chunks": [\n';
    
    for (let i = 1; i <= 10; i++) {
        const chunk = {
            id: i,
            timestamp: new Date().toISOString(),
            data: `Chunk ${i} of 10`,
            progress: Math.round((i / 10) * 100)
        };
        
        const isLast = i === 10;
        yield `    ${JSON.stringify(chunk)}${isLast ? '\n' : ',\n'}`;
        
        await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    yield '  ],\n  "completed": true\n}';
}

/**
 * Create a progress streaming generator with HTML
 */
async function* createProgressStream() {
    yield `
        <html>
            <head><title>Progress Stream</title></head>
            <body>
                <h1>🦕 Real-time Progress Updates</h1>
                <div style="width: 500px; border: 1px solid #ccc; padding: 20px;">
    `;

    for (let i = 0; i <= 100; i += 10) {
        const progressBar = '█'.repeat(i / 10) + '░'.repeat(10 - i / 10);
        yield `
                    <div>Progress: ${i}% [${progressBar}]</div>
                    <script>window.scrollTo(0, document.body.scrollHeight);</script>
        `;
        
        if (i < 100) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    yield `
                    <div style="color: green; font-weight: bold;">✅ Complete!</div>
                </div>
            </body>
        </html>
    `;
}

/**
 * Create a large dataset streaming generator
 */
async function* createLargeDataStream() {
    yield '{\n  "dataset": "large_data_simulation",\n  "records": [\n';
    
    const totalRecords = 50;
    for (let i = 1; i <= totalRecords; i++) {
        const record = {
            id: i,
            name: `Record ${i}`,
            value: Math.random() * 1000,
            timestamp: new Date().toISOString(),
            category: `Category ${Math.ceil(i / 10)}`,
            metadata: {
                processed: true,
                version: "1.0",
                tags: [`tag${i % 5}`, `category${Math.ceil(i / 10)}`]
            }
        };
        
        const isLast = i === totalRecords;
        yield `    ${JSON.stringify(record)}${isLast ? '\n' : ',\n'}`;
        
        // Small delay to show streaming effect
        if (i % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    yield `  ],\n  "total_records": ${totalRecords},\n  "generated_at": "${new Date().toISOString()}"\n}`;
}

/**
 * Create Server-Sent Events stream
 */
async function* createEventStream() {
    // Send initial connection event
    yield `data: {"type": "connection", "message": "Stream connected", "timestamp": "${new Date().toISOString()}"}\n\n`;
    
    for (let i = 1; i <= 20; i++) {
        const eventData = {
            type: "update",
            id: i,
            message: `Event ${i}: Random number is ${Math.random().toFixed(3)}`,
            timestamp: new Date().toISOString(),
            data: {
                counter: i,
                random: Math.random(),
                server: "deno-asgi"
            }
        };
        
        yield `id: ${i}\n`;
        yield `event: update\n`;
        yield `data: ${JSON.stringify(eventData)}\n\n`;
        
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Send completion event
    yield `data: {"type": "complete", "message": "Stream completed", "timestamp": "${new Date().toISOString()}"}\n\n`;
}

/**
 * Override the SimpleAsgiApp to support streaming responses
 */
class StreamingAsgiApp extends SimpleAsgiApp {
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
        
        // If no exact match, try pattern matching
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
            // Parse query string and body
            const queryString = new TextDecoder().decode(scope.query_string);
            const queryParams = new URLSearchParams(queryString);
            
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
            
            // Send response start
            const status = response.status || 200;
            const headers = response.headers || {};

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

            // Handle streaming vs regular responses
            const responseBody = response.body;
            
            if (responseBody && typeof responseBody[Symbol.asyncIterator] === 'function') {
                // Streaming response - iterate through the generator
                for await (const chunk of responseBody) {
                    let bodyBytes;
                    if (typeof chunk === 'string') {
                        bodyBytes = new TextEncoder().encode(chunk);
                    } else if (chunk instanceof Uint8Array) {
                        bodyBytes = chunk;
                    } else {
                        bodyBytes = new TextEncoder().encode(JSON.stringify(chunk));
                    }

                    await send({
                        type: 'http.response.body',
                        body: bodyBytes,
                        more_body: true // Indicate more chunks are coming
                    });
                }
                
                // Send final empty chunk to close the stream
                await send({
                    type: 'http.response.body',
                    body: new Uint8Array(),
                    more_body: false
                });
            } else {
                // Regular response
                let bodyBytes;
                if (typeof responseBody === 'string') {
                    bodyBytes = new TextEncoder().encode(responseBody);
                } else if (responseBody instanceof Uint8Array) {
                    bodyBytes = responseBody;
                } else {
                    bodyBytes = new TextEncoder().encode(JSON.stringify(responseBody || ''));
                }

                await send({
                    type: 'http.response.body',
                    body: bodyBytes,
                    more_body: false
                });
            }

        } catch (error) {
            console.error('Error in streaming ASGI handler:', error);
            
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
}

/**
 * Start the streaming ASGI example
 */
async function startStreamingExample() {
    console.log('🦕 Starting Deno ASGI Streaming Example...');

    try {
        // Create streaming ASGI app
        const app = new StreamingAsgiApp();
        
        // Add all the streaming routes
        const routes = createStreamingApp().routes;
        for (const [key, handler] of routes.entries()) {
            app.routes.set(key, handler);
        }

        // Start Hypha Core server
        const hyphaCore = new HyphaCore({
            name: "Deno ASGI Streaming Server",
            server_url: "ws://local-hypha-server:8080",
            workspace: "default"
        });

        await hyphaCore.start();
        console.log('✅ Hypha Core server started');

        // Get the workspace API
        const api = hyphaCore.workspaceManager.getDefaultService();

        // Register the streaming ASGI service
        await api.registerService({
            id: "deno-streaming-app",
            name: "Deno Streaming ASGI App",
            description: "A streaming ASGI application demonstrating real-time responses",
            type: "asgi",
            config: {
                require_context: true,
                visibility: "public"
            },
            serve: app.serve.bind(app)
        });

        console.log('✅ Streaming ASGI service registered successfully!');
        console.log('🌐 Access your streaming app at: http://localhost:8080/default/apps/deno-streaming-app/');
        console.log('📋 Available streaming endpoints:');
        console.log('   - / (Home page with links)');
        console.log('   - /stream/text (Text streaming)');
        console.log('   - /stream/json (JSON streaming)');
        console.log('   - /stream/progress (Progress updates)');
        console.log('   - /stream/large-data (Large dataset)');
        console.log('   - /stream/events (Server-Sent Events)');

        console.log('\n🚀 Streaming server is running! Press Ctrl+C to stop.');
        console.log('💡 Try the streaming endpoints in your browser to see real-time updates!');
        
        // Handle graceful shutdown
        const cleanup = async () => {
            console.log('\n🛑 Shutting down...');
            await hyphaCore.close();
            Deno.exit(0);
        };

        Deno.addSignalListener("SIGINT", cleanup);
        Deno.addSignalListener("SIGTERM", cleanup);

        // Keep the process alive
        await new Promise(() => {}); // Run forever

    } catch (error) {
        console.error('❌ Failed to start streaming example:', error);
        Deno.exit(1);
    }
}

// Run the example if this file is executed directly
if (import.meta.main) {
    await startStreamingExample();
}

export { createStreamingApp, StreamingAsgiApp, createTextStream, createJsonStream }; 