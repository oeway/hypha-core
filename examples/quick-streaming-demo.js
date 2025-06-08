#!/usr/bin/env -S deno run --allow-net --allow-env
/**
 * Quick Streaming Demo
 * 
 * A simple demonstration of the ASGI streaming functionality
 * Run with: deno run --allow-net --allow-env examples/quick-streaming-demo.js
 */

import { HyphaCore } from '../src/hypha-core.js';
import { DenoWebSocketServer, DenoWebSocketClient } from '../src/deno-websocket-server.js';

// Simple ASGI app with streaming support
class DemoStreamingApp {
    async serve(args) {
        const { scope, receive, send } = args;
        
        if (scope.type !== 'http') {
            throw new Error('Only HTTP requests are supported');
        }

        const path = scope.path;
        
        // Route to different streaming examples
        if (path === '/counter') {
            await this.handleCounterStream(send);
        } else if (path === '/progress') {
            await this.handleProgressStream(send);
        } else if (path === '/data') {
            await this.handleDataStream(send);
        } else {
            await this.handleIndexPage(send);
        }
    }

    async handleIndexPage(send) {
        await send({
            type: 'http.response.start',
            status: 200,
            headers: [[new TextEncoder().encode('content-type'), new TextEncoder().encode('text/html')]]
        });

        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Hypha Streaming Demo</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #333; text-align: center; }
        .demo-links { display: grid; gap: 20px; margin-top: 30px; }
        .demo-link { 
            display: block; 
            padding: 20px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            text-decoration: none; 
            border-radius: 8px; 
            text-align: center; 
            font-weight: bold;
            transition: transform 0.2s;
        }
        .demo-link:hover { transform: translateY(-2px); }
        .info { background: #e8f4fd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #2196F3; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Hypha ASGI Streaming Demo</h1>
        
        <div class="info">
            <strong>✨ Real-time streaming examples:</strong> Each link below demonstrates different types of streaming responses. 
            Open the browser developer tools to see chunks arriving in real-time!
        </div>
        
        <div class="demo-links">
            <a href="/counter" class="demo-link">
                📊 Counter Stream - Watch numbers increment in real-time
            </a>
            <a href="/progress" class="demo-link">
                ⏳ Progress Stream - Real-time progress bar updates
            </a>
            <a href="/data" class="demo-link">
                📦 Data Stream - Chunked JSON data delivery
            </a>
        </div>
        
        <div class="info">
            <strong>🔧 Test with curl:</strong><br>
            <code>curl http://localhost:9529/default/apps/demo-streaming-service/counter</code><br>
            <code>curl http://localhost:9529/default/apps/demo-streaming-service/progress</code><br>
            <code>curl http://localhost:9529/default/apps/demo-streaming-service/data</code>
        </div>
    </div>
</body>
</html>`;

        await send({
            type: 'http.response.body',
            body: new TextEncoder().encode(html),
            more_body: false
        });
    }

    async handleCounterStream(send) {
        await send({
            type: 'http.response.start',
            status: 200,
            headers: [
                [new TextEncoder().encode('content-type'), new TextEncoder().encode('text/plain')],
                [new TextEncoder().encode('cache-control'), new TextEncoder().encode('no-cache')]
            ]
        });

        // Stream counter values
        for (let i = 1; i <= 10; i++) {
            const chunk = `Count: ${i}\n`;
            console.log(`📊 Streaming: ${chunk.trim()}`);
            
            await send({
                type: 'http.response.body',
                body: new TextEncoder().encode(chunk),
                more_body: true
            });
            
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        await send({
            type: 'http.response.body',
            body: new TextEncoder().encode('🎉 Counter complete!\n'),
            more_body: false
        });
    }

    async handleProgressStream(send) {
        await send({
            type: 'http.response.start',
            status: 200,
            headers: [
                [new TextEncoder().encode('content-type'), new TextEncoder().encode('text/plain')],
                [new TextEncoder().encode('cache-control'), new TextEncoder().encode('no-cache')]
            ]
        });

        // Stream progress updates
        for (let progress = 0; progress <= 100; progress += 10) {
            const bar = '█'.repeat(Math.floor(progress / 10)) + '░'.repeat(10 - Math.floor(progress / 10));
            const chunk = `Progress: ${bar} ${progress}%\n`;
            console.log(`⏳ Streaming: ${chunk.trim()}`);
            
            await send({
                type: 'http.response.body',
                body: new TextEncoder().encode(chunk),
                more_body: true
            });
            
            await new Promise(resolve => setTimeout(resolve, 300));
        }

        await send({
            type: 'http.response.body',
            body: new TextEncoder().encode('✅ Progress complete!\n'),
            more_body: false
        });
    }

    async handleDataStream(send) {
        await send({
            type: 'http.response.start',
            status: 200,
            headers: [
                [new TextEncoder().encode('content-type'), new TextEncoder().encode('application/json')],
                [new TextEncoder().encode('cache-control'), new TextEncoder().encode('no-cache')]
            ]
        });

        // Start JSON array
        await send({
            type: 'http.response.body',
            body: new TextEncoder().encode('{"streaming_data": [\n'),
            more_body: true
        });

        // Stream individual data items
        for (let i = 1; i <= 5; i++) {
            const item = {
                id: i,
                timestamp: new Date().toISOString(),
                data: `Sample data item ${i}`,
                random: Math.floor(Math.random() * 1000)
            };
            
            const isLast = i === 5;
            const chunk = `  ${JSON.stringify(item)}${isLast ? '' : ','}\n`;
            console.log(`📦 Streaming JSON item: ${i}`);
            
            await send({
                type: 'http.response.body',
                body: new TextEncoder().encode(chunk),
                more_body: true
            });
            
            await new Promise(resolve => setTimeout(resolve, 400));
        }

        // Close JSON array
        await send({
            type: 'http.response.body',
            body: new TextEncoder().encode(']}\n'),
            more_body: false
        });
    }
}

async function runStreamingDemo() {
    console.log('🚀 Starting Hypha Streaming Demo...\n');
    
    let hyphaCore;
    try {
        // Create and start server
        hyphaCore = new HyphaCore({
            url: "http://localhost:9529",
            ServerClass: DenoWebSocketServer,
            WebSocketClass: DenoWebSocketClient,
            jwtSecret: "demo-streaming-secret"
        });

        const api = await hyphaCore.start();
        console.log('✅ Hypha server started on http://localhost:9529');

        // Register the streaming demo service
        const app = new DemoStreamingApp();
        await api.registerService({
            id: "demo-streaming-service",
            name: "Demo Streaming Service",
            description: "Demonstrates real-time streaming capabilities",
            type: "asgi",
            config: {
                require_context: true,
                visibility: "public"
            },
            serve: app.serve.bind(app)
        });

        console.log('✅ Demo streaming service registered\n');
        
        console.log('🌐 Demo URLs:');
        console.log('   📋 Main page: http://localhost:9529/default/apps/demo-streaming-service/');
        console.log('   📊 Counter:   http://localhost:9529/default/apps/demo-streaming-service/counter');
        console.log('   ⏳ Progress:  http://localhost:9529/default/apps/demo-streaming-service/progress');
        console.log('   📦 Data:      http://localhost:9529/default/apps/demo-streaming-service/data');
        
        console.log('\n💡 Try these curl commands to see streaming in action:');
        console.log('   curl http://localhost:9529/default/apps/demo-streaming-service/counter');
        console.log('   curl http://localhost:9529/default/apps/demo-streaming-service/progress');
        console.log('   curl http://localhost:9529/default/apps/demo-streaming-service/data');
        
        console.log('\n🔄 Server is running... Press Ctrl+C to stop\n');

        // Handle graceful shutdown
        const handleShutdown = () => {
            console.log('\n🛑 Shutting down demo server...');
            hyphaCore.close();
            Deno.exit(0);
        };

        Deno.addSignalListener("SIGINT", handleShutdown);
        Deno.addSignalListener("SIGTERM", handleShutdown);

        // Keep running
        await new Promise(() => {});

    } catch (error) {
        console.error('❌ Failed to start streaming demo:', error);
        if (hyphaCore) {
            hyphaCore.close();
        }
        Deno.exit(1);
    }
}

if (import.meta.main) {
    await runStreamingDemo();
} 