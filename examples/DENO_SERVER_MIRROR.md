# Deno Server Mirror

This document explains how to use the Hypha Server Mirror functionality, which creates a local Hypha server and automatically mirrors all its services to a remote Hypha server.

## Overview

The Deno Server Mirror (`deno-server-mirror.ts`) is a powerful tool that:

1. **Creates a local Hypha server** with real WebSocket support
2. **Connects to a remote Hypha server** using authentication tokens
3. **Automatically mirrors all local services** to the remote server
4. **Listens for service changes** and keeps the remote server synchronized
5. **Provides graceful cleanup** when shutting down

## Features

- ✅ **Command-line interface** with argument parsing
- ✅ **Real-time service mirroring** 
- ✅ **Event-driven synchronization** (service_added, service_removed, service_updated)
- ✅ **Automatic cleanup** on shutdown
- ✅ **Demo services** for testing functionality
- ✅ **Proxy service creation** with clear labeling
- ✅ **Graceful error handling**

## Quick Start

### 1. Install Dependencies

The script uses Deno's standard CLI library for argument parsing:

```bash
deno add jsr:@std/cli
```

### 2. Basic Usage

```bash
deno run --allow-net --allow-env examples/deno-server-mirror.ts \
  --workspace my-workspace \
  --token my-auth-token \
  --server-url https://ai.imjoy.io
```

### 3. With Custom Local Port

```bash
deno run --allow-net --allow-env examples/deno-server-mirror.ts \
  --workspace test-workspace \
  --token abc123 \
  --server-url https://ai.imjoy.io \
  --local-port 8080
```

## Command Line Arguments

### Required Arguments

| Argument | Short | Description | Example |
|----------|--------|-------------|---------|
| `--workspace` | `-w` | Workspace to connect to on remote server | `my-workspace` |
| `--token` | `-t` | Authentication token for remote server | `your-auth-token` |
| `--server-url` | `-s` | URL of remote Hypha server | `https://ai.imjoy.io` |

### Optional Arguments

| Argument | Short | Description | Default |
|----------|--------|-------------|---------|
| `--local-port` | `-p` | Port for local server | `9528` |
| `--help` | `-h` | Show help message | - |

## How It Works

### 1. Local Server Creation

The mirror creates a local Hypha server with:
- Default services (echo, get_server_info)
- A demo service with greeting and calculation functions
- WebSocket support for real-time communication

### 2. Remote Connection

Connects to the remote server using:
- WebSocket client from hypha-rpc
- Authentication token for secure access
- Specified workspace for service isolation

### 3. Service Mirroring

For each local service:
- Creates a proxy service with `[MIRROR]` prefix
- Forwards function calls to local implementations  
- Maintains metadata about original service
- Registers the proxy on the remote server

### 4. Event Synchronization

Listens for local events:
- **service_added**: Automatically mirrors new services
- **service_removed**: Removes corresponding remote services
- **service_updated**: Re-mirrors updated services

## Service Naming Convention

When services are mirrored to the remote server, they follow this naming pattern:

- **Local service**: `demo-service`
- **Remote service**: `mirror-demo-service`
- **Display name**: `[MIRROR] Demo Service for Mirroring`

This makes it easy to identify which services are mirrored from local servers.

## Testing the Mirror

### 1. Start the Mirror Server

```bash
deno run --allow-net --allow-env examples/deno-server-mirror.ts \
  --workspace test-ws \
  --token your-token \
  --server-url https://ai.imjoy.io
```

### 2. Test Local Services

```bash
# Test the demo service locally
curl "http://localhost:9528/default/services/demo-service/greet?name=LocalTest"

# Test calculation functions
curl "http://localhost:9528/default/services/demo-service/calculate.add?a=5&b=3"
```

### 3. Check Remote Services

Navigate to your remote Hypha server and look for services with the `[MIRROR]` prefix. They should appear in your specified workspace.

## Example Output

When running successfully, you'll see output like:

```
🌉 Starting Hypha Server Mirror...

🚀 Starting local Hypha server on port 9528...
✅ Local Hypha server started successfully!
📍 Local server URL: http://localhost:9528
🔌 Local WebSocket URL: ws://localhost:9528/ws

🔗 Connecting to remote Hypha server at https://ai.imjoy.io...
✅ Connected to remote Hypha server successfully!
📍 Remote server: https://ai.imjoy.io
📁 Workspace: my-workspace
🆔 Client ID: mirror-client-abc123

🔍 Listing all local services to mirror...
📋 Found 3 local services to mirror
⏭️ Skipping system service: default/root:default
✅ Mirrored service 'default/root:demo-service' to remote as 'mirror-default/root:demo-service'
🎉 Successfully mirrored 1 services to remote server

👂 Setting up service event listeners...
✅ Service event listeners set up successfully

🎉 Hypha Server Mirror is running!

📊 Status:
  🏠 Local server: http://localhost:9528
  🌐 Remote server: https://ai.imjoy.io
  📁 Remote workspace: my-workspace
  🔄 Mirrored services: 1

💡 Test the mirroring:
  🧪 Local: curl "http://localhost:9528/default/services/demo-service/greet?name=LocalTest"
  🌐 Remote: Check your remote server for the mirrored services

🔄 Server is running... Press Ctrl+C to stop
```

## Graceful Shutdown

The mirror handles shutdown gracefully:

1. **Cleanup mirrored services** from the remote server
2. **Close local server** connections
3. **Log cleanup status** for each service

Press `Ctrl+C` to trigger graceful shutdown.

## Troubleshooting

### Connection Issues

- Verify your token is valid and has proper permissions
- Check that the remote server URL is accessible
- Ensure the workspace exists and you have access

### Service Mirroring Issues

- Check that local services are properly registered
- Verify remote server has space for new services
- Look for any permission issues in the logs

### Port Conflicts

- Use `--local-port` to specify a different port if 9528 is in use
- Check that no other Hypha servers are running on the same port

## Advanced Usage

### Custom Services

You can modify the demo service or add your own services to the local server before starting the mirror. All registered services will be automatically mirrored.

### Multiple Mirrors

You can run multiple mirror instances with different:
- Local ports (`--local-port`)
- Remote workspaces (`--workspace`) 
- Remote servers (`--server-url`)

### Production Deployment

For production use:
- Use secure authentication tokens
- Monitor logs for any connection issues
- Consider using process managers for automatic restart
- Set up monitoring for both local and remote services

## See Also

- [deno-server-example.js](./deno-server-example.js) - Basic Deno Hypha server
- [DENO_WEBSOCKET_SERVER.md](./DENO_WEBSOCKET_SERVER.md) - WebSocket server documentation
- [Hypha Core Documentation](../README.md) - Main project documentation 