# Hypha Core

A lightweight, browser-based runtime for executing Hypha Apps and ImJoy Plugins with full workspace management and RPC communication.

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
        
        // Start and get the root API
        const rootAPI = await hyphaCore.start();
        
        console.log("Hypha Core started successfully!");
        console.log("Root API available:", rootAPI);
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

const rootAPI = await hyphaCore.start();
```

## Starting HyphaCore

```javascript
const hyphaCore = new HyphaCore();
window.hyphaCore = hyphaCore; // Available immediately

await hyphaCore.start(); // Must wait for completion

// API is now available in hyphaCore.api
const api = hyphaCore.api;

// Or alternatively:
const api = await hyphaCore.start();
```

## Connecting to HyphaCore

Use `rootAPI.connect()` to create additional connections:

```javascript
// Start HyphaCore and get root API
const hyphaCore = new HyphaCore();
const rootAPI = await hyphaCore.start();

// Connect to different workspaces
const workspace1 = await rootAPI.connect({
    workspace: "analysis-workspace",
    client_id: "analysis-client"
});

const workspace2 = await rootAPI.connect({
    workspace: "visualization-workspace", 
    client_id: "viz-client"
});

// Each workspace operates independently
await workspace1.registerService({
    name: "data-processor",
    process: async (data) => {
        return data.map(x => x * 2);
    }
});
```

## Standalone Web Applications

### 1. In an iframe

Create a standalone HTML file:

```html
<!DOCTYPE html>
<html>
<head>
    <title>My Standalone App</title>
    <script src="https://cdn.jsdelivr.net/npm/hypha-rpc@0.20.26/dist/hypha-rpc-websocket.min.js"></script>
</head>
<body>
    <h1>My Standalone Hypha App</h1>
    
    <script>
        // Connect to Hypha Core from iframe
        hyphaWebsocketClient.setupLocalClient({enable_execution: true}).then(async (api) => {
            console.log("Connected to Hypha Core", api);
            
            // Export services that the parent can call
            await api.export({
                name: "Iframe App Services",
                
                async processData(data) {
                    console.log("Processing data:", data);
                    return data.map(x => x * x); // Square the numbers
                },
                
                async updateUI(config) {
                    if (config.title) {
                        document.querySelector('h1').textContent = config.title;
                    }
                    return "UI updated successfully";
                }
            });
            
        }).catch(error => {
            console.error("Failed to connect to Hypha Core:", error);
        });
    </script>
</body>
</html>
```

Load the iframe:

```javascript
// Create a window with your standalone app
const appWindow = await rootAPI.createWindow({
    src: "/path/to/my-standalone-app.html",
    name: "My Standalone App"
});

// Interact with the app's exported services
const result = await appWindow.processData([1, 2, 3, 4, 5]);
console.log("App result:", result); // [1, 4, 9, 16, 25]
```

### 2. In a Web Worker

Hypha Core supports two approaches for web worker integration:

#### Traditional ImJoy Plugin Format
Load workers using the ImJoy plugin format with embedded configuration:

```javascript
// Load worker with ImJoy plugin format (.imjoy.html files)
const worker = await rootAPI.loadApp({
    src: "https://example.com/my-plugin.imjoy.html"
});
```

#### Custom Web Worker Scripts (New!)

**🚀 Direct Custom Worker Script Loading**

You can now load custom web worker scripts directly using any URL (HTTP, HTTPS, blob, or file URLs):

Create a custom web worker file (`computational-worker.js`):

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
    await api.export({
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
                    'fibonacci', 'factorial', 'processArray', 'heavyComputation'
                ],
                userAgent: navigator.userAgent,
                hardwareConcurrency: navigator.hardwareConcurrency
            };
        }
    });
    
    console.log('✅ Custom Worker: All services registered successfully');
    
}).catch(error => {
    console.error('❌ Custom Worker: Failed to setup Hypha client:', error);
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

console.log('🚀 Custom Worker: Initialization complete');
```

Load and use the custom worker:

```javascript
// Load custom worker script directly
const customWorker = await rootAPI.loadApp({
    type: 'web-worker',                    // Required for custom workers
    src: '/workers/computational-worker.js',  // Direct script URL
    name: 'Computational Worker',
    description: 'High-performance mathematical computations'
});

console.log('Worker loaded:', customWorker.id);

// Use computational services
const fibResult = await customWorker.fibonacci(20);
console.log('Fibonacci(20):', fibResult);  // 6765

const factResult = await customWorker.factorial(5);
console.log('Factorial(5):', factResult);  // 120

const arraySum = await customWorker.processArray([1, 2, 3, 4, 5], 'sum');
console.log('Array sum:', arraySum);  // 15

// Heavy computation in background
const heavyResult = await customWorker.heavyComputation(500000);
console.log('Heavy computation result:', heavyResult);
// { result: 1234.567, iterations: 500000, duration: 89, performance: "5617 ops/ms" }

// Get worker capabilities
const workerInfo = await customWorker.getWorkerInfo();
console.log('Worker info:', workerInfo);
```

#### Supported URL Types for Custom Workers

```javascript
// HTTP/HTTPS URLs
const httpWorker = await rootAPI.loadApp({
    type: 'web-worker',
    src: 'https://cdn.example.com/workers/math-worker.js'
});

// Blob URLs (for dynamically generated scripts)
const blob = new Blob([workerCode], { type: 'application/javascript' });
const blobUrl = URL.createObjectURL(blob);
const blobWorker = await rootAPI.loadApp({
    type: 'web-worker', 
    src: blobUrl
});

// Local file URLs
const fileWorker = await rootAPI.loadApp({
    type: 'web-worker',
    src: '/static/workers/data-processor.js'
});
```

#### Key Features of Custom Worker Scripts

**✅ Direct Script Loading**
- Support for HTTP/HTTPS URLs, blob URLs, and file URLs
- Bypasses ImJoy plugin parsing for faster loading
- Full control over worker implementation

**✅ Full Hypha RPC Integration**
- Complete access to Hypha RPC WebSocket client
- Service registration with `api.export()`
- Context-aware service calls with workspace isolation

**✅ Performance Optimized**
- Dedicated worker threads for CPU-intensive tasks
- Non-blocking main thread execution
- Efficient memory management

### 3. In Pyodide (Python)

Inside Pyodide, use the Python hypha-rpc client:

```python
# Install hypha-rpc if not already available
import micropip
await micropip.install("hypha-rpc")

# Connect to Hypha Core from Pyodide
from hypha_rpc import setup_local_client

# Setup local client connection
server = await setup_local_client(enable_execution=True)

# Export Python services
await server.export({
    "id": "default",
    "name": "Python Services",
    
    "process_data": lambda data: [x * 2 for x in data],
    
    "analyze_data": lambda data: {
        "mean": sum(data) / len(data),
        "max": max(data),
        "min": min(data),
        "count": len(data)
    },
    
    "numpy_computation": lambda: {
        # If numpy is available in Pyodide
        "result": "Python computation completed",
        "timestamp": str(datetime.now())
    }
})

print("Python services exported successfully!")
```

From JavaScript, you can then call the Python services:

```javascript
// Assuming Pyodide is loaded and the above Python code ran
const result = await pyodideAPI.process_data([1, 2, 3, 4, 5]);
console.log("Python result:", result); // [2, 4, 6, 8, 10]

const analysis = await pyodideAPI.analyze_data([1, 2, 3, 4, 5]);
console.log("Analysis:", analysis); // {mean: 3, max: 5, min: 1, count: 5}
```

## Key Points for Integration

### Connection Setup

All standalone apps and workers must include this connection code:

**JavaScript (iframe/worker):**
```javascript
hyphaWebsocketClient.setupLocalClient({enable_execution: true}).then(async (api) => {
    // Your app code here
    await api.export({
        // Your exported services
    });
}).catch(console.error);
```

**Python (Pyodide):**
```python
from hypha_rpc import setup_local_client
server = await setup_local_client(enable_execution=True)
await server.export({
    # Your exported services
})
```

### Important Notes

1. **Script Loading**: Always load the Hypha RPC WebSocket client for JavaScript:
   ```html
   <script src="https://cdn.jsdelivr.net/npm/hypha-rpc@0.20.26/dist/hypha-rpc-websocket.min.js"></script>
   ```

2. **Enable Execution**: Use `{enable_execution: true}` when setting up the local client to allow execution of scripts sent from the hypha core. Normally, this should be set to false.

3. **Error Handling**: Always include proper error handling for connection failures.

4. **Service Export**: Use `await api.export({...})` to make your app's functions available to the parent.

5. **Async/Await**: Most Hypha API calls are asynchronous, so use `async/await` or Promises.
