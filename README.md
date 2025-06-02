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

## Configuration Options

### Constructor Options

```javascript
const hyphaCore = new HyphaCore({
    port: 8080,                    // Server port (default: 8080)
    base_url: "https://myapp.com/", // Base URL for serving template files (must end with /)
    url: "wss://myserver.com/ws",  // Direct WebSocket URL (alternative to port)
    default_service: {             // Default services to register
        myService: async () => { /* implementation */ }
    }
});
```

**Important Notes:**
- `base_url` must end with a forward slash (`/`)
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
        import { HyphaCore } from "https://cdn.jsdelivr.net/npm/hypha-core@0.20.54/dist/hypha-core.mjs";
        
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
    process: async (data) => {
        return data.map(x => x * 2);
    }
});

await workspace2.registerService({
    name: "chart-renderer",
    render: async (data) => {
        // Render chart logic
        console.log("Rendering chart with data:", data);
    }
});
```

### 3. Custom Service Registration

```javascript
const hyphaCore = new HyphaCore({
    default_service: {
        // Custom services available to all plugins
        fileManager: {
            async saveFile(filename, content, context) {
                localStorage.setItem(filename, content);
                console.log(`File saved by ${context.from}:`, filename);
                return { success: true, filename };
            },
            
            async loadFile(filename, context) {
                const content = localStorage.getItem(filename);
                console.log(`File loaded by ${context.from}:`, filename);
                return content || null;
            },
            
            async listFiles(context) {
                const files = Object.keys(localStorage);
                console.log(`Files listed by ${context.from}`);
                return files;
            }
        },
        
        notificationService: {
            async showNotification(message, type = 'info', context) {
                console.log(`[${type.toUpperCase()}] ${message} (from: ${context.from})`);
                return { success: true, timestamp: Date.now() };
            }
        }
    }
});

window.hyphaCore = hyphaCore;
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

window.hyphaCore = hyphaCore;
const api = await hyphaCore.start();

// Emit custom events
await hyphaCore.emit("custom_event", { message: "Hello World" });
```

### 5. Error Handling Best Practices

```javascript
const hyphaCore = new HyphaCore();
window.hyphaCore = hyphaCore;

try {
    const api = await hyphaCore.start();
    
    // Wait for API to be fully ready
    if (!api) {
        throw new Error("Failed to initialize Hypha Core API");
    }
    
    // Load plugin with error handling
    try {
        const plugin = await api.loadApp({ src: "https://example.com/plugin.js" });
        await plugin.run({ config: {}, data: {} });
    } catch (pluginError) {
        console.error("Plugin loading failed:", pluginError);
        // Continue execution, don't crash the app
    }
    
} catch (coreError) {
    console.error("Hypha Core initialization failed:", coreError);
}
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
const hyphaCore = new HyphaCore();
const api = await hyphaCore.start({
    workspace: "public-workspace"
});
```

### Authenticated Users
```javascript
// With JWT token
const hyphaCore = new HyphaCore();
const api = await hyphaCore.start({
    token: "your-jwt-token",
    workspace: "user-workspace"  // Optional - derived from token if not provided
});
```

### Workspace Tokens
```javascript
// Using workspace-specific tokens
const hyphaCore = new HyphaCore();
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

- **Modern Browsers**: Chrome 80+, Firefox 78+, Safari 14+, Edge 80+
- **Required Features**: ES6 Modules, WebSocket, Promises, Async/Await
- **Not Supported**: Internet Explorer

## Testing

The project includes comprehensive test coverage:

### Unit Tests
```bash
npm run test:unit
```

### Integration Tests  
```bash
npm run test:integration
```

### All Tests
```bash
npm test
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
- **[Advanced Workspace Management](./examples/workspaces.html)** - Multiple workspace example
- **[Custom Services](./examples/services.html)** - Custom service registration
- **[Authentication](./examples/auth.html)** - Token-based authentication

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT License - see [LICENSE](./LICENSE) for details.
