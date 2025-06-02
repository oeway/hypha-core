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
        import { HyphaCore } from "https://cdn.jsdelivr.net/npm/hypha-core@0.20.54/dist/hypha-core.mjs";
        
        // Create and start Hypha Core
        const hyphaCore = new HyphaCore();
        const api = await hyphaCore.start();
        
        console.log("Hypha Core started successfully!");
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
const api = await hyphaCore.start();
```

## Configuration Options

### Constructor Options

```javascript
const hyphaCore = new HyphaCore({
    port: 8080,                    // Server port (default: 8080)
    base_url: "https://myapp.com", // Base URL for serving template files
    url: "wss://myserver.com/ws",  // Direct WebSocket URL (alternative to port)
    default_service: {             // Default services to register
        myService: async () => { /* implementation */ }
    }
});
```

### Start Options

```javascript
const api = await hyphaCore.start({
    workspace: "my-workspace",     // Workspace identifier (default: "default")
    client_id: "my-client",        // Client identifier (default: auto-generated)
    server: hyphaCore             // Reference to the server instance
});
```

## Advanced Usage Examples

### 1. Complete Application with Window Management

```html
<!DOCTYPE html>
<html>
<head>
    <title>Hypha Lite Application</title>
    <script src="https://rawcdn.githack.com/nextapps-de/winbox/0.2.82/dist/winbox.bundle.min.js"></script>
</head>
<body>
    <div id="app-container"></div>
    
    <script type="module">
        import { HyphaCore } from "https://cdn.jsdelivr.net/npm/hypha-core@0.20.54/dist/hypha-core.mjs";
        
        const hyphaCore = new HyphaCore({
            base_url: window.location.origin + "/"
        });
        
        // Handle window creation for plugins
        hyphaCore.on("add_window", (config) => {
            const window = new WinBox(config.name || "Plugin Window", {
                background: "#448aff",
                width: 800,
                height: 600
            });
            
            window.body.innerHTML = `
                <iframe 
                    src="${config.src}" 
                    id="${config.window_id}" 
                    style="width: 100%; height: 100%; border: none;">
                </iframe>
            `;
        });
        
        const api = await hyphaCore.start();
        
        // Load and run a plugin
        async function loadPlugin(url) {
            try {
                const plugin = await api.loadApp({ src: url });
                await plugin.run({ config: {}, data: {} });
                console.log(`Plugin loaded successfully: ${url}`);
            } catch (error) {
                console.error(`Failed to load plugin: ${error.message}`);
            }
        }
        
        // Expose functions globally
        window.hyphaCore = hyphaCore;
        window.loadPlugin = loadPlugin;
    </script>
</body>
</html>
```

### 2. Multiple Workspace Management

```javascript
// Create multiple connections to different workspaces
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
    process: async (data) => {
        return data.map(x => x * 2);
    }
});

await workspace2.registerService({
    name: "chart-renderer",
    render: async (data) => {
        // Render chart logic
    }
});
```

### 3. Custom Service Registration

```javascript
const hyphaCore = new HyphaCore({
    default_service: {
        // Custom services available to all plugins
        fileManager: {
            async saveFile(filename, content) {
                localStorage.setItem(filename, content);
                return { success: true, filename };
            },
            
            async loadFile(filename) {
                const content = localStorage.getItem(filename);
                return content || null;
            },
            
            async listFiles() {
                return Object.keys(localStorage);
            }
        },
        
        notificationService: {
            async showNotification(message, type = 'info') {
                // Custom notification implementation
                console.log(`[${type.toUpperCase()}] ${message}`);
            }
        }
    }
});

const api = await hyphaCore.start();
```

### 4. Event Handling and Monitoring

```javascript
const hyphaCore = new HyphaCore();

// Listen to various events
hyphaCore.on("add_window", (config) => {
    console.log("New window requested:", config);
});

hyphaCore.on("connection_ready", (connection) => {
    console.log("Connection established:", connection);
});

// Custom event handling
hyphaCore.on("service_added", (service) => {
    console.log("New service registered:", service.name);
});

const api = await hyphaCore.start();

// Emit custom events
await hyphaCore.emit("custom_event", { message: "Hello World" });
```

## Required Template Files

For full functionality, serve these template files from your web server root:

### File Structure
```
your-web-root/
├── hypha-app-iframe.html      # Template for iframe-based apps
├── hypha-app-webpython.js     # Template for Python-based apps  
├── hypha-app-webworker.js     # Template for web worker apps
└── your-app.html              # Your main application
```

You can find these template files in the [`public`](./public) folder of this repository.

## Authentication

### Anonymous Users
```javascript
// No token required - creates anonymous workspace
const api = await hyphaCore.start({
    workspace: "public-workspace"
});
```

### Authenticated Users
```javascript
// With JWT token
const api = await hyphaCore.start({
    token: "your-jwt-token",
    workspace: "user-workspace"  // Optional - derived from token if not provided
});
```

### Workspace Tokens
```javascript
// Using workspace-specific tokens
const api = await hyphaCore.start({
    token: "workspace-token-123",
    workspace: "shared-workspace"
});
```

## API Reference

### HyphaCore Class

#### Constructor
- `new HyphaCore(config)` - Create new Hypha Core instance

#### Methods
- `start(config)` - Start the server and return API client
- `connect(config)` - Create additional connection to server
- `reset()` - Reset and restart the server
- `close()` - Stop the server and clean up resources
- `emit(event, data)` - Emit custom events

#### Events
- `"add_window"` - New window/plugin requested
- `"connection_ready"` - Client connection established
- `"service_added"` - New service registered

### API Client Methods

After calling `hyphaCore.start()`, you get an API client with these methods:

- `loadApp(config)` - Load and return a plugin/app instance
- `registerService(service)` - Register a new service
- `getService(name)` - Get reference to registered service
- `listServices()` - List all available services

## Browser Compatibility

- **Modern Browsers**: Chrome 80+, Firefox 78+, Safari 14+, Edge 80+
- **Required Features**: ES6 Modules, WebSocket, Promises, Async/Await
- **Not Supported**: Internet Explorer

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
- **[Advanced Workspace Management](./examples/workspaces.html)** - Multiple workspace example
- **[Custom Services](./examples/services.html)** - Custom service registration
- **[Authentication](./examples/auth.html)** - Token-based authentication

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](./LICENSE) for details.
