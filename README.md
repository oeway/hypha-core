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
            system: "Hypha Core v0.20.54"
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
