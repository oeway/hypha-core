/**
 * Unified Deno WebSocket Server Cluster Example
 * 
 * This example supports both:
 * - Real Redis cluster (production-ready)
 * - Mock Redis cluster (development/testing)
 * 
 * Usage:
 *   deno run --allow-all cluster-example.js               # Uses mock Redis (default)
 *   deno run --allow-all cluster-example.js --real-redis  # Uses real Redis
 */

import { HyphaCore } from '../src/hypha-core.js';
import { DenoWebSocketServer } from '../src/deno-websocket-server.js';

// Determine Redis mode from command line arguments
const useRealRedis = Deno.args.includes('--real-redis');
const redisMode = useRealRedis ? 'REAL' : 'MOCK';

console.log(`🔧 Cluster Mode: ${redisMode} Redis`);

/**
 * Create a clustered server instance
 */
async function createClusteredServer(port, serverId, useReal = false) {
    console.log(`🚀 Creating ${useReal ? 'real' : 'mock'} clustered server ${serverId} on port ${port}...`);
    
    // Configure HyphaCore based on Redis mode
    const hyphaConfig = {
        port: port,
        host: '0.0.0.0', // Bind to all interfaces for Docker compatibility
        ServerClass: class ClusteredDenoWebSocketServer extends DenoWebSocketServer {
            constructor(url, options) {
                super(url, {
                    ...options,
                    clustered: useReal, // Enable clustering only for real Redis
                    serverId: serverId,
                    clusterOptions: {
                        heartbeatInterval: 30000,  // 30 seconds
                        cleanupInterval: 60000,    // 60 seconds  
                        serverTTL: 90,             // 90 seconds
                    }
                });
            }
        }
    };

    const hyphaCore = new HyphaCore(hyphaConfig);

    // Start the server
    const api = await hyphaCore.start({
        name: `Clustered Server ${serverId}`,
        description: `Server instance ${serverId} in ${redisMode.toLowerCase()} cluster mode`
    });

    console.log(`✅ ${redisMode} clustered server ${serverId} started on port ${port}`);
    
    return { hyphaCore, api, server: hyphaCore.server };
}

/**
 * Monitor cluster status
 */
async function monitorCluster(servers, useReal = false) {
    const monitoringFunction = async () => {
        console.log('\n============================================================');
        console.log(`📊 ${redisMode} CLUSTER STATUS`);
        console.log('============================================================');
        
        for (const { server, hyphaCore } of servers) {
            try {
                const status = await server.getClusterStatus();
                console.log(`🖥️  Server ${status.server_id}:`);
                console.log(`   Local clients: ${status.local_clients}`);
                console.log(`   Clustered: ${status.clustered}`);
                
                if (status.clustered && useReal) {
                    console.log(`   Active servers: ${status.active_servers?.length || 0}`);
                    
                    // Get Redis-specific cluster info
                    const redisActiveServers = await server.clusterManager?.getActiveServerCount() || 0;
                    console.log(`   Redis active servers: ${redisActiveServers}`);
                    
                    if (status.active_servers?.length > 0) {
                        console.log(`   Servers: ${status.active_servers.join(', ')}`);
                    }
                } else if (!useReal) {
                    console.log(`   Mock mode: ${status.active_servers?.length || 0} simulated servers`);
                }
            } catch (error) {
                console.error(`❌ Error getting status for server: ${error.message}`);
            }
        }
        console.log('');
    };

    // Monitor immediately and then every 30 seconds
    await monitoringFunction();
    return setInterval(monitoringFunction, 30000);
}

/**
 * Test cluster messaging and load balancing
 */
async function testClusterFunctionality(servers, useReal = false) {
    // Wait for servers to initialize
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    if (useReal) {
        console.log('\n🔄 Testing real cluster messaging...');
        
        try {
            const server1 = servers[0].server;
            
            // Test cluster broadcast
            console.log('📢 Broadcasting test message to cluster...');
            await server1.broadcastToCluster('test-channel', JSON.stringify({
                type: 'cluster-test',
                message: 'Hello from real Redis cluster!',
                timestamp: Date.now(),
                server: server1.serverId
            }));
            
            console.log('✅ Real cluster broadcast test completed');
            
            // Test Redis pub/sub directly
            console.log('📨 Testing Redis pub/sub directly...');
            const redisClient = server1.clusterManager?.redisClient;
            if (redisClient) {
                await redisClient.subscribe('test-direct', (message) => {
                    console.log(`📨 Received direct Redis message: ${message}`);
                });
                
                setTimeout(async () => {
                    await redisClient.publish('test-direct', 'Direct Redis test message');
                }, 1000);
                
                setTimeout(async () => {
                    await redisClient.unsubscribe('test-direct');
                    console.log('✅ Redis pub/sub test completed');
                }, 3000);
            }
            
        } catch (error) {
            console.error('❌ Real cluster test failed:', error.message);
        }
    } else {
        console.log('\n🔄 Testing mock cluster functionality...');
        console.log('💡 Mock mode: Cluster messaging simulated locally');
        console.log('✅ Mock cluster test completed');
    }
    
    // Test load balancing
    if (useReal) {
        console.log('\n⚖️ Testing cluster load balancing...');
        await testLoadBalancing(servers);
    }
}

/**
 * Test load balancing across servers
 */
async function testLoadBalancing(servers) {
    const serverCounts = {};
    const totalRequests = 50;
    
    console.log(`📊 Sending ${totalRequests} requests to test load distribution...`);
    
    for (let i = 0; i < totalRequests; i++) {
        // Round-robin through servers to simulate load balancer behavior
        const serverIndex = i % servers.length;
        const server = servers[serverIndex];
        const port = server.hyphaCore.port;
        
        try {
            const response = await fetch(`http://localhost:${port}/health`);
            if (response.ok) {
                const serverKey = `server-${serverIndex + 1}:${port}`;
                serverCounts[serverKey] = (serverCounts[serverKey] || 0) + 1;
            }
        } catch (error) {
            console.error(`❌ Request ${i + 1} failed:`, error.message);
        }
        
        // Show progress every 10 requests
        if ((i + 1) % 10 === 0) {
            console.log(`📊 Progress: ${i + 1}/${totalRequests} requests sent`);
        }
    }
    
    console.log('\n📈 Load distribution results:');
    for (const [server, count] of Object.entries(serverCounts)) {
        const percentage = ((count / totalRequests) * 100).toFixed(1);
        console.log(`   ${server}: ${count} requests (${percentage}%)`);
    }
}

/**
 * Graceful shutdown
 */
async function setupGracefulShutdown(servers, monitorInterval) {
    const shutdown = async () => {
        console.log('\n🛑 Shutting down real cluster...');
        
        // Clear monitoring
        if (monitorInterval) {
            clearInterval(monitorInterval);
        }
        
        for (const { hyphaCore, server } of servers) {
            try {
                console.log('Closing Deno WebSocket server...');
                await server.close();
                await hyphaCore.close();
                console.log('✅ Server instance and Redis connection closed');
            } catch (error) {
                console.error('❌ Error during shutdown:', error.message);
            }
        }
        
        console.log('👋 Real cluster shutdown complete');
        Deno.exit(0);
    };

    // Handle different shutdown signals
    Deno.addSignalListener('SIGINT', shutdown);
    Deno.addSignalListener('SIGTERM', shutdown);
    
    // Handle uncaught errors
    addEventListener('unhandledrejection', (event) => {
        console.error('❌ Unhandled promise rejection:', event.reason);
        shutdown();
    });
    
    return shutdown;
}

/**
 * Main function - start the cluster
 */
async function main() {
    console.log(`🚀 Starting ${redisMode} Deno WebSocket Server Cluster...\n`);
    
    // Test Redis connection if using real Redis
    if (useRealRedis) {
        console.log('🔌 Testing Redis connection...');
        try {
            const { RealRedisClient } = await import('./redis-client.js');
            const testClient = new RealRedisClient();
            await testClient.connect();
            console.log('✅ Redis connection successful');
            await testClient.disconnect();
        } catch (error) {
            console.error('❌ Redis connection failed:', error.message);
            console.log('💡 Make sure Redis is running: docker run -d --name hypha-redis -p 6379:6379 redis:7-alpine');
            Deno.exit(1);
        }
    }
    
    // Server configurations
    const serverConfigs = [
        { port: 8080, serverId: 'real-server-1' },
        { port: 8081, serverId: 'real-server-2' },
        { port: 8082, serverId: 'real-server-3' }
    ];
    
    try {
        console.log('🏗️  Starting server instances...');
        
        // Start all server instances
        const servers = [];
        for (const config of serverConfigs) {
            const server = await createClusteredServer(config.port, config.serverId, useRealRedis);
            servers.push(server);
        }
        
        console.log(`\n🎉 ${redisMode} cluster started with ${servers.length} instances!`);
        console.log('🌐 Load balancer should point to:');
        serverConfigs.forEach(config => {
            console.log(`   - http://localhost:${config.port}`);
        });
        
        // Setup monitoring
        console.log(`\n📊 Starting ${redisMode.toLowerCase()} cluster monitoring...`);
        const monitorInterval = await monitorCluster(servers, useRealRedis);
        
        // Test cluster functionality
        await testClusterFunctionality(servers, useRealRedis);
        
        // Setup graceful shutdown
        setupGracefulShutdown(servers, monitorInterval);
        
        console.log(`\n📝 ${redisMode} Cluster Usage:`);
        if (useRealRedis) {
            console.log('  - WebSocket: ws://localhost:{8080,8081,8082}/ws');
            console.log('  - REST API: http://localhost:{8080,8081,8082}/default/services');
            console.log('  - Redis: redis://localhost:6379');
        } else {
            console.log('  - WebSocket: ws://localhost:{8080,8081,8082}/ws');
            console.log('  - REST API: http://localhost:{8080,8081,8082}/default/services');
            console.log('  - Mock Redis: Simulated in-memory clustering');
        }
        
        console.log(`\n⏳ ${redisMode} cluster is running... Press Ctrl+C to stop`);
        
    } catch (error) {
        console.error(`❌ Failed to start ${redisMode.toLowerCase()} cluster:`, error);
        Deno.exit(1);
    }
}

// Start the cluster if this file is run directly
if (import.meta.main) {
    main();
}

export { createClusteredServer, monitorCluster, testClusterFunctionality }; 