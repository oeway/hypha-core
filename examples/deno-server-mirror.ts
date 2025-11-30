#!/usr/bin/env -S deno run --allow-net --allow-env
/**
 * Deno Server Mirror Example
 * 
 * This creates a local Hypha server and mirrors all its services to a remote Hypha server.
 * It accepts command line arguments for workspace, token, and server URL configuration.
 * 
 * Usage:
 * deno run --allow-net --allow-env examples/deno-server-mirror.ts --workspace my-workspace --token my-token --server-url https://hypha.aicell.io
 * 
 * Required flags:
 * --server-url or -s: URL of the remote Hypha server
 * 
 * Optional flags:
 * --workspace or -w: The workspace to connect to on the remote server (auto-assigned if not provided)
 * --token or -t: Authentication token for the remote server (optional for public servers)
 * 
 * Optional flags:
 * --local-port or -p: Port for the local server (default: 9528)
 * --help or -h: Show help
 */

import { parseArgs } from "jsr:@std/cli/parse-args";
import { HyphaCore } from '../src/hypha-core.js';
import { DenoWebSocketServer, DenoWebSocketClient } from '../src/deno-websocket-server.js';
import { hyphaWebsocketClient } from '../src/hypha-core.js';

const { connectToServer } = hyphaWebsocketClient;

interface MirrorConfig {
    workspace?: string;
    token?: string;
    serverUrl: string;
    localPort: number;
    help?: boolean;
}

interface LocalService {
    id: string;
    name: string;
    description: string;
    config: any;
    [key: string]: any;
}

interface RemoteServiceRef {
    localServiceId: string;
    remoteServiceId: string;
}

function parseCommandLineArgs(): MirrorConfig {
    const args = parseArgs(Deno.args, {
        alias: {
            workspace: "w",
            token: "t", 
            "server-url": "s",
            "local-port": "p",
            help: "h"
        },
        string: ["workspace", "token", "server-url", "local-port"],
        boolean: ["help"],
        default: {
            "local-port": "9528"
        }
    });

    if (args.help) {
        console.log(`
🌉 Hypha Server Mirror - Mirror local services to remote server

Usage:
  deno run --allow-net --allow-env examples/deno-server-mirror.ts [OPTIONS]

Required Options:
  -s, --server-url <URL>          URL of remote Hypha server

Optional Options:
  -w, --workspace <WORKSPACE>     Workspace to connect to on remote server (auto-assigned if not provided)
  -t, --token <TOKEN>             Authentication token for remote server (optional for public servers)
  -p, --local-port <PORT>         Port for local server (default: 9528)
  -h, --help                      Show this help message

Examples:
  # Mirror to hypha.aicell.io
  deno run --allow-net --allow-env examples/deno-server-mirror.ts \\
    --workspace my-workspace \\
    --token my-token \\
    --server-url https://hypha.aicell.io

  # Mirror with custom local port
  deno run --allow-net --allow-env examples/deno-server-mirror.ts \\
    --workspace test-ws --token abc123 --server-url https://hypha.aicell.io --local-port 8080
        `);
        Deno.exit(0);
    }

    // Validate required arguments
    const config: MirrorConfig = {
        workspace: args.workspace as string || undefined,
        token: args.token as string || undefined,
        serverUrl: args["server-url"] as string,
        localPort: parseInt(args["local-port"] as string, 10) || 9528
    };

    if (!config.serverUrl) {
        console.error("❌ Error: --server-url is required");
        Deno.exit(1);
    }

    return config;
}

async function startLocalHyphaServer(port: number): Promise<{ hyphaCore: HyphaCore, api: any }> {
    console.log(`🚀 Starting local Hypha server on port ${port}...`);
    
    const config = {
        url: `http://localhost:${port}`,
        ServerClass: DenoWebSocketServer,
        WebSocketClass: DenoWebSocketClient,
        jwtSecret: "deno-mirror-secret-key",
        defaultService: {
            echo: (message: string, context: any) => {
                console.log(`📢 Local echo: ${message}`, context ? `from ${context.from}` : '');
                return `Local Echo: ${message}`;
            },
            get_server_info: (context: any) => ({
                platform: "Deno",
                version: Deno.version.deno,
                v8: Deno.version.v8,
                typescript: Deno.version.typescript,
                server: "hypha-core-deno-mirror",
                type: "local-mirror"
            })
        }
    };

    const hyphaCore = new HyphaCore(config);
    const api = await hyphaCore.start();

    // Register a demo service to show mirroring in action
    await (api as any).registerService({
        id: "demo-service",
        name: "Demo Service for Mirroring", 
        description: "A sample service to demonstrate mirroring functionality",
        config: {
            require_context: true,
            visibility: "public"
        },
        greet: (name: string, context: any) => {
            const greeting = `Hello ${name || 'World'} from local mirror server! 🌉`;
            console.log(`👋 Demo service called: ${greeting}`, context ? `from ${context.from}` : '');
            return greeting;
        },
        get_time: (context: any) => {
            const now = new Date().toISOString();
            console.log(`⏰ Time service called: ${now}`, context ? `from ${context.from}` : '');
            return now;
        },
        calculate: {
            add: (a: number, b: number, context: any) => {
                const result = a + b;
                console.log(`➕ Calc.add: ${a} + ${b} = ${result}`, context ? `from ${context.from}` : '');
                return result;
            },
            multiply: (a: number, b: number, context: any) => {
                const result = a * b;
                console.log(`✖️ Calc.multiply: ${a} × ${b} = ${result}`, context ? `from ${context.from}` : '');
                return result;
            }
        }
    });

    console.log(`✅ Local Hypha server started successfully!`);
    console.log(`📍 Local server URL: ${hyphaCore.url}`);
    console.log(`🔌 Local WebSocket URL: ${hyphaCore.wsUrl}`);

    return { hyphaCore, api };
}

async function connectToRemoteServer(config: MirrorConfig): Promise<any> {
    console.log(`🔗 Connecting to remote Hypha server at ${config.serverUrl}...`);
    
    try {
        const connectionConfig: any = {
            server_url: config.serverUrl,
            client_id: `mirror-client-${Math.random().toString(36).substr(2, 9)}`
        };

        // Only add workspace and token if provided
        if (config.workspace) {
            connectionConfig.workspace = config.workspace;
        }
        if (config.token) {
            connectionConfig.token = config.token;
        }

        const remoteServer = await connectToServer(connectionConfig);

        console.log('✅ Connected to remote Hypha server successfully!');
        console.log(`📍 Remote server: ${config.serverUrl}`);
        console.log(`📁 Workspace: ${remoteServer.config.workspace}`);
        console.log(`🆔 Client ID: ${remoteServer.config.client_id}`);

        return remoteServer;
    } catch (error) {
        console.error('❌ Failed to connect to remote server:', error);
        throw error;
    }
}

async function mirrorServiceToRemote(service: LocalService, remoteServer: any): Promise<string | null> {
    try {
        // Create a proxy service that forwards calls to the local service
        const proxyService = {
            id: `mirror-${service.id}`,
            name: `[MIRROR] ${service.name}`,
            description: `${service.description} (Mirrored from local server)`,
            config: {
                ...service.config,
                visibility: "public", // Make mirrored services public
                mirrored: true,
                original_id: service.id
            }
        };

        // Add proxy methods for all service functions
        for (const [key, value] of Object.entries(service as any)) {
            if (typeof value === 'function' && !['id', 'name', 'description', 'config'].includes(key)) {
                // Create proxy function that logs the call
                (proxyService as any)[key] = (...args: any[]) => {
                    console.log(`🔄 Proxying call to ${service.id}.${key} with args:`, args);
                    return `[MIRRORED] This would call ${service.id}.${key}(${args.join(', ')})`;
                };
            } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                // Handle nested objects like math.add, math.multiply
                const nestedProxy: any = {};
                for (const [subKey, subValue] of Object.entries(value as any)) {
                    if (typeof subValue === 'function') {
                        nestedProxy[subKey] = (...args: any[]) => {
                            console.log(`🔄 Proxying call to ${service.id}.${key}.${subKey} with args:`, args);
                            return `[MIRRORED] This would call ${service.id}.${key}.${subKey}(${args.join(', ')})`;
                        };
                    } else {
                        nestedProxy[subKey] = subValue;
                    }
                }
                (proxyService as any)[key] = nestedProxy;
            }
        }

        await remoteServer.register_service(proxyService);
        console.log(`✅ Mirrored service '${service.id}' to remote as '${proxyService.id}'`);
        return proxyService.id;
    } catch (error) {
        console.error(`❌ Failed to mirror service '${service.id}':`, error);
        return null;
    }
}

async function mirrorAllLocalServices(localApi: any, remoteServer: any): Promise<RemoteServiceRef[]> {
    console.log('🔍 Listing all local services to mirror...');
    
    try {
        const serviceList = await localApi.listServices();
        console.log(`📋 Found ${serviceList.length} local services to mirror`);

        const mirroredServices: RemoteServiceRef[] = [];
        
        for (const serviceInfo of serviceList) {
            // Skip built-in services and already mirrored services
            if (serviceInfo.id.includes(':built-in') || serviceInfo.id.includes(':default') || serviceInfo.config?.mirrored) {
                console.log(`⏭️ Skipping system service: ${serviceInfo.id}`);
                continue;
            }

            console.log(`📡 Getting full service details for: ${serviceInfo.id}`);
            
            // Get the actual service with all functions
            const fullService = await localApi.getService(serviceInfo.id);
            if (!fullService) {
                console.warn(`⚠️ Could not get full service for: ${serviceInfo.id}`);
                continue;
            }

            const remoteServiceId = await mirrorServiceToRemote(fullService, remoteServer);
            if (remoteServiceId) {
                mirroredServices.push({
                    localServiceId: serviceInfo.id,
                    remoteServiceId: remoteServiceId
                });
            }
        }

        console.log(`🎉 Successfully mirrored ${mirroredServices.length} services to remote server`);
        return mirroredServices;
    } catch (error) {
        console.error('❌ Error mirroring services:', error);
        return [];
    }
}

async function setupServiceEventListeners(localApi: any, remoteServer: any, mirroredServices: RemoteServiceRef[]) {
    console.log('👂 Setting up service event listeners...');

    // Listen for new services being added
    localApi.on('service_added', async (service: LocalService) => {
        console.log(`🆕 New service detected: ${service.id}`);
        
        // Skip system services
        if (service.id.includes(':built-in') || service.id.includes(':default') || service.config?.mirrored) {
            console.log(`⏭️ Skipping system service: ${service.id}`);
            return;
        }

        // Check if already mirrored
        const alreadyMirrored = mirroredServices.find(ref => ref.localServiceId === service.id);
        if (alreadyMirrored) {
            console.log(`⚠️ Service ${service.id} is already mirrored`);
            return;
        }

        // Get the full service details
        try {
            console.log(`📡 Getting full service details for new service: ${service.id}`);
            const fullService = await localApi.getService(service.id);
            if (!fullService) {
                console.warn(`⚠️ Could not get full service for new service: ${service.id}`);
                return;
            }

            // Mirror the new service
            const remoteServiceId = await mirrorServiceToRemote(fullService, remoteServer);
            if (remoteServiceId) {
                mirroredServices.push({
                    localServiceId: service.id,
                    remoteServiceId: remoteServiceId
                });
                console.log(`✅ Auto-mirrored new service: ${service.id} -> ${remoteServiceId}`);
            }
        } catch (error) {
            console.error(`❌ Error auto-mirroring service ${service.id}:`, error);
        }
    });

    // Listen for services being removed
    localApi.on('service_removed', async (serviceInfo: { id: string }) => {
        console.log(`🗑️ Service removed: ${serviceInfo.id}`);
        
        // Find the corresponding mirrored service
        const mirroredRef = mirroredServices.find(ref => ref.localServiceId === serviceInfo.id);
        if (mirroredRef) {
            try {
                await remoteServer.unregister_service(mirroredRef.remoteServiceId);
                
                // Remove from our tracking list
                const index = mirroredServices.indexOf(mirroredRef);
                if (index > -1) {
                    mirroredServices.splice(index, 1);
                }
                
                console.log(`✅ Removed mirrored service: ${mirroredRef.remoteServiceId}`);
            } catch (error) {
                console.error(`❌ Failed to remove mirrored service ${mirroredRef.remoteServiceId}:`, error);
            }
        }
    });

    // Listen for service updates
    localApi.on('service_updated', async (service: LocalService) => {
        console.log(`🔄 Service updated: ${service.id}`);
        
        // Find the corresponding mirrored service
        const mirroredRef = mirroredServices.find(ref => ref.localServiceId === service.id);
        if (mirroredRef) {
            console.log(`🔄 Re-mirroring updated service: ${service.id}`);
            // For simplicity, we'll remove and re-add the service
            try {
                await remoteServer.unregister_service(mirroredRef.remoteServiceId);
                
                // Get the full updated service details
                console.log(`📡 Getting full service details for updated service: ${service.id}`);
                const fullService = await localApi.getService(service.id);
                if (!fullService) {
                    console.warn(`⚠️ Could not get full service for updated service: ${service.id}`);
                    return;
                }

                const newRemoteServiceId = await mirrorServiceToRemote(fullService, remoteServer);
                if (newRemoteServiceId) {
                    mirroredRef.remoteServiceId = newRemoteServiceId;
                    console.log(`✅ Updated mirrored service: ${service.id} -> ${newRemoteServiceId}`);
                }
            } catch (error) {
                console.error(`❌ Failed to update mirrored service ${service.id}:`, error);
            }
        }
    });

    console.log('✅ Service event listeners set up successfully');
}

async function startMirrorServer() {
    console.log('🌉 Starting Hypha Server Mirror...\n');

    // Parse command line arguments
    const config = parseCommandLineArgs();

    try {
        // Start local Hypha server
        const { hyphaCore, api: localApi } = await startLocalHyphaServer(config.localPort);

        // Connect to remote server
        const remoteServer = await connectToRemoteServer(config);

        // Mirror all existing services
        const mirroredServices = await mirrorAllLocalServices(localApi, remoteServer);

        // Set up event listeners for dynamic mirroring
        await setupServiceEventListeners(localApi, remoteServer, mirroredServices);

        console.log('\n🎉 Hypha Server Mirror is running!');
        console.log('\n📊 Status:');
        console.log(`  🏠 Local server: ${hyphaCore.url}`);
        console.log(`  🌐 Remote server: ${config.serverUrl}`);
        console.log(`  📁 Remote workspace: ${remoteServer.config.workspace}`);
        console.log(`  🔄 Mirrored services: ${mirroredServices.length}`);
        
        console.log('\n💡 Test the mirroring:');
        console.log(`  🧪 Local: curl "${hyphaCore.url}/default/services/demo-service/greet?name=LocalTest"`);
        console.log(`  🌐 Remote: ${config.serverUrl}/${remoteServer.config.workspace}/services`);
        
        console.log('\n🔄 Server is running... Press Ctrl+C to stop');

        // Handle graceful shutdown
        const handleShutdown = async () => {
            console.log('\n🛑 Shutting down mirror server...');
            
            // Clean up mirrored services
            console.log('🧹 Cleaning up mirrored services...');
            for (const ref of mirroredServices) {
                try {
                    await remoteServer.unregister_service(ref.remoteServiceId);
                    console.log(`✅ Cleaned up: ${ref.remoteServiceId}`);
                } catch (error) {
                    console.error(`❌ Failed to cleanup ${ref.remoteServiceId}:`, error);
                }
            }
            
            hyphaCore.close();
            console.log('✅ Mirror server shut down gracefully');
            Deno.exit(0);
        };

        // Listen for termination signals
        Deno.addSignalListener("SIGINT", handleShutdown);
        Deno.addSignalListener("SIGTERM", handleShutdown);

        // Keep the process alive
        await new Promise(() => {}); // Run forever until interrupted

    } catch (error) {
        console.error('❌ Failed to start mirror server:', error);
        Deno.exit(1);
    }
}

// Start the mirror server
if (import.meta.main) {
    await startMirrorServer();
} 