# Hypha Core

A lightweight, browser-based runtime for executing Hypha Apps and ImJoy Plugins with full workspace management, RPC communication, and service orchestration capabilities.

## What is Hypha Core?

Hypha Core is a client-side JavaScript library that creates a complete Hypha server environment directly in the browser. It enables you to:

- **Run Hypha Apps and ImJoy Plugins** without requiring a dedicated server
- **Manage workspaces** with isolated execution environments
- **Handle RPC communication** between services and plugins
- **Orchestrate services** with automatic discovery and registration
- **Support multiple connection types** including WebSocket and Redis-like connections
- **Manage authentication** with token-based access control

## Architecture Overview

### Core Components

1. **HyphaCore Server**: Main orchestrator that manages connections, workspaces, and message routing
2. **Workspace Manager**: Handles service registration, discovery, and workspace isolation
3. **Connection Management**: Supports multiple connection types (WebSocket, PostMessage, Redis RPC)
4. **Service Registry**: Automatic registration and discovery of services across workspaces
5. **Authentication System**: Token-based authentication with support for both anonymous and authenticated users

### How It Works

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Browser Tab   │    │   Hypha Core    │    │   Workspace     │
│                 │    │    Server       │    │   Manager       │
│  ┌───────────┐  │    │                 │    │                 │
│  │ Plugin A  │  │◄──►│  ┌───────────┐  │◄──►│  ┌───────────┐  │
│  └───────────┘  │    │  │Connection │  │    │  │Service    │  │
│  ┌───────────┐  │    │  │ Manager   │  │    │  │Registry   │  │
│  │ Plugin B  │  │◄──►│  └───────────┘  │    │  └───────────┘  │
│  └───────────┘  │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## ✅ Quality Assurance & Testing

Hypha Core maintains exceptional quality through comprehensive testing:

### 🛡️ **Enhanced Security Features Tested**
- **JWT HS256 Authentication** with signature verification and expiration handling
- **Cross-Workspace Access Control** with token-based permission enforcement
- **Anonymous User Security** with automatic workspace assignment and access restrictions
- **Service Registration Security** - Only root users can register services in default/public workspaces
- **Workspace Isolation** with proper service visibility and permission management
- **Multi-Client Authentication Workflows** demonstrating provider/consumer/restricted user patterns

### 🚀 **Advanced Integration Features**
- **Custom Web Worker Script Loading** - Direct loading of worker scripts via HTTP, blob, and file URLs
- **Full Hypha RPC Integration** - Custom workers with complete service registration and communication
- **Performance Optimized Workers** - CPU-intensive computations in dedicated worker threads
- **Multiple URL Support** - HTTP/HTTPS, blob URLs, and local file loading for maximum flexibility

### 🌐 **Cross-Browser Compatibility Verified**
- **Chromium** ✅ - All 117 tests passing
- **Firefox** ✅ - All 117 tests passing  
- **WebKit** ✅ - All 117 tests passing

### ⚡ **Performance Verified**
- Unit tests complete in **~200ms** ⚡
- Full integration test suite in **~35 seconds** 🔄
- Real browser testing with actual WebSocket connections
- JWT token generation and verification tested in all browsers

### 🔒 **Security Tests Mirror Deno Example**
The integration tests now include comprehensive permission and security validation similar to the TypeScript Deno example:

- **JWT Token Generation** with proper access control
- **Workspace Access Control** for cross-workspace token generation
- **Service Registration Security** ensuring only authorized users can register in protected workspaces
- **Multi-Client Authentication Workflows** with proper token validation
- **Error Handling** for unauthorized access attempts
- **Service Listing** with workspace isolation verification

### 🛠 **Development Quality**
- ES6 module compatibility verified
- Modern JavaScript features tested
- Error handling and resilience validated
- UI responsiveness across screen sizes
- Network interruption recovery tested

## Installation & Basic Usage

### CDN Import (Recommended)

```html
<!DOCTYPE html>
<html>
<head>
    <title>My Hypha App</title>
</head>
<body>
    <script type="module">
        import { HyphaCore } from "https://cdn.jsdelivr.net/npm/hypha-core@0.20.55/dist/hypha-core.mjs";
        
        // Create and start Hypha Core
        const hyphaCore = new HyphaCore();
        
        // Expose globally for external access (important!)
        window.hyphaCore = hyphaCore;
        
        // Start and wait for API to be ready
        const api = await hyphaCore.start();
        
        console.log("Hypha Core started successfully!");
        console.log("API available:", api);
    </script>
</body>
</html>
```

### NPM Installation

```bash
npm install hypha-core
```

```javascript
import { HyphaCore } from 'hypha-core';

const hyphaCore = new HyphaCore();
window.hyphaCore = hyphaCore; // Expose globally if needed

const api = await hyphaCore.start();
```

## 🌐 Deno/Node.js Compatibility

HyphaCore now supports **server environments** (Deno and Node.js) with automatic environment detection and graceful feature degradation.

### **📚 TypeScript Support** 🎯

HyphaCore provides **comprehensive TypeScript definitions** with full type safety:

- ✅ **Complete Type Definitions**: `index.d.ts` with all HyphaCore APIs typed
- ✅ **Deno/Node.js/Browser Support**: Environment-aware type definitions
- ✅ **JWT Authentication Types**: `JWTPayload`, `TokenConfig`, `UserInfo`
- ✅ **Service Management Types**: `ServiceConfig`, `ServiceQuery`, `ServiceOptions`
- ✅ **API Types**: `HyphaAPI`, `HyphaCoreConfig`, workspace management
- ✅ **ES Module Compatible**: Works seamlessly with modern TypeScript projects

#### **TypeScript Usage Example**

```typescript
import { HyphaCore, type HyphaCoreConfig, type TokenConfig } from 'hypha-core';

const config: HyphaCoreConfig = {
    port: 9527,
    jwtSecret: 'your-secure-secret',
    baseUrl: 'http://localhost:9527/'
};

const hyphaCore = new HyphaCore(config);
const api = await hyphaCore.start();

// Type-safe token generation
const tokenConfig: TokenConfig = {
    user_id: 'typescript-user',
    workspace: 'typed-workspace',
    expires_in: 3600
};

const token: string = await api.generateToken(tokenConfig);
```

See [`examples/deno-example.ts`](./examples/deno-example.ts) for a complete TypeScript implementation demonstrating all features.

### **Deno WebSocket Server Implementation** 🦕

HyphaCore now supports **real WebSocket connections** in Deno through the `DenoWebSocketServer` wrapper, enabling production-grade server deployments with full compatibility with hypha-rpc clients.

#### **Key Features**
- ✅ **Real WebSocket Connections**: Native Deno HTTP server with WebSocket upgrade
- ✅ **Full hypha-rpc Compatibility**: Python and JavaScript clients can connect seamlessly  
- ✅ **Production Ready**: Proper error handling, graceful shutdown, and health endpoints
- ✅ **Built-in Services**: Default services like `echo`, `hello`, and `get_time` work out of the box
- ✅ **Service Registration**: Register services as `:built-in` for system-level access
- ✅ **Authentication Flow**: Complete JWT-based authentication with reconnection tokens

#### **Quick Start**

```bash
# Clone the repository
git clone https://github.com/amun-ai/hypha-core
cd hypha-core

# Run the Deno server example
deno run --allow-net --allow-env examples/deno-server-example.js
```

#### **Server Implementation**

```javascript
#!/usr/bin/env -S deno run --allow-net --allow-env
import { HyphaCore } from '../src/hypha-core.js';
import { DenoWebSocketServer, DenoWebSocketClient } from '../src/deno-websocket-server.js';

const hyphaCore = new HyphaCore({
    url: "http://localhost:9527",
    ServerClass: DenoWebSocketServer,      // Use real WebSocket server
    WebSocketClass: DenoWebSocketClient,   // Use real WebSocket client
    jwtSecret: "deno-hypha-secret-key",
    defaultService: {
        // Services with context for authentication and workspace info
        hello: (name, context) => {
            name = name || "World";
            const greeting = `Hello, ${name}! Greetings from Deno Hypha Server 🦕`;
            console.log(`Hello service called: ${greeting}`, context ? `from ${context.from}` : '');
            return greeting;
        },
        
        get_time: (context) => {
            const now = new Date().toISOString();
            console.log(`Time service called: ${now}`, context ? `from ${context.from}` : '');
            return now;
        }
    }
});

// Start the server with proper connection handling
const api = await hyphaCore.start();
console.log(`🚀 Hypha Core server started at ${hyphaCore.url}`);
console.log(`🔌 WebSocket URL: ${hyphaCore.wsUrl}`);
```

#### **Client Connection Examples**

**Python Client (hypha-rpc)**
```python
from hypha_rpc import connect_to_server

# Connect to the Deno server
server = await connect_to_server("ws://localhost:9527/ws")

# Use built-in services
result = await server.hello("Python Client")
print(result)  # "Hello, Python Client! Greetings from Deno Hypha Server 🦕"

time = await server.get_time()
print(f"Server time: {time}")

# Get server info
info = await server.get_server_info()
print(f"Running on: {info['platform']} {info['version']}")
```

**JavaScript Client**
```javascript
import { hyphaWebsocketClient } from 'hypha-rpc';

const server = await hyphaWebsocketClient.connectToServer({
    server_url: "ws://localhost:9527/ws"
});

const greeting = await server.hello("JavaScript Client");
console.log(greeting);

const serverInfo = await server.get_server_info();
console.log("Server info:", serverInfo);
```

#### **DenoWebSocketServer Features**

**Real WebSocket Upgrade**
- Uses Deno's native HTTP server with WebSocket upgrade
- Proper `Upgrade: websocket` header handling
- Binary and text message support with automatic ArrayBuffer conversion

**Health Monitoring**
```bash
# Check server health
curl http://localhost:9527/health
# Returns: OK
```

**Graceful Shutdown**
```javascript
// Handles SIGINT and SIGTERM for clean shutdown
Deno.addSignalListener("SIGINT", () => {
    console.log('🛑 Shutting down server...');
    hyphaCore.close();
    Deno.exit(0);
});
```

**Client Connection Management**
- Automatic client tracking and cleanup
- Proper error handling for connection failures
- Support for multiple concurrent connections

#### **Service Registration Security**

The Deno server properly handles service registration with workspace security:

```javascript
// Built-in services are registered with :built-in suffix
// This bypasses workspace security for system services
await hyphaCore.workspaceManager.setup({
    client_id: hyphaCore.workspaceManagerId,
    defaultService: {
        // These become accessible as server.hello(), server.get_time(), etc.
        hello: (name, context) => `Hello, ${name || "World"}!`,
        get_time: (context) => new Date().toISOString(),
        get_server_info: (context) => ({
            platform: "Deno",
            version: Deno.version.deno,
            server: "hypha-core-deno"
        })
    }
});
```

#### **Production Deployment**

**Docker Container**
```dockerfile
FROM denoland/deno:1.40.0

WORKDIR /app
COPY . .

EXPOSE 9527

CMD ["run", "--allow-net", "--allow-env", "examples/deno-server-example.js"]
```

#### **Performance & Compatibility**

**Tested Compatibility**
- ✅ **Python hypha-rpc clients** - Full compatibility
- ✅ **JavaScript hypha-rpc clients** - Complete feature support
- ✅ **Browser WebSocket clients** - Direct WebSocket connections
- ✅ **Node.js clients** - Cross-platform compatibility

**Performance Characteristics**
- **Concurrent Connections**: Supports multiple simultaneous clients
- **Message Throughput**: High-performance binary and text message handling
- **Memory Efficiency**: Automatic cleanup of disconnected clients
- **Error Recovery**: Robust error handling without server crashes

#### **Complete Example Files**

- [`examples/deno-server-example.js`](./examples/deno-server-example.js) - Complete server implementation
- [`examples/deno-client-example.js`](./examples/deno-client-example.js) - Client connection example
- [`examples/test-deno-server.py`](./examples/test-deno-server.py) - Python client test
- [`examples/DENO_WEBSOCKET_SERVER.md`](./examples/DENO_WEBSOCKET_SERVER.md) - Detailed documentation

This implementation provides a complete bridge between Deno's native capabilities and the hypha-core ecosystem, enabling deployment of production-grade WebSocket servers with full compatibility with existing hypha-rpc clients.

### **Deno/Node.js Compatibility** 🦕

HyphaCore provides **cross-platform compatibility** for server environments with environment-aware feature degradation:

#### **Supported Features in Server Environments**
- ✅ **JWT Authentication**: Full HS256 token generation and verification
- ✅ **Service Registration**: Register and discover services across workspaces  
- ✅ **RPC Communication**: Real-time service-to-service communication
- ✅ **Workspace Management**: Multi-tenant workspace isolation
- ✅ **Multi-Client Connections**: Support multiple concurrent clients
- ✅ **Anonymous User Security**: Automatic workspace assignment with access control
- ✅ **PostMessage** (Deno only): Web API compatibility for message passing
- ✅ **Event Listeners** (Deno only): Web API compatibility for event handling

#### **Browser-Only Features** 
Features that require DOM/Window APIs throw clear errors in server environments:
- ❌ **Window/iframe creation**: `Environment.requireBrowser()` throws error
- ❌ **WebWorker integration**: Browser-specific worker management  
- ❌ **DOM manipulation**: Document/element operations
- ❌ **PostMessage** (Node.js only): Not available without polyfills

### 🦕 **Deno Usage**

```typescript
import { HyphaCore } from "https://cdn.jsdelivr.net/npm/hypha-core@0.20.55/dist/hypha-core.mjs";

const hyphaCore = new HyphaCore({
    port: 9527,
    jwtSecret: 'your-secure-secret-key',
    baseUrl: 'http://localhost:9527/',  // Explicit base URL for server
});

// Start server
const api = await hyphaCore.start();
console.log('🚀 HyphaCore server running on Deno!');

// Generate JWT tokens
const token = await api.generateToken({
    user_id: 'deno-user',
    workspace: 'compute-workspace',
    expires_in: 3600
});

// Register computational services
await api.registerService({
    id: 'math-service',
    name: 'Math Service',
    config: { require_context: true, visibility: 'public' },
    
    fibonacci: (n, context) => {
        console.log(`Computing fibonacci(${n}) from ${context.from}`);
        if (n <= 1) return n;
        let a = 0, b = 1;
        for (let i = 2; i <= n; i++) [a, b] = [b, a + b];
        return b;
    }
});
```

### 🟢 **Node.js Usage**

```javascript
import { HyphaCore } from 'hypha-core';

const hyphaCore = new HyphaCore({
    port: 9527,
    jwtSecret: process.env.HYPHA_JWT_SECRET,
    baseUrl: 'http://localhost:9527/',
});

// Environment detection
console.log(`Running in: ${hyphaCore.environment}`); // 'node'

const api = await hyphaCore.start();
console.log('🚀 HyphaCore server running on Node.js!');

// Connect clients with JWT authentication
const clientApi = await hyphaCore.connect({
    token: await api.generateToken({ user_id: 'node-client' }),
    workspace: 'data-processing'
});
```

### 🛡️ **Environment-Safe Code Examples**

The library automatically detects the environment and provides helpful error messages:

```javascript
import { HyphaCore } from 'hypha-core';

const hyphaCore = new HyphaCore();
const api = await hyphaCore.start();

try {
    // This will work in all environments
    await api.registerService({
        id: 'data-processor',
        process: (data) => data.map(x => x * 2)
    });
    
    // This will throw clear error in server environments
    await api.createWindow({ src: 'https://example.com' });
} catch (error) {
    if (error.message.includes('requires browser environment')) {
        console.log('🔍 Browser-only feature attempted in server environment');
        console.log('💡 Use only core HyphaCore features in Deno/Node.js');
    }
}
```

### 📚 **Complete Server Example**

See [`examples/deno-example.js`](./examples/deno-example.js) for a full working example demonstrating:

- 🔐 JWT authentication with secure token generation
- ⚡ Service registration and cross-service communication  
- 🏗️ Workspace management and client connections
- 🧮 Computational services (prime number checking, fibonacci)
- 📊 Environment detection and feature availability

## Configuration Options

### Constructor Options

```javascript
const hyphaCore = new HyphaCore({
    port: 8080,                    // Server port (default: 8080)
    baseUrl: "https://myapp.com/", // Base URL for serving template files (must end with /)
    url: "wss://myserver.com/ws",  // Direct WebSocket URL (alternative to port)
    defaultService: {             // Default services to register
        myService: async () => { /* implementation */ }
    }
});
```

**Important Notes:**
- `baseUrl` must end with a forward slash (`/`)
- Cannot specify both `url` and `port` - choose one
- If using `url`, it must end with `/ws`

### Start Options

```javascript
const api = await hyphaCore.start({
    workspace: "my-workspace",     // Workspace identifier (default: "default")
    client_id: "my-client",        // Client identifier (default: auto-generated)
    server: hyphaCore             // Reference to the server instance
});
```

## 🚀 Cluster Setup & Horizontal Scaling

Hypha Core supports clustered deployments for horizontal scalability, high availability, and production workloads. The cluster mode enables multiple server instances to work together, sharing workspaces and services through Redis coordination.

### Quick Start

#### Option 1: Mock Redis Cluster (Development)
Perfect for development and testing without external dependencies:

```bash
# Clone the repository
git clone https://github.com/amun-ai/hypha-core
cd hypha-core/cluster-examples

# Start mock Redis cluster (3 servers: 8080, 8081, 8082)
deno run --allow-all cluster-example.js
```

Features:
- ✅ 3 server instances with simulated clustering behavior
- ✅ No external Redis required - uses built-in mock
- ✅ Local development friendly
- ✅ Perfect for testing load balancing logic

#### Option 2: Real Redis Cluster (Production)
Production-ready clustering with real Redis coordination:

```bash
# 1. Start Redis container
docker run -d --name hypha-redis -p 6379:6379 redis:7-alpine

# 2. Start real Redis cluster
deno run --allow-all cluster-example.js --real-redis
```

Features:
- ✅ Real Redis pub/sub messaging for true distributed coordination
- ✅ Horizontal scalability across multiple machines
- ✅ Production performance and reliability
- ✅ Fault tolerance and automatic failover

#### Option 3: Docker Deployment (Recommended for Production)
Full containerized deployment with load balancer:

```bash
# Clone and navigate to cluster examples
git clone https://github.com/amun-ai/hypha-core
cd hypha-core/cluster-examples

# Start full containerized cluster
docker compose up -d

# Check cluster status
docker compose ps

# View logs
docker compose logs -f

# Stop cluster
docker compose down
```

Components:
- ✅ Redis server for coordination
- ✅ 3 clustered Hypha-Core servers (auto-scaling ready)
- ✅ Nginx load balancer with health checks
- ✅ Health monitoring and automatic recovery

### Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Load Balancer   │    │   Server 1      │    │   Server 2      │
│ (Nginx:80)      │    │   (Port 8080)   │    │   (Port 8081)   │
│                 │    │                 │    │                 │
│  Health Checks  │◄──►│  Hypha Core     │◄──►│  Hypha Core     │
│  Round Robin    │    │  WebSocket      │    │  WebSocket      │
│  Failover       │    │  HTTP API       │    │  HTTP API       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       ▼
         │              ┌─────────────────┐    ┌─────────────────┐
         │              │   Server 3      │    │     Redis       │
         │              │   (Port 8082)   │    │   (Port 6379)   │
         │              │                 │    │                 │
         └─────────────►│  Hypha Core     │◄──►│  Pub/Sub        │
                        │  WebSocket      │    │  Coordination   │
                        │  HTTP API       │    │  Shared State   │
                        └─────────────────┘    └─────────────────┘
```

### Testing Your Cluster

#### Load Balancing Test
```bash
# Test cluster load distribution
cd hypha-core/cluster-examples
deno run --allow-all test-full-cluster.js
```

#### Performance Benchmarks
```bash
# Run comprehensive performance tests
deno run --allow-all performance-test.js
```

Sample results (3-server cluster):
- **Throughput**: 8,000-11,000 req/s per server
- **Latency**: <1ms average response time
- **Memory**: ~60MB per server instance
- **Coordination overhead**: <5ms for Redis operations

### Configuration

#### Server Ports (Default)
- **Server 1**: `8080` - Primary instance
- **Server 2**: `8081` - Secondary instance  
- **Server 3**: `8082` - Tertiary instance
- **Redis**: `6379` - Coordination layer
- **Load Balancer**: `80` - Entry point (Docker only)

#### Environment Variables
```bash
# Redis connection
REDIS_URL=redis://localhost:6379

# Server identification
SERVER_ID=server-1

# Cluster mode
CLUSTER_MODE=real  # or 'mock' for development
```

#### Custom Configuration
```javascript
// cluster-config.js
export const clusterConfig = {
    redis: {
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        channel: 'hypha-cluster',
        connectionTimeout: 5000
    },
    servers: [
        { id: 'server-1', port: 8080, weight: 1 },
        { id: 'server-2', port: 8081, weight: 1 },
        { id: 'server-3', port: 8082, weight: 1 }
    ],
    loadBalancer: {
        strategy: 'round-robin', // 'round-robin', 'least-connections', 'weighted'
        healthCheck: {
            interval: 10000,
            timeout: 3000,
            retries: 3
        }
    }
};
```

### API Endpoints

All cluster servers expose the same API endpoints:

#### Health Check
```bash
# Check individual server health
curl http://localhost:8080/health
curl http://localhost:8081/health  
curl http://localhost:8082/health

# Through load balancer (Docker)
curl http://localhost/health
```

#### Services API
```bash
# List services in workspace (returns array of service objects)
curl http://localhost:8080/default/services
# Returns: [{"id": "service1", "name": "My Service", ...}, ...]

# Get specific service info
curl http://localhost:8080/default/services/my-service
# Returns: {"id": "my-service", "name": "My Service", "config": {...}}

# Register service (distributed automatically)
curl -X POST http://localhost:8080/default/services \
  -H "Content-Type: application/json" \
  -d '{"name": "my-service", "config": {...}}'

# Call service function via HTTP
curl http://localhost:8080/default/services/my-service/my-function \
  -H "Content-Type: application/json" \
  -d '{"param1": "value1"}'
```

**Important**: The `/default/services` endpoint returns a **list of services** in the workspace, not the workspace API object itself.

#### WebSocket Connections
```javascript
// Connect to any server in the cluster
const ws1 = new WebSocket('ws://localhost:8080/ws');
const ws2 = new WebSocket('ws://localhost:8081/ws');
const ws3 = new WebSocket('ws://localhost:8082/ws');

// Or through load balancer
const ws = new WebSocket('ws://localhost/ws');
```

### Production Deployment

#### Docker Compose (Recommended)
```yaml
# docker-compose.yml
version: '3.8'
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data

  hypha-server-1:
    build: .
    environment:
      - SERVER_ID=server-1
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
    ports:
      - "8080:8080"

  hypha-server-2:
    build: .
    environment:
      - SERVER_ID=server-2
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
    ports:
      - "8081:8080"

  hypha-server-3:
    build: .
    environment:
      - SERVER_ID=server-3
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
    ports:
      - "8082:8080"

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - hypha-server-1
      - hypha-server-2
      - hypha-server-3

volumes:
  redis-data:
```

#### Kubernetes Deployment
```yaml
# k8s-cluster.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hypha-cluster
spec:
  replicas: 3
  selector:
    matchLabels:
      app: hypha-core
  template:
    metadata:
      labels:
        app: hypha-core
    spec:
      containers:
      - name: hypha-core
        image: hypha-core:latest
        ports:
        - containerPort: 8080
        env:
        - name: REDIS_URL
          value: "redis://redis-service:6379"
        - name: CLUSTER_MODE
          value: "real"
---
apiVersion: v1
kind: Service
metadata:
  name: hypha-service
spec:
  selector:
    app: hypha-core
  ports:
  - port: 80
    targetPort: 8080
  type: LoadBalancer
```

### Troubleshooting

#### Common Issues

1. **Port Conflicts**
   ```bash
   # Stop existing containers
   docker stop hypha-redis
   docker compose down
   
   # Check port usage
   lsof -i :8080
   ```

2. **Redis Connection Issues**
   ```bash
   # Test Redis connectivity
   redis-cli -h localhost -p 6379 ping
   
   # Check Redis logs
   docker logs hypha-redis
   ```

3. **Load Balancer Issues**
   ```bash
   # Check Nginx configuration
   docker exec nginx-container nginx -t
   
   # Reload configuration
   docker exec nginx-container nginx -s reload
   ```

#### Debug Mode
Enable comprehensive logging:

```bash
# Debug cluster coordination
RUST_LOG=debug deno run --allow-all cluster-example.js --real-redis

# Debug specific components
DEBUG=hypha:cluster,hypha:redis deno run --allow-all cluster-example.js
```

#### Monitoring
```bash
# Real-time cluster status
watch 'curl -s http://localhost:8080/health && curl -s http://localhost:8081/health'

# Redis monitoring
redis-cli monitor

# Docker cluster monitoring
docker stats
```

### Performance Optimization

#### Scaling Guidelines
- **Small workload**: 1-2 servers sufficient
- **Medium workload**: 3-5 servers recommended  
- **Large workload**: 5+ servers with dedicated Redis
- **High availability**: Minimum 3 servers across availability zones

#### Redis Optimization
```redis
# redis.conf optimizations for cluster
maxmemory 2gb
maxmemory-policy allkeys-lru
tcp-keepalive 60
timeout 0
```

#### Load Balancer Tuning
```nginx
# nginx.conf optimizations
upstream hypha_cluster {
    least_conn;
    server hypha-server-1:8080 weight=1 max_fails=3 fail_timeout=30s;
    server hypha-server-2:8080 weight=1 max_fails=3 fail_timeout=30s;
    server hypha-server-3:8080 weight=1 max_fails=3 fail_timeout=30s;
}

location / {
    proxy_pass http://hypha_cluster;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    
    # WebSocket support
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

For complete examples and configuration files, see the [`cluster-examples/`](./cluster-examples/) directory.

## Advanced Usage Examples

### 1. Complete Application with Window Management

```html
<!DOCTYPE html>
<html>
<head>
    <title>Hypha Lite Application</title>
<script src="https://rawcdn.githack.com/nextapps-de/winbox/0.2.82/dist/winbox.bundle.min.js"></script>
    <style>
        .icon-container {
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 1000;
        }
        .icon {
            width: 40px;
            height: 40px;
            cursor: pointer;
        }
        .dropdown {
            display: none;
            position: absolute;
            top: 50px;
            width: 120px;
            right: 0;
            background-color: white;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
            z-index: 1001;
            font-family: Arial, sans-serif;
        }
        .dropdown a {
            display: block;
            padding: 10px;
            text-decoration: none;
            color: black;
        }
        .dropdown a:hover {
            background-color: #f0f0f0;
        }
    </style>
</head>
<body>
    <div class="icon-container">
        <img
            alt="Hypha Logo"
            src="https://raw.githubusercontent.com/amun-ai/hypha/main/docs/img/hypha-icon-black.svg"
            class="icon"
            onclick="toggleDropdown()"
        />
        <div class="dropdown" id="dropdownMenu">
            <a href="#" onclick="promptLoadApp()">+ Load Plugin</a>
            <a href="#" onclick="loadApp('https://if.imjoy.io')">ImJoy Fiddle</a>
        </div>
    </div>
    
<script type="module">
        import { HyphaCore } from "https://cdn.jsdelivr.net/npm/hypha-core@0.20.55/dist/hypha-core.mjs";
        
    const hyphaCore = new HyphaCore();
        
        // Expose hyphaCore globally for tests and external access
        window.hyphaCore = hyphaCore;
        
        // Handle window creation for plugins
    hyphaCore.on("add_window", (config) => {
        const wb = new WinBox(config.name || config.src.slice(0, 128), {
            background: "#448aff",
        });
        wb.body.innerHTML = `<iframe src="${config.src}" id="${config.window_id}" style="width: 100%; height: 100%; border: none;"></iframe>`;
    });
        
        // Start Hypha Core and wait for API
        await hyphaCore.start();
        const api = hyphaCore.api;
        
        // Function to handle loading and running a plugin
        async function loadAppFromUrl(url) {
            try {
                const plugin = await api.loadApp({ src: url });
                await plugin.run({ config: {}, data: {} });
                console.log("Loaded and ran plugin from URL:", url);
            } catch (error) {
                console.error("Failed to load plugin:", error);
            }
        }
        
        // Expose functions globally
        window.loadApp = loadAppFromUrl;
        
        // Handle URL parameters for auto-loading plugins
        const urlParams = new URLSearchParams(window.location.search);
        const pluginUrls = urlParams.getAll("plugin");
        for (const url of pluginUrls) {
            await window.loadApp(url);
        }
        
        // UI Functions
        window.toggleDropdown = function () {
            const dropdown = document.getElementById("dropdownMenu");
            dropdown.style.display =
                dropdown.style.display === "block" ? "none" : "block";
        };

        window.promptLoadApp = async function () {
            const url = prompt("Enter the plugin URL:");
            if (url) {
                await loadAppFromUrl(url);
            }
        };
        
        // Close dropdown when clicking outside
        window.onclick = function (event) {
            if (!event.target.matches(".icon")) {
                const dropdown = document.getElementById("dropdownMenu");
                if (dropdown.style.display === "block") {
                    dropdown.style.display = "none";
                }
            }
        };
        
        // Initialize dropdown display style
        const dropdown = document.getElementById("dropdownMenu");
        if (dropdown) {
            dropdown.style.display = "none";
        }
</script>
</body>
</html>
```

### 2. Multiple Workspace Management

Hypha Core supports multiple isolated workspaces for security and organization. Each workspace operates independently with its own service registry and access controls.

```javascript
// Create and start the core server
const hyphaCore = new HyphaCore();
await hyphaCore.start();

// Connect to different workspaces
const workspace1 = await hyphaCore.connect({
    workspace: "analysis-workspace",
    client_id: "analysis-client"
});

const workspace2 = await hyphaCore.connect({
    workspace: "visualization-workspace", 
    client_id: "viz-client"
});

// Each workspace operates independently
await workspace1.registerService({
    name: "data-processor",
    config: {
        require_context: true,
        visibility: "public",
    },
    process: async (data, context) => {
        // context.ws === "analysis-workspace"
        console.log(`Processing data in workspace: ${context.ws}`);
        return data.map(x => x * 2);
    }
});

await workspace2.registerService({
    name: "chart-renderer",
    config: {
        require_context: true,
        visibility: "public",
    },
    render: async (data, context) => {
        // context.ws === "visualization-workspace"
        console.log(`Rendering chart in workspace: ${context.ws}`);
        return { chart: "rendered", workspace: context.ws };
    }
});
```

## Iframe and WebWorker Integration

Hypha Core supports loading and communicating with applications in iframes and web workers. This enables you to create distributed applications where different components run in isolated environments while still communicating through the Hypha RPC system.

### Two Approaches for Integration

#### 1. Hypha App Format (ImJoy Plugin Style)

You can create applications using the ImJoy plugin format with embedded configuration and code:

```html
<docs lang="markdown">
# My Hypha App
This is a sample Hypha application that runs in an iframe.
</docs>

<config lang="json">
{
  "name": "My Hypha App",
  "type": "iframe",
  "version": "0.1.0",
  "description": "A sample application running in an iframe",
  "tags": [],
  "ui": "",
  "cover": "",
  "inputs": null,
  "outputs": null,
  "flags": [],
  "icon": "extension",
  "api_version": "0.1.7",
  "env": "",
  "permissions": [],
  "requirements": [],
  "dependencies": []
}
</config>

<script lang="javascript">
// This code runs in the iframe
api.export({
    name: "My App Service",
    
    async setup() {
        await api.log("App initialized in iframe");
    },
    
    async processData(data) {
        // Process data and return results
        return data.map(x => x * 2);
    },
    
    async showMessage(message) {
        alert(`Message from parent: ${message}`);
        return "Message displayed";
    }
});
</script>
```

Load and use the app:

```javascript
// Load app from URL (e.g., GitHub raw URL)
const app = await api.loadApp({
    src: "https://raw.githubusercontent.com/myuser/myrepo/main/my-app.imjoy.html"
});

// Run and interact with the app
await app.run();
const result = await app.processData([1, 2, 3, 4]);
console.log(result); // [2, 4, 6, 8]
```

#### 2. Standalone Web Application

You can also create standalone web applications using any framework (React, Vue, vanilla JavaScript, etc.) and connect them to Hypha Core using the WebSocket client.

**Standalone App Example (`my-standalone-app.html`):**

```html
<!DOCTYPE html>
<html>
<head>
    <title>My Standalone App</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        button {
            background: #007bff;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            margin: 5px;
        }
        button:hover {
            background: #0056b3;
        }
        .status {
            padding: 10px;
            margin: 10px 0;
            border-radius: 4px;
            background: #d4edda;
            border: 1px solid #c3e6cb;
            color: #155724;
        }
    </style>
    <script src="https://cdn.jsdelivr.net/npm/hypha-rpc@0.20.26/dist/hypha-rpc-websocket.min.js"></script>
</head>
<body>
    <div class="container">
        <h1>My Standalone Hypha App</h1>
        <div class="status" id="status">Initializing...</div>
        
        <button onclick="performCalculation()">Perform Calculation</button>
        <button onclick="sendNotification()">Send Notification</button>
        <button onclick="getSystemInfo()">Get System Info</button>
        
        <div id="output"></div>
    </div>

    <script>
        let api = null;
        
        // Connect to Hypha Core
        hyphaWebsocketClient.setupLocalClient({enable_execution: true}).then(async (hyphaApi) => {
            api = hyphaApi;
            console.log("Connected to Hypha Core", api);
            
            // Export services that the parent can call
            await api.export({
                name: "Standalone App Services",
                
                async processData(data) {
                    console.log("Processing data:", data);
                    const result = data.map(x => x * x); // Square the numbers
                    updateOutput(`Processed data: ${JSON.stringify(result)}`);
                    return result;
                },
                
                async updateUI(config) {
                    console.log("Updating UI:", config);
                    if (config.title) {
                        document.querySelector('h1').textContent = config.title;
                    }
                    if (config.message) {
                        updateOutput(`UI Update: ${config.message}`);
                    }
                    return "UI updated successfully";
                },
                
                async getAppState() {
                    return {
                        title: document.querySelector('h1').textContent,
                        timestamp: new Date().toISOString(),
                        status: "running"
                    };
                }
            });
            
            document.getElementById('status').textContent = 'Connected to Hypha Core ✓';
            
        }).catch(error => {
            console.error("Failed to connect to Hypha Core:", error);
            document.getElementById('status').textContent = `Connection failed: ${error.message}`;
            document.getElementById('status').style.background = '#f8d7da';
            document.getElementById('status').style.borderColor = '#f5c6cb';
            document.getElementById('status').style.color = '#721c24';
        });
        
        // Functions called by the UI
        async function performCalculation() {
            if (!api) return;
            
            try {
                // Call a service from the parent Hypha Core
                const numbers = [1, 2, 3, 4, 5];
                const result = await api.echo(`Calculation request: ${numbers.join(', ')}`);
                updateOutput(`Echo result: ${result}`);
            } catch (error) {
                updateOutput(`Error: ${error.message}`);
            }
        }
        
        async function sendNotification() {
            if (!api) return;
            
            try {
                await api.log("Notification sent from standalone app");
                updateOutput("Notification sent to parent");
            } catch (error) {
                updateOutput(`Error: ${error.message}`);
            }
        }
        
        async function getSystemInfo() {
            if (!api) return;
            
            try {
                // Try to get server info if available
                const info = {
                    userAgent: navigator.userAgent,
                    timestamp: new Date().toISOString(),
                    url: window.location.href
                };
                updateOutput(`System Info: ${JSON.stringify(info, null, 2)}`);
            } catch (error) {
                updateOutput(`Error: ${error.message}`);
            }
        }
        
        function updateOutput(message) {
            const output = document.getElementById('output');
            output.innerHTML += `<div style="margin: 10px 0; padding: 8px; background: #e9ecef; border-radius: 4px;">${message}</div>`;
            output.scrollTop = output.scrollHeight;
        }
    </script>
</body>
</html>
```

**Using the Standalone App:**

```javascript
// Create a window with your standalone app
const appWindow = await api.createWindow({
    src: "/path/to/my-standalone-app.html",  // or full URL
    name: "My Standalone App",
    pos: "main"  // or "side"
});

// Wait a moment for the app to initialize
await new Promise(resolve => setTimeout(resolve, 1000));

// Interact with the app's exported services
const result = await appWindow.processData([1, 2, 3, 4, 5]);
console.log("App result:", result); // [1, 4, 9, 16, 25]

await appWindow.updateUI({
    title: "Updated App Title",
    message: "Hello from parent!"
});

const appState = await appWindow.getAppState();
console.log("App state:", appState);
```

### WebWorker Support

Hypha Core supports two approaches for web worker integration:

#### 1. Traditional ImJoy Plugin Format
Load workers using the ImJoy plugin format with embedded configuration:

```javascript
// Load worker with ImJoy plugin format (.imjoy.html files)
const worker = await api.loadApp({
    src: "https://example.com/my-plugin.imjoy.html"
});
```

#### 2. Custom Web Worker Scripts (New!)

**🚀 Direct Custom Worker Script Loading**

You can now load custom web worker scripts directly using any URL (HTTP, HTTPS, blob, or file URLs):

```javascript
// Load custom worker script directly
const customWorker = await api.loadApp({
    type: 'web-worker',                    // Specify worker type
    src: 'https://example.com/my-custom-worker.js',  // Direct script URL
    name: 'My Custom Worker',
    description: 'Custom computational worker'
});

// Works with different URL types:
// HTTP/HTTPS URLs
const httpWorker = await api.loadApp({
    type: 'web-worker',
    src: 'https://cdn.example.com/workers/math-worker.js'
});

// Blob URLs (for dynamically generated scripts)
const blob = new Blob([workerCode], { type: 'application/javascript' });
const blobUrl = URL.createObjectURL(blob);
const blobWorker = await api.loadApp({
    type: 'web-worker', 
    src: blobUrl
});

// Local file URLs
const fileWorker = await api.loadApp({
    type: 'web-worker',
    src: '/static/workers/data-processor.js'
});
```

#### Custom Worker Script Structure

**Complete Custom Worker Example (`computational-worker.js`):**

```javascript
// Import Hypha RPC client in the worker
importScripts('https://cdn.jsdelivr.net/npm/hypha-rpc@0.20.26/dist/hypha-rpc-websocket.min.js');

console.log('🔧 Custom Computational Worker: Starting...');

// Connect to Hypha Core from the worker
hyphaWebsocketClient.setupLocalClient({
    enable_execution: true,
    workspace: "worker-workspace",
    client_id: "computational-worker-001"
}).then(async (api) => {
    console.log('✅ Worker connected to Hypha Core');
    
    // Export comprehensive worker services
    const exportedServices = await api.export({
        id: 'computational-services',
        name: 'Computational Services',
        description: 'CPU-intensive computations optimized for WebWorker environment',
        
        // Mathematical computations
        fibonacci: function(n) {
            console.log(`🔢 Worker: Computing fibonacci(${n})`);
            if (n <= 1) return n;
            let a = 0, b = 1;
            for (let i = 2; i <= n; i++) {
                [a, b] = [b, a + b];
            }
            return b;
        },
        
        factorial: function(n) {
            console.log(`🔢 Worker: Computing factorial(${n})`);
            if (n <= 1) return 1;
            let result = 1;
            for (let i = 2; i <= n; i++) {
                result *= i;
            }
            return result;
        },
        
        // Prime number operations
        isPrime: function(n) {
            if (n <= 1) return false;
            if (n <= 3) return true;
            if (n % 2 === 0 || n % 3 === 0) return false;
            for (let i = 5; i * i <= n; i += 6) {
                if (n % i === 0 || n % (i + 2) === 0) return false;
            }
            return true;
        },
        
        // Array processing operations
        processArray: function(arr, operation) {
            const operations = {
                sum: () => arr.reduce((a, b) => a + b, 0),
                product: () => arr.reduce((a, b) => a * b, 1),
                average: () => arr.reduce((a, b) => a + b, 0) / arr.length,
                max: () => Math.max(...arr),
                min: () => Math.min(...arr),
                sort: () => [...arr].sort((a, b) => a - b),
                reverse: () => [...arr].reverse()
            };
            
            if (!operations[operation]) {
                throw new Error(`Unknown operation: ${operation}`);
            }
            
            return operations[operation]();
        },
        
        // Heavy computation simulation
        heavyComputation: function(iterations = 1000000) {
            console.log(`⚡ Worker: Running heavy computation with ${iterations} iterations`);
            const startTime = Date.now();
            let result = 0;
            
            for (let i = 0; i < iterations; i++) {
                result += Math.sin(i) * Math.cos(i) * Math.tan(i / 1000);
            }
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            return {
                result: result,
                iterations: iterations,
                duration: duration,
                performance: `${iterations / duration} ops/ms`
            };
        },
        
        // Worker info and capabilities
        getWorkerInfo: function() {
            return {
                type: 'webworker',
                environment: 'dedicated-worker',
                timestamp: new Date().toISOString(),
                capabilities: [
                    'fibonacci', 'factorial', 'isPrime', 
                    'processArray', 'heavyComputation'
                ],
                userAgent: navigator.userAgent,
                hardwareConcurrency: navigator.hardwareConcurrency
            };
        }
    });
    
    console.log('✅ Custom Worker: All services registered successfully');
    
    // Notify main thread that worker is ready
    self.postMessage({ 
        type: 'worker_ready', 
        message: 'Custom worker services registered successfully',
        services: Object.keys(exportedServices).filter(key => typeof exportedServices[key] === 'function')
    });
    
}).catch(error => {
    console.error('❌ Custom Worker: Failed to setup Hypha client:', error);
    self.postMessage({ 
        type: 'worker_error', 
        error: error.message 
    });
});

// Handle messages from main thread
self.onmessage = function(event) {
    const { type, data } = event.data;
    
    switch (type) {
        case 'ping':
            self.postMessage({ 
                type: 'pong', 
                message: 'Custom worker is operational',
                timestamp: new Date().toISOString()
            });
            break;
            
        case 'shutdown':
            console.log('🛑 Custom Worker: Shutdown requested');
            self.postMessage({ type: 'shutdown_acknowledged' });
            self.close();
            break;
            
        default:
            console.warn('⚠️ Custom Worker: Unknown message type:', type);
    }
};

// Error handling
self.onerror = function(error) {
    console.error('💥 Custom Worker: Unhandled error:', error);
    self.postMessage({ 
        type: 'worker_error', 
        error: error.message 
    });
};

console.log('🚀 Custom Worker: Initialization complete');
```

#### Loading and Using Custom Workers

```javascript
// Load the custom computational worker
const computeWorker = await api.loadApp({
    type: 'web-worker',
    src: '/workers/computational-worker.js',
    name: 'Computational Worker',
    description: 'High-performance mathematical computations'
});

console.log('Worker loaded:', computeWorker.id);

// Use computational services
const fibResult = await computeWorker.fibonacci(20);
console.log('Fibonacci(20):', fibResult);  // 6765

const factResult = await computeWorker.factorial(5);
console.log('Factorial(5):', factResult);  // 120

const primeCheck = await computeWorker.isPrime(97);
console.log('Is 97 prime?:', primeCheck);  // true

const arraySum = await computeWorker.processArray([1, 2, 3, 4, 5], 'sum');
console.log('Array sum:', arraySum);  // 15

// Heavy computation in background
const heavyResult = await computeWorker.heavyComputation(500000);
console.log('Heavy computation result:', heavyResult);
// { result: 1234.567, iterations: 500000, duration: 89, performance: "5617 ops/ms" }

// Get worker capabilities
const workerInfo = await computeWorker.getWorkerInfo();
console.log('Worker info:', workerInfo);
```

#### Key Features of Custom Worker Scripts

**✅ **Direct Script Loading****
- Support for HTTP/HTTPS URLs, blob URLs, and file URLs
- Bypasses ImJoy plugin parsing for faster loading
- Full control over worker implementation

**✅ **Full Hypha RPC Integration****
- Complete access to Hypha RPC WebSocket client
- Service registration with `api.export()`
- Context-aware service calls with workspace isolation

**✅ **Performance Optimized****
- Dedicated worker threads for CPU-intensive tasks
- Non-blocking main thread execution
- Efficient memory management

**✅ **Production Ready****
- Error handling and graceful degradation
- Worker lifecycle management
- Comprehensive logging and debugging

#### Custom vs Traditional Workers

| Feature | Custom Worker Scripts | Traditional ImJoy Plugins |
|---------|----------------------|---------------------------|
| **Loading** | Direct URL loading | Plugin code parsing required |
| **Performance** | Faster initialization | Additional parsing overhead |
| **Flexibility** | Full control over implementation | ImJoy plugin format constraints |
| **Integration** | Full Hypha RPC access | Full Hypha RPC access |
| **Use Cases** | Custom algorithms, existing workers | ImJoy ecosystem plugins |

#### Complete Working Example

See [`public/test-worker.js`](./public/test-worker.js) for a complete example featuring:

- ✅ Full Hypha RPC WebSocket integration
- ✅ Mathematical computation services (fibonacci, factorial, prime checking)
- ✅ Array processing operations with multiple algorithms
- ✅ Performance benchmarking capabilities
- ✅ Matrix operations and text processing
- ✅ Worker status monitoring and error handling
- ✅ Production-ready architecture patterns

This example demonstrates how to create sophisticated custom workers that integrate seamlessly with the Hypha Core ecosystem while providing high-performance computational capabilities.

### Key Points for Integration

#### Connection Setup
All standalone apps and workers must include this connection code:

```javascript
hyphaWebsocketClient.setupLocalClient({enable_execution: true}).then(async (api) => {
    // Your app code here
    await api.export({
        // Your exported services
    });
}).catch(console.error);
```

#### Important Notes

1. **Script Loading**: Always load the Hypha RPC WebSocket client:
   ```html
   <script src="https://cdn.jsdelivr.net/npm/hypha-rpc@0.20.26/dist/hypha-rpc-websocket.min.js"></script>
   ```

2. **Enable Execution**: Use `{enable_execution: true}` when setting up the local client to allow service exports.

3. **Error Handling**: Always include proper error handling for connection failures.

4. **Service Export**: Use `await api.export({...})` to make your app's functions available to the parent.

5. **Async/Await**: Most Hypha API calls are asynchronous, so use `async/await` or Promises.

6. **Viewport Meta Tag**: For mobile compatibility, include the viewport meta tag in your HTML.

This integration system allows you to create complex, distributed applications where different components can run in isolation while maintaining seamless communication through the Hypha RPC system.

## Mounting Existing Workers and Iframes

Hypha Core provides **simple, direct APIs** for mounting existing web workers and iframes without needing the ImJoy plugin format. This is perfect for integrating notebook environments (like Pyodide), custom workers, or existing web applications.

### `mountWorker(worker, config)` - Mount a Web Worker

Mount an existing Web Worker instance to Hypha Core with automatic RPC setup and bidirectional communication.

#### Basic Usage

```javascript
import { HyphaCore } from 'hypha-core';

// Start Hypha Core
const server = new HyphaCore({ port: 9527 });
await server.start();

// Create a web worker
const worker = new Worker('my-worker.js');

// Mount it to Hypha Core
await server.mountWorker(worker, {
    workspace: 'default',           // Optional: defaults to 'default'
    client_id: 'my-worker',         // Optional: auto-generated if not provided
    timeout: 60000                  // Optional: connection timeout (default: 60s)
});

// Worker is now connected and ready for RPC communication!
```

#### Pyodide/Python Worker Example

```javascript
// Mount a Pyodide worker with Python code to execute
const worker = new Worker('pyodide-worker.js');

await server.mountWorker(worker, {
    workspace: 'default',
    client_id: 'python-notebook',
    config: {
        name: 'My Notebook',
        scripts: [{
            lang: 'python',
            content: `
print("Hello from Python!")

# Access Hypha services from Python
services = await api.list_services({})
print(f"Found {len(services)} services")

# Get a JavaScript service and call it
demo = await api.get_service("demo-service")
result = await demo.greet("Python")
print(f"Response: {result}")
`
        }]
    }
});
```

#### Worker Script Structure

Your worker script should use `hypha-rpc` to connect:

```javascript
// my-worker.js
importScripts("https://cdn.jsdelivr.net/npm/hypha-rpc@0.20.84/dist/hypha-rpc-websocket.min.js");

// Start Pyodide or other environment
loadPyodide().then(async (pyodide) => {
    // Install hypha-rpc
    await pyodide.loadPackage("micropip");
    const micropip = pyodide.pyimport("micropip");
    await micropip.install('hypha-rpc==0.20.84');

    // Signal ready to receive initialization
    self.postMessage({ type: "hyphaClientReady" });

    // Set up the local client (will block until initializeHyphaClient arrives)
    await pyodide.runPythonAsync(`
from hypha_rpc import setup_local_client

async def execute(server, config):
    # Your Python code execution logic
    print('Executing:', config["name"])
    for script in config["scripts"]:
        exec(script["content"], {'api': server})

server = await setup_local_client(enable_execution=False, on_ready=execute)
    `);
});
```

### `mountIframe(iframe, config)` - Mount an Iframe

Mount an existing iframe element to Hypha Core for bidirectional RPC communication.

#### Basic Usage

```javascript
// Create an iframe element
const iframe = document.createElement('iframe');
iframe.src = 'my-app.html';
document.body.appendChild(iframe);

// Wait for iframe to load
await new Promise(resolve => iframe.onload = resolve);

// Mount it to Hypha Core
await server.mountIframe(iframe, {
    workspace: 'default',
    client_id: 'my-iframe-app'
});

// Iframe is now connected!
```

#### Example: Mounting an Existing Div with Iframe

```javascript
// Mount an iframe inside an existing div
const container = document.getElementById('app-container');

// Create iframe programmatically
const iframe = document.createElement('iframe');
iframe.src = '/apps/data-viewer.html';
iframe.style.width = '100%';
iframe.style.height = '600px';
container.appendChild(iframe);

// Mount to Hypha Core
const result = await server.mountIframe(iframe, {
    workspace: 'visualization',
    client_id: 'data-viewer'
});

console.log('Iframe mounted:', result.client_id);

// Get the iframe's service and interact with it
const viewerService = await server.api.getService('data-viewer:default');
await viewerService.loadData({ dataset: 'my-data.csv' });
```

### Configuration Options

Both `mountWorker` and `mountIframe` accept these configuration options:

```javascript
{
    workspace: 'workspace-name',    // Workspace to connect to (default: 'default')
    client_id: 'unique-client-id',  // Client identifier (default: auto-generated)
    user_info: {                    // User information (default: anonymous)
        id: 'user-123',
        email: 'user@example.com',
        roles: ['user'],
        scopes: []
    },
    config: {},                     // Configuration passed to the worker/iframe
    timeout: 60000                  // Connection timeout in ms (default: 60000)
}
```

### Return Value

Both methods return a result object:

```javascript
{
    workspace: 'workspace-name',
    client_id: 'client-id',
    connection: { /* connection object */ },
    service: { /* registered service object */ }
}
```

### Complete Working Example

See [`examples/pyodide-adhoc-client.html`](./examples/pyodide-adhoc-client.html) for a complete example demonstrating:

- ✅ Mounting a Pyodide worker to run Python code
- ✅ Registering JavaScript services callable from Python
- ✅ Bidirectional RPC communication
- ✅ Real-time output display
- ✅ Error handling

**Example Output:**
```
Python/Pyodide Worker Started
==================================================

Found 2 services:
  - default/root:default: Default workspace management service
  - default/root:demo-service: JavaScript Demo Service

Calling demo.greet('Python')...
Response: Hello Python from JavaScript!

Calling demo.add(42, 58)...
Result: 100

All RPC calls successful!
==================================================
```

### Key Features

**✅ Simple API**
- No ImJoy plugin format required
- Mount any existing worker or iframe
- Automatic RPC connection setup

**✅ Flexible Integration**
- Works with Pyodide, custom workers, React apps, etc.
- Pass configuration during mounting
- Full access to Hypha services

**✅ Bidirectional Communication**
- Workers/iframes can call Hypha services
- Hypha can call worker/iframe services
- Automatic message forwarding

**✅ Production Ready**
- Timeout handling
- Error detection
- Connection state management
- Proper cleanup

### Comparison: Mount vs LoadApp

| Feature | `mountWorker/mountIframe` | `loadApp` |
|---------|---------------------------|-----------|
| **Input** | Existing Worker/Iframe instance | URL to load |
| **Format** | Any format | ImJoy plugin format |
| **Use Case** | Integrate existing code | Load Hypha/ImJoy plugins |
| **Control** | Full control over creation | Managed by Hypha |
| **Flexibility** | Maximum flexibility | Plugin ecosystem |

Use `mountWorker`/`mountIframe` when you:
- Have an existing worker or iframe instance
- Want full control over initialization
- Don't want to use the ImJoy plugin format
- Need to integrate custom environments (Pyodide, etc.)

Use `loadApp` when you:
- Want to load plugins from URLs
- Use the ImJoy plugin ecosystem
- Prefer managed lifecycle and configuration

## Context Usage and Workspace Isolation

### Understanding Context

The `context` parameter is automatically injected into service methods when `require_context: true` is set in the service configuration. It provides essential information about the request origin and enables workspace-based security.

#### Context Properties

```javascript
// Complete context object structure
const context = {
    ws: "workspace-name",           // Current workspace ID
    from: "workspace/client-id",    // Source client identifier  
    to: "workspace/service-id",     // Target service identifier
    user: {                         // User information (if authenticated)
        id: "user-id",
        email: "user@example.com",
        is_anonymous: false,
        roles: ["admin", "user"],
        expires_at: 1234567890
    }
};
```

### Workspace Isolation Examples

#### 1. Data Access Control

```javascript
await api.registerService({
    name: "secure-data-service",
    config: {
        require_context: true,
        visibility: "protected",  // Only accessible within workspace
    },
    
    async getData(query, context) {
        // Validate workspace access
        if (context.ws !== "authorized-workspace") {
            throw new Error("Access denied: Invalid workspace");
        }
        
        // Log access for auditing
        console.log(`Data access by ${context.from} in workspace ${context.ws}`);
        
        // Return workspace-specific data
        return {
            data: getWorkspaceData(context.ws),
            workspace: context.ws,
            requestedBy: context.from
        };
    },
    
    async saveData(data, context) {
        // Ensure data is saved to correct workspace
        const workspaceKey = `data:${context.ws}:${Date.now()}`;
        
        // Workspace-isolated storage
        return await saveToWorkspaceStorage(workspaceKey, {
            ...data,
            workspace: context.ws,
            savedBy: context.from,
            timestamp: new Date().toISOString()
        });
    }
});
```

#### 2. Cross-Workspace Communication Control

```javascript
await api.registerService({
    name: "workspace-bridge",
    config: {
        require_context: true,
        visibility: "public",
    },
    
    async sendToWorkspace(targetWorkspace, message, context) {
        // Validate source workspace permissions
        const allowedSources = ["admin-workspace", "bridge-workspace"];
        if (!allowedSources.includes(context.ws)) {
            throw new Error(`Workspace ${context.ws} not authorized for cross-workspace communication`);
        }
        
        // Log cross-workspace communication
        console.log(`Bridge: ${context.ws} → ${targetWorkspace}`, message);
        
        // Send message to target workspace
        return await api.emit(`${targetWorkspace}:message`, {
            from: context.ws,
            fromClient: context.from,
            message: message,
            timestamp: Date.now()
        });
    },
    
    async listAuthorizedWorkspaces(context) {
        // Return workspaces this client can access
        const userWorkspaces = getUserWorkspaces(context.user?.id);
        const currentWorkspace = context.ws;
        
        return {
            current: currentWorkspace,
            accessible: userWorkspaces,
            requestedBy: context.from
        };
    }
});
```

#### 3. User-Based Workspace Access

```javascript
await api.registerService({
    name: "user-workspace-manager",
    config: {
        require_context: true,
        visibility: "public",
    },
    
    async createUserWorkspace(workspaceName, context) {
        // Only authenticated users can create workspaces
        if (context.user?.is_anonymous) {
            throw new Error("Anonymous users cannot create workspaces");
        }
        
        // Prefix with user ID for isolation
        const fullWorkspaceName = `user-${context.user.id}-${workspaceName}`;
        
        // Validate user permissions
        if (!context.user.roles?.includes("workspace-creator")) {
            throw new Error("Insufficient permissions to create workspace");
        }
        
        console.log(`Creating workspace ${fullWorkspaceName} for user ${context.user.email}`);
        
        return {
            workspace: fullWorkspaceName,
            owner: context.user.id,
            createdIn: context.ws,
            permissions: ["read", "write", "admin"]
        };
    },
    
    async switchWorkspace(targetWorkspace, context) {
        // Validate user can access target workspace
        const userWorkspaces = await getUserAccessibleWorkspaces(context.user?.id);
        
        if (!userWorkspaces.includes(targetWorkspace)) {
            throw new Error(`Access denied to workspace: ${targetWorkspace}`);
        }
        
        // Log workspace switch for auditing
        console.log(`User ${context.user?.email} switching: ${context.ws} → ${targetWorkspace}`);
        
        // Return connection config for new workspace
        return {
            workspace: targetWorkspace,
            client_id: `${context.user?.id}-${Date.now()}`,
            message: `Switched to workspace: ${targetWorkspace}`
        };
    }
});
```

#### 4. Service Visibility and Access Control

```javascript
// Public service - accessible from any workspace
await api.registerService({
    name: "public-utility",
    config: {
        require_context: true,
        visibility: "public",  // Accessible across workspaces
    },
    
    async getSystemInfo(context) {
        return {
            timestamp: Date.now(),
            requestedFrom: context.ws,
            client: context.from,
            // Public information only
            system: "Hypha Core v0.20.55"
        };
    }
});

// Protected service - only within same workspace
await api.registerService({
    name: "sensitive-operations",
    config: {
        require_context: true,
        visibility: "protected",  // Same workspace only
    },
    
    async processSecureData(data, context) {
        // This service is only accessible from the same workspace
        console.log(`Secure processing in workspace: ${context.ws}`);
        
        return {
            processed: encryptData(data, context.ws),
            workspace: context.ws,
            security_level: "protected"
        };
    }
});

// Private service - only for specific clients
await api.registerService({
    name: "admin-only-service",
    config: {
        require_context: true,
        visibility: "private",
    },
    
    async adminOperation(params, context) {
        // Check if user has admin role
        if (!context.user?.roles?.includes("admin")) {
            throw new Error("Admin access required");
        }
        
        // Check if request comes from admin workspace
        if (!context.ws.startsWith("admin-")) {
            throw new Error("Must be called from admin workspace");
        }
        
        console.log(`Admin operation by ${context.user.email} in ${context.ws}`);
        
        return {
            operation: "completed",
            admin: context.user.email,
            workspace: context.ws
        };
    }
});
```

### Security Best Practices with Context

#### 1. Always Validate Context
```javascript
async function secureServiceMethod(data, context) {
    // Validate required context properties
    if (!context || !context.ws || !context.from) {
        throw new Error("Invalid context: missing required properties");
    }
    
    // Validate workspace format
    if (!/^[a-zA-Z0-9-_]+$/.test(context.ws)) {
        throw new Error("Invalid workspace identifier");
    }
    
    // Continue with business logic...
}
```

#### 2. Implement Audit Logging
```javascript
function logServiceAccess(serviceName, method, context, result) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        service: serviceName,
        method: method,
        workspace: context.ws,
        client: context.from,
        user: context.user?.id || "anonymous",
        success: !result.error,
        error: result.error?.message
    };
    
    // Store audit log in workspace-specific location
    storeAuditLog(`${context.ws}/audit.log`, logEntry);
}

await api.registerService({
    name: "audited-service",
    config: { require_context: true },
    
    async sensitiveOperation(data, context) {
        try {
            const result = await performOperation(data, context);
            logServiceAccess("audited-service", "sensitiveOperation", context, result);
            return result;
        } catch (error) {
            logServiceAccess("audited-service", "sensitiveOperation", context, { error });
            throw error;
        }
    }
});
```

#### 3. Resource Isolation
```javascript
await api.registerService({
    name: "resource-manager",
    config: { require_context: true },
    
    async allocateResource(resourceType, context) {
        // Create workspace-specific resource identifier
        const resourceId = `${context.ws}-${resourceType}-${Date.now()}`;
        
        // Check workspace quotas
        const currentUsage = await getWorkspaceResourceUsage(context.ws);
        const quota = await getWorkspaceQuota(context.ws);
        
        if (currentUsage >= quota) {
            throw new Error(`Workspace ${context.ws} has exceeded resource quota`);
        }
        
        // Allocate resource with workspace isolation
        return await allocateWorkspaceResource(resourceId, {
            type: resourceType,
            workspace: context.ws,
            owner: context.from,
            allocated_at: new Date().toISOString()
        });
    }
});
```

This context-based approach ensures that:
- **Workspace Isolation**: Services can enforce boundaries between workspaces
- **Access Control**: Different visibility levels (public/protected/private) control service access
- **User Authentication**: Context provides user information for authorization decisions
- **Audit Trail**: All service calls include workspace and client information for logging
- **Resource Management**: Resources can be allocated and tracked per workspace
- **Security**: Malicious clients cannot access unauthorized workspaces or impersonate other clients

## Authentication

Hypha Core includes a **production-ready JWT-based authentication system** using HS256 (HMAC with SHA-256) for secure token signing and verification. The system has been thoroughly tested with comprehensive integration tests covering token generation, validation, expiration, and cross-workspace security.

### 🔐 **Robust JWT HS256 Authentication**

#### Secure Configuration

```javascript
const hyphaCore = new HyphaCore({
    jwtSecret: "your-super-secret-key-here",  // Required for production
    // ... other config
});
```

**🛡️ Security Features:**
- **HMAC-SHA256 Signing**: Cryptographically secure token signatures
- **Automatic Verification**: All tokens verified on connection
- **Expiration Handling**: Built-in token lifecycle management  
- **Tamper Protection**: Invalid signatures are automatically rejected
- **Cross-Workspace Security**: Tokens can be scoped to specific workspaces

**⚠️ Important Security Notes:**
- The `jwtSecret` is used to sign and verify JWT tokens using HMAC-SHA256
- If not provided, a random secret is generated (tokens won't work across server restarts)
- In production, always provide a strong, persistent secret
- Keep the secret confidential - never expose it in client-side code

#### Token Generation with Full Validation

```javascript
const hyphaCore = new HyphaCore({
    jwtSecret: "your-secret-key"
});

const api = await hyphaCore.start();

// Generate a secure token for a user
const token = await api.generateToken({
    user_id: "user123",
    workspace: "user-workspace", 
    email: "user@example.com",
    roles: ["user", "admin"],
    scopes: ["read", "write", "delete"],
    expires_in: 3600  // 1 hour (default: 24 hours)
});

console.log("Generated JWT:", token);
// Token structure: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload.signature
```

#### Token Configuration Options

```javascript
const token = await api.generateToken({
    user_id: "unique-user-id",          // Subject identifier
    workspace: "workspace-name",         // Target workspace
    client_id: "client-identifier",      // Client ID (optional)
    email: "user@example.com",          // User email
    roles: ["user", "admin"],           // User roles array
    scopes: ["read", "write"],          // Permission scopes
    expires_in: 7200,                   // Expiration in seconds
    // Custom claims can be added
    custom_claim: "custom_value"
});
```

#### Using Tokens for Authentication

```javascript
// Client connecting with JWT token
const apiClient = await hyphaCore.connect({
    token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    workspace: "target-workspace"  // Optional - can be derived from token
});
```

### **🔐 Authentication Features**

✅ **JWT HS256 Implementation**
- HMAC-SHA256 cryptographic signatures
- Automatic token verification and expiration
- Tamper-proof token validation

✅ **Cross-Workspace Security** 
- Workspace-scoped token access
- Role-based permission system
- Isolated execution environments

✅ **Production Ready**
- Environment variable secret management
- Token refresh patterns supported
- Clear error handling and debugging

✅ **Backward Compatible**
- Anonymous user support
- Legacy token compatibility
- Graceful fallback mechanisms

### **📚 Complete Authentication Documentation**

For comprehensive authentication examples including:
- Advanced security patterns
- Role-based access control
- Multi-workspace management  
- Error handling strategies
- Security best practices

See the [Complete Authentication Guide](#complete-authentication-guide) section below.

## API Reference

### HyphaCore Class

#### Constructor
- `new HyphaCore(config)` - Create new Hypha Core instance

**Config Options:**
- `port` - Server port (default: 8080)
- `baseUrl` - Base URL for serving template files (must end with /)
- `url` - Direct WebSocket URL (alternative to port)
- `defaultService` - Default services to register
- `jwtSecret` - Secret key for JWT signing/verification (HS256)

#### Methods
- `start(config)` - Start the server and return API client (async)
- `connect(config)` - Create additional connection to server (async)
- `reset()` - Reset and restart the server (async)
- `close()` - Stop the server and clean up resources
- `emit(event, data)` - Emit custom events (async)
- `on(event, handler)` - Register event handler
- `off(event, handler)` - Remove event handler

#### Properties
- `api` - API client instance (available after `start()` completes)
- `server` - Internal server instance
- `connections` - Active connections map
- `workspaceManagerId` - Workspace manager identifier
- `jwtSecret` - JWT signing secret (read-only)

#### Events
- `"add_window"` - New window/plugin requested
- `"connection_ready"` - Client connection established
- `"service_added"` - New service registered

### API Client Methods

After calling `hyphaCore.start()`, you get an API client with these methods:

- `loadApp(config)` - Load and return a plugin/app instance (async)
- `registerService(service)` - Register a new service (async)
- `getService(name)` - Get reference to registered service (async)
- `listServices()` - List all available services (async)
- `generateToken(config)` - Generate JWT token for authentication (async)

#### loadApp Method

```javascript
// Traditional ImJoy plugin loading
const plugin = await api.loadApp({
    src: "https://example.com/my-plugin.imjoy.html"
});

// Custom web worker script loading (NEW!)
const customWorker = await api.loadApp({
    type: 'web-worker',                    // Required for custom workers
    src: 'https://example.com/worker.js',  // Direct script URL
    name: 'Custom Worker',                 // Optional display name
    description: 'Custom worker description'  // Optional description
});

// Supported URL types for custom workers:
// - HTTP/HTTPS: 'https://cdn.example.com/worker.js'
// - Blob URLs: URL.createObjectURL(blob)
// - File URLs: '/static/workers/my-worker.js'
```

**loadApp Parameters:**
- `src` - Plugin URL or custom script URL (required)
- `type` - For custom workers, must be `'web-worker'` (optional for ImJoy plugins)
- `name` - Display name for the loaded app (optional)
- `description` - App description (optional)
- `config` - Additional configuration passed to the app (optional)

**Returns:** Promise<ServiceAPI> - Service API object with exported methods

#### generateToken Method

```javascript
const token = await api.generateToken({
    user_id: "user123",                 // Subject identifier (required)
    workspace: "target-workspace",      // Target workspace (optional)
    client_id: "client-id",            // Client identifier (optional)
    email: "user@example.com",         // User email (optional)
    roles: ["user", "admin"],          // User roles array (optional)
    scopes: ["read", "write"],         // Permission scopes (optional)
    expires_in: 3600,                  // Expiration in seconds (optional, default: 24h)
    custom_claim: "value"              // Custom claims (optional)
});
```

**Returns:** Promise<string> - Signed JWT token

### Important Timing Considerations

```javascript
const hyphaCore = new HyphaCore();
window.hyphaCore = hyphaCore; // Available immediately

await hyphaCore.start(); // Must wait for completion

// API is now available in hyphaCore.api
const api = hyphaCore.api;

// Or alternatively:
const api = await hyphaCore.start();
```

## Browser Compatibility

**✅ Fully Tested & Verified Across All Major Browsers:**

- **Chrome/Chromium 80+** ✅ - All 138 tests passing
- **Firefox 78+** ✅ - All 138 tests passing  
- **Safari/WebKit 14+** ✅ - All 138 tests passing
- **Edge 80+** ✅ - Chromium-based, fully compatible

**Required Features (All Verified):**
- ✅ ES6 Modules with dynamic imports
- ✅ WebSocket API for real-time communication
- ✅ Web Crypto API for JWT signature verification
- ✅ Promises and Async/Await
- ✅ Web Workers for background processing
- ✅ PostMessage API for cross-frame communication

**Not Supported:** 
- ❌ Internet Explorer (lacks ES6 module support)

**Testing Coverage:**
- Real browser integration tests with actual WebSocket connections
- Cross-browser module loading verification
- Modern JavaScript feature compatibility testing
- UI responsiveness across different screen sizes
- Network interruption and error recovery testing

## Testing

Hypha Core includes **comprehensive test coverage with 138/138 tests passing**:

### 🧪 **Test Categories**

**Unit Tests (42 tests - ~200ms)**
```bash
npm run test:unit
```
- Core functionality and utilities
- JWT token generation and validation
- Service registration logic
- Error handling and edge cases
- Mock-socket integration
- End-to-end workflow verification

**Integration Tests (96 tests - ~35 seconds)**
```bash
npm run test:integration
```
- **Core Integration Tests**: HyphaCore server, UI interactions, plugin loading
- **Security & Permission Tests**: JWT authentication, workspace isolation, service registration security
- **Multi-Client Workflows**: Provider/consumer patterns, cross-workspace access control
- **Error Handling**: Unauthorized access, token validation, workspace boundaries

**All Tests**
```bash
npm test
```
Runs complete test suite across all browsers (Chromium, Firefox, WebKit)

### 🌐 **Real Browser Testing**

Our integration tests run in **actual browsers** with:
- Real WebSocket connections
- Actual JWT token generation and verification
- Cross-workspace security enforcement
- Service registration and discovery workflows
- UI responsiveness and error handling
- Network interruption recovery

### 📊 **Test Results**

```
✅ Unit Tests:        42/42  PASSED  (~200ms)
✅ Integration Tests: 96/96  PASSED  (~35s)
📊 Total Coverage:    138/138 PASSED
🌐 Browsers:          Chrome, Firefox, Safari/WebKit
🔒 Security:          JWT HS256, Cross-workspace isolation, Anonymous user security
⚡ Performance:       Sub-second unit tests, fast integration suite
```

### 🛠 **Development Testing**

```bash
# Run tests in development mode
npm run dev

# Run specific test files
npx playwright test tests/integration/hypha-core-integration.test.js

# Run tests with UI (for debugging)
npx playwright test --ui
```

## Development

### Local Development
```bash
git clone https://github.com/amun-ai/hypha-core
cd hypha-core
npm install
npm run dev
```

### Building
```bash
npm run build
```

## Examples

See the [examples](./examples) directory for more comprehensive usage examples:

- **[Basic Usage](./public/lite.html)** - Simple plugin loader with UI
- **[Deno WebSocket Server](./examples/deno-server-example.js)** - Real WebSocket server with hypha-rpc compatibility
- **[TypeScript Deno Example](./examples/deno-example.ts)** - Complete TypeScript server with JWT authentication and security features
- **[Advanced Workspace Management](./examples/workspaces.html)** - Multiple workspace example
- **[Custom Services](./examples/services.html)** - Custom service registration
- **[Authentication](./examples/auth.html)** - Token-based authentication
- **[Anonymous User Testing](./examples/anonymous-test.ts)** - Demonstrates anonymous user security features

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](./LICENSE) for details.

## Complete Authentication Guide

### Authentication Methods

#### 1. JWT Token Authentication (Recommended)

```javascript
// Server-side: Generate token
const hyphaCore = new HyphaCore({
    jwtSecret: process.env.HYPHA_JWT_SECRET  // Store securely
});

const api = await hyphaCore.start();

const userToken = await api.generateToken({
    user_id: "alice123",
    workspace: "alice-workspace",
    email: "alice@company.com", 
    roles: ["user", "workspace-admin"],
    expires_in: 86400  // 24 hours
});

// Client-side: Use token
const clientApi = await hyphaCore.connect({
    token: userToken,
    client_id: "alice-client"
});
```

#### 2. Anonymous Users

```javascript
// No token required - creates anonymous workspace
const hyphaCore = new HyphaCore();
const api = await hyphaCore.start({
    workspace: "public-workspace"
});

// User info will be:
// {
//   id: "anonymous",
//   is_anonymous: true,
//   email: "anonymous@amun.ai",
//   roles: []
// }
```

### JWT Security Features

#### Automatic Token Verification

```javascript
// All incoming connections are automatically verified
const hyphaCore = new HyphaCore({
    jwtSecret: "secure-secret-key"
});

await hyphaCore.start();

// When client connects with token, Hypha Core:
// 1. Verifies signature using jwtSecret
// 2. Checks token expiration  
// 3. Extracts user info and workspace
// 4. Validates token structure
// 5. Rejects invalid/expired tokens
```

#### Token Expiration Handling

```javascript
// Tokens automatically include expiration
const shortLivedToken = await api.generateToken({
    user_id: "temp-user",
    expires_in: 300  // 5 minutes
});

// Expired tokens are rejected with clear error messages
try {
    await hyphaCore.connect({ token: expiredToken });
} catch (error) {
    console.error("Authentication failed:", error.message);
    // "JWT verification failed: Token expired"
}
```

### Advanced Authentication Patterns

#### Role-Based Access Control

```javascript
await api.registerService({
    name: "admin-service",
    config: {
        require_context: true,
        visibility: "protected"
    },
    
    async adminOperation(data, context) {
        // Check user roles from JWT
        if (!context.user?.roles?.includes("admin")) {
            throw new Error("Admin access required");
        }
        
        console.log(`Admin operation by ${context.user.email}`);
        return { success: true, admin: context.user.email };
    }
});
```

#### Multi-Workspace User Access

```javascript
// Generate tokens for different workspaces
const devToken = await api.generateToken({
    user_id: "developer123",
    workspace: "development",
    roles: ["developer", "tester"]
});

const prodToken = await api.generateToken({
    user_id: "developer123", 
    workspace: "production",
    roles: ["viewer"]  // Limited access in production
});
```

### Security Best Practices

#### 1. Secret Management
```javascript
// ❌ Never do this
const hyphaCore = new HyphaCore({
    jwtSecret: "hardcoded-secret"
});

// ✅ Use environment variables
const hyphaCore = new HyphaCore({
    jwtSecret: process.env.HYPHA_JWT_SECRET || (() => {
        throw new Error("JWT secret is required");
    })()
});
```

#### 2. Token Validation
```javascript
// Tokens are automatically validated, but you can add additional checks
await api.registerService({
    name: "secure-service",
    config: { require_context: true },
    
    async processData(data, context) {
        // Additional security checks
        if (context.user?.is_anonymous) {
            throw new Error("Authentication required");
        }
        
        if (!context.user?.email?.endsWith("@company.com")) {
            throw new Error("Invalid domain");
        }
        
        // Proceed with operation
        return processUserData(data, context.user);
    }
});
```

### Error Handling

```javascript
try {
    const api = await hyphaCore.connect({
        token: "invalid-or-expired-token"
    });
} catch (error) {
    if (error.message.includes("Token expired")) {
        // Handle token expiration
        console.log("Please log in again");
    } else if (error.message.includes("Invalid signature")) {
        // Handle tampered token
        console.log("Authentication failed");
    } else {
        // Handle other auth errors
        console.log("Connection failed:", error.message);
    }
}