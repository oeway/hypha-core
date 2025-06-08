# Hypha Core Examples

This directory contains examples demonstrating various features of Hypha Core.

## Available Examples

> **Note**: Comprehensive integration tests for ASGI functionality, HTTP endpoints, and streaming have been moved to `test/integration/`. The examples here serve as demonstrations and quick testing tools.

### Basic Deno Server
- **`deno-server-example.js`**: Basic Deno WebSocket server with service registration
- **`test-deno-server.py`**: Python client test for the Deno server

### ASGI Applications (NEW! 🦕)
- **`deno-asgi-example.js`**: Complete ASGI application example with routing
- **`deno-asgi-streaming-example.js`**: Streaming ASGI application with real-time responses
- **`quick-streaming-demo.js`**: Interactive streaming demo with multiple examples

### Python Examples  
- **`test-workspace-manager.py`**: Workspace management functionality
- **`test-built-in-services.py`**: Built-in services testing

## ASGI Support in Deno

The Deno Hypha server now supports both **ASGI applications** and **function services**, just like the Python version! This allows you to serve web applications similar to FastAPI but implemented in pure JavaScript/TypeScript.

### Key Features

- ✅ **ASGI Protocol**: Full ASGI (Asynchronous Server Gateway Interface) support
- ✅ **HTTP Routing**: Request routing with path parameters and query strings  
- ✅ **Function Services**: Traditional function-based services
- ✅ **Service Types**: Automatic detection and handling of `asgi` vs `functions` service types
- ✅ **CORS Support**: Built-in CORS headers for cross-origin requests
- ✅ **Streaming**: Full streaming response support with ReadableStream and async generators

### Quick Start: ASGI Application

```javascript
import { HyphaCore } from '../src/index.js';

// Create a simple ASGI app
class SimpleAsgiApp {
    constructor() {
        this.routes = new Map();
    }

    addRoute(path, method, handler) {
        const key = `${method.toUpperCase()}:${path}`;
        this.routes.set(key, handler);
    }

    async serve(args) {
        const { scope, receive, send } = args;
        // ... ASGI protocol implementation
    }
}

// Create and configure the app
const app = new SimpleAsgiApp();
app.addRoute('/', 'GET', async (request) => {
    return {
        status: 200,
        headers: { 'content-type': 'application/json' },
        body: { message: 'Hello from Deno ASGI! 🦕' }
    };
});

// Start Hypha and register the ASGI service
const hyphaCore = new HyphaCore({
    server_url: "ws://local-hypha-server:8080",
    workspace: "default"
});

await hyphaCore.start();
const api = hyphaCore.workspaceManager.getDefaultService();

await api.registerService({
    id: "my-asgi-app",
    type: "asgi",  // Mark as ASGI service
    serve: app.serve.bind(app)
});
```

### Service Types Comparison

| Feature | ASGI Services | Function Services |
|---------|---------------|-------------------|
| **URL Pattern** | `/{workspace}/apps/{service_id}/path` | `/{workspace}/services/{service_id}/function` |
| **Protocol** | Full ASGI (scope, receive, send) | Simple function calls |
| **Routing** | Internal app routing | Per-function endpoints |
| **Use Case** | Web applications, complex APIs | Simple functions, microservices |
| **Similarity** | Like FastAPI/Django | Like AWS Lambda |

### URL Patterns

**ASGI Services** (type: "asgi"):
- App access: `http://localhost:8080/{workspace}/apps/{service_id}/`
- All paths route to the ASGI app's internal router

**Function Services** (type: "functions"):  
- App access: `http://localhost:8080/{workspace}/apps/{service_id}/` (calls `index` function)
- Function access: `http://localhost:8080/{workspace}/services/{service_id}/{function_name}`

### Examples Usage

**Run the ASGI example:**
```bash
deno run --allow-net examples/deno-asgi-example.js
```

**Run the streaming ASGI example:**
```bash
deno run --allow-net examples/deno-asgi-streaming-example.js
```

**Test streaming functionality:**
```bash
deno run --allow-net examples/quick-streaming-demo.js  
```

**Basic server example:**
```bash
deno run --allow-net examples/deno-server-example.js
```

### Access Your Applications

Once running, you can access:

- **ASGI App**: `http://localhost:8080/default/apps/deno-asgi-cat-app/`
- **Streaming App**: `http://localhost:8080/default/apps/deno-streaming-app/`
- **Function App**: `http://localhost:8080/default/apps/deno-function-service/`  
- **Function API**: `http://localhost:8080/default/services/deno-function-service/hello`
- **Service Info**: `http://localhost:8080/default/services/{service_id}`

### Implementation Details

The Deno server implements the same ASGI routing pattern as the Python Hypha server:

1. **Service Detection**: Checks service `type` field (`asgi` vs `functions`)
2. **ASGI Protocol**: Implements `scope`, `receive`, and `send` callables
3. **HTTP Translation**: Converts HTTP requests to ASGI format and back
4. **Routing**: `/{workspace}/apps/{service_id}/{path}` routes to appropriate handler
5. **CORS**: Automatic CORS headers for browser compatibility

This makes the Deno server a lightweight alternative to Python for serving web applications through Hypha! 🚀

## Streaming Responses 🌊

The Deno ASGI server supports **full streaming responses** using ReadableStream, just like the Python version. This allows for real-time data delivery without buffering the entire response.

### Streaming Features

- ✅ **Real-time Streaming**: Data is sent as it's generated
- ✅ **Async Generators**: Use `async function*` for streaming data
- ✅ **ASGI Protocol**: Proper `more_body` flag handling
- ✅ **Memory Efficient**: No buffering of large responses
- ✅ **Server-Sent Events**: Built-in SSE support
- ✅ **Progress Updates**: Real-time progress indicators

### Streaming Example

```javascript
// Create streaming response with async generator
app.addRoute('/stream/data', 'GET', async (request) => {
    return {
        status: 200,
        headers: { 'content-type': 'text/plain' },
        body: createDataStream()  // Async generator
    };
});

// Async generator for streaming
async function* createDataStream() {
    for (let i = 1; i <= 100; i++) {
        yield `Data chunk ${i}\n`;
        await new Promise(resolve => setTimeout(resolve, 100));
    }
}
```

### Use Cases for Streaming

- **Large Dataset Processing**: Stream results without loading everything into memory
- **Real-time Updates**: Send progress updates during long-running tasks  
- **Server-Sent Events**: Implement live notifications and data feeds
- **File Downloads**: Stream large files without memory overhead
- **Live Logs**: Stream application logs in real-time
- **Chat Applications**: Real-time message delivery

### Streaming vs Buffered Responses

| Feature | Streaming | Buffered |
|---------|-----------|----------|
| **Memory Usage** | Constant (low) | Grows with response size |
| **Time to First Byte** | Immediate | After complete processing |
| **User Experience** | Real-time updates | Wait for completion |
| **Large Responses** | ✅ Efficient | ❌ Memory intensive |
| **Progress Updates** | ✅ Supported | ❌ Not possible |

The streaming implementation uses the ASGI `more_body` flag correctly, ensuring compatibility with the Python Hypha server behavior. 