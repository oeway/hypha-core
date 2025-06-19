# Deno WebSocket Server with Hypha Core

This document explains how to use Hypha Core with real WebSocket connections in Deno, similar to the Python implementation.

## Overview

The Deno WebSocket server implementation provides a wrapper around Deno's native HTTP server and WebSocket API to mimic the mock-socket API used by Hypha Core. This allows hypha-core to work seamlessly with real WebSocket connections in Deno.

## Components

### 1. DenoWebSocketServer
A wrapper class that mimics the mock-socket `Server` API using Deno's native HTTP server with WebSocket upgrade capability.

### 2. DenoWebSocketClient  
A wrapper class that mimics the mock-socket `WebSocket` API using Deno's native WebSocket.

### 3. DenoWebSocketWrapper
An internal wrapper that adapts native WebSocket events to the expected API.

## Quick Start

### 1. Start the Deno Hypha Server

```bash
deno run --allow-net --allow-env examples/deno-server-example.js
```

This will start a Hypha server on `http://localhost:9527` with real WebSocket support.

### 2. Connect from a Deno Client

```bash
deno run --allow-net examples/deno-client-example.js
```

This will connect to the server using hypha-rpc and demonstrate service calls.

### 3. Connect from Python Client

You can also connect from Python using hypha-rpc:

```python
import asyncio
from hypha_rpc import connect_to_server

async def main():
    server = await connect_to_server({
        "server_url": "http://localhost:9527",
        "workspace": "default"
    })
    
    # Get the hello-world service
    hello_service = await server.get_service("hello-world")
    response = await hello_service.hello("Python Client")
    print(response)

if __name__ == "__main__":
    asyncio.run(main())
```

## Usage Example

Here's a basic example of how to create a Deno Hypha server:

```javascript
import { HyphaCore } from '../src/hypha-core.js';
import { DenoWebSocketServer, DenoWebSocketClient } from '../src/deno-websocket-server.js';

// Configure Hypha Core to use Deno WebSocket classes
const hyphaCore = new HyphaCore({
    port: 9527,
    url: "http://localhost:9527",
    ServerClass: DenoWebSocketServer,     // Use Deno server wrapper
    WebSocketClass: DenoWebSocketClient,  // Use Deno client wrapper
    jwtSecret: "your-secret-key"
});

// Start the server
const api = await hyphaCore.start();

// Register a service
await api.registerService({
    id: "my-service",
    name: "My Service",
    config: { visibility: "public" },
    my_function: (arg) => `Hello ${arg}!`
});
```

## Features

### ✅ Supported Features
- Real WebSocket connections using Deno's native WebSocket API
- HTTP server with WebSocket upgrade handling
- Service registration and discovery
- Authentication and authorization
- Multiple client connections
- Graceful shutdown handling
- Health check endpoints
- Compatible with hypha-rpc clients (Python, JavaScript)

### 🔄 API Compatibility
The implementation maintains full compatibility with the existing hypha-core API:
- Same configuration options
- Same service registration methods
- Same client connection methods
- Same authentication flow

### 🛡️ Security Features
- JWT token-based authentication
- Workspace isolation
- User context support
- Permission checks
- Secure WebSocket connections

## Advanced Configuration

You can customize the server behavior with additional options:

```javascript
const hyphaCore = new HyphaCore({
    port: 8080,
    url: "http://localhost:8080",
    ServerClass: DenoWebSocketServer,
    WebSocketClass: DenoWebSocketClient,
    jwtSecret: "secure-secret-key",
    defaultService: {
        // Add default services available to all clients
        ping: () => "pong",
        get_timestamp: () => Date.now()
    }
});
```

## Deployment

### Local Development
```bash
deno run --allow-net --allow-env examples/deno-server-example.js
```

### Production Deployment
```bash
deno run --allow-net --allow-env --allow-read=. your-production-server.js
```

### Docker Deployment
```dockerfile
FROM denoland/deno:1.40.0

WORKDIR /app
COPY . .

EXPOSE 9527

CMD ["run", "--allow-net", "--allow-env", "examples/deno-server-example.js"]
```

## Testing

The Deno WebSocket server can be tested using the existing test suite:

```bash
# Run all tests
npm test

# The integration tests will work with the Deno WebSocket server
# when configured appropriately
```

## Troubleshooting

### Common Issues

1. **Permission Errors**
   - Make sure to use `--allow-net` flag for network access
   - Use `--allow-env` for environment variable access

2. **Port Already in Use**
   - Change the port in the configuration
   - Make sure no other services are using the same port

3. **WebSocket Connection Issues**
   - Check firewall settings
   - Verify the WebSocket URL format
   - Ensure the server is running before connecting clients

### Debug Mode

Enable debug logging by setting the environment variable:
```bash
DEBUG=hypha:* deno run --allow-net --allow-env examples/deno-server-example.js
```

## Performance

The Deno WebSocket server provides excellent performance characteristics:
- Low memory footprint
- Fast startup time
- Efficient WebSocket handling
- Concurrent connection support

## Compatibility

The implementation is compatible with:
- Deno 1.30+
- hypha-rpc clients (Python, JavaScript)
- Standard WebSocket clients
- All major browsers for web clients

## Future Enhancements

Planned improvements include:
- HTTP/2 support
- TLS/SSL support
- Load balancing capabilities
- Metrics and monitoring
- Clustering support 