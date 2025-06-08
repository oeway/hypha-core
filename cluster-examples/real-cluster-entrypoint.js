/**
 * Docker Entrypoint for Real Clustered Deno WebSocket Server
 */

import { createClusteredServer } from './cluster-examples/cluster-example.js';

// Get configuration from environment variables
const PORT = parseInt(Deno.env.get('SERVER_PORT') || '8080');
const SERVER_ID = Deno.env.get('SERVER_ID') || `real-deno-ws-${PORT}-${Math.random().toString(36).substr(2, 9)}`;
const REDIS_URL = Deno.env.get('REDIS_URL') || 'redis://localhost:6379';
const CLUSTERED = Deno.env.get('CLUSTERED') !== 'false';

console.log(`🚀 Starting Real Clustered Deno WebSocket Server`);
console.log(`   Server ID: ${SERVER_ID}`);
console.log(`   Port: ${PORT}`);
console.log(`   Redis: ${REDIS_URL}`);
console.log(`   Clustered: ${CLUSTERED}`);

async function startRealClusteredServer() {
    try {
        console.log(`🔄 Starting real clustered server ${SERVER_ID}...`);
        
        // Create the real clustered server
        const serverInfo = await createClusteredServer(PORT, SERVER_ID, true);
        
        // Register benchmark services for performance testing
        console.log('🔧 Registering benchmark services...');
        await serverInfo.api.registerService({
            id: 'benchmark-service',
            name: 'Benchmark Service',
            description: 'Comprehensive service for performance benchmarking',
            
            // Math operations
            math: {
                multiply: (a = 1, b = 1) => ({ result: Number(a) * Number(b) }),
                add: (a = 1, b = 1) => ({ result: Number(a) + Number(b) }),
                divide: (a = 1, b = 1) => ({ result: Number(a) / Number(b) }),
                power: (base = 2, exp = 2) => ({ result: Math.pow(Number(base), Number(exp)) })
            },
            
            // String operations
            string: {
                upper: (s = 'test') => ({ result: String(s).toUpperCase() }),
                lower: (s = 'TEST') => ({ result: String(s).toLowerCase() }),
                reverse: (s = 'hello') => ({ result: String(s).split('').reverse().join('') }),
                length: (s = 'test') => ({ result: String(s).length })
            },
            
            // Array operations
            array: {
                sum: (arr = [1, 2, 3]) => ({ result: arr.reduce((a, b) => a + b, 0) }),
                length: (arr = [1, 2, 3]) => ({ result: arr.length }),
                reverse: (arr = [1, 2, 3]) => ({ result: [...arr].reverse() })
            },
            
            // Echo and utility
            echo: (message = 'hello') => ({ message, timestamp: Date.now() }),
            status: () => ({ status: 'ok', server: `cluster-${SERVER_ID}`, timestamp: Date.now() })
        });
        
        console.log('✅ Benchmark services registered');
        
        console.log(`✅ Real clustered server ${SERVER_ID} started successfully on port ${PORT}`);
        
        // Log cluster status periodically
        if (CLUSTERED) {
            setInterval(async () => {
                try {
                    const status = await serverInfo.server.getClusterStatus();
                    console.log(`📊 Server: ${status.server_id}, Local clients: ${status.local_clients}, Clustered: ${status.clustered}`);
                    
                    if (status.clustered && status.active_servers) {
                        console.log(`   Active servers in cluster: ${status.active_servers.join(', ')}`);
                    }
                } catch (error) {
                    console.error('Error getting cluster status:', error.message);
                }
            }, 60000); // Every minute
        }

        // Graceful shutdown
        const shutdown = async () => {
            console.log('🛑 Shutting down real clustered server...');
            try {
                await serverInfo.server.close();
                await serverInfo.hyphaCore.close();
                await serverInfo.redis.disconnect();
                console.log('✅ Server shutdown complete');
                Deno.exit(0);
            } catch (error) {
                console.error('❌ Error during shutdown:', error);
                Deno.exit(1);
            }
        };

        // Handle shutdown signals
        Deno.addSignalListener('SIGINT', shutdown);
        Deno.addSignalListener('SIGTERM', shutdown);

        console.log('🎉 Real clustered server is running! Press Ctrl+C to stop');

    } catch (error) {
        console.error('❌ Failed to start real clustered server:', error);
        console.error(error.stack);
        Deno.exit(1);
    }
}

// Start the server
await startRealClusteredServer(); 