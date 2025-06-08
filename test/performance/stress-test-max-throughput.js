#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env

import { HyphaCore } from '../../src/hypha-core.js';
import { DenoWebSocketServer } from '../../src/deno-websocket-server.js';

class MaxThroughputResults {
    constructor() {
        this.requests = [];
        this.errors = [];
        this.startTime = null;
        this.endTime = null;
    }

    addRequest(duration, success, endpoint, statusCode = null, error = null) {
        this.requests.push({
            duration,
            success,
            statusCode,
            error: error ? error.message : null
        });
        
        if (!success) {
            this.errors.push({ endpoint, error: error?.message || 'Unknown error', statusCode });
        }
    }

    getStats() {
        const totalRequests = this.requests.length;
        const successfulRequests = this.requests.filter(r => r.success).length;
        const failedRequests = totalRequests - successfulRequests;
        
        const totalTime = this.endTime - this.startTime;
        const successRate = (successfulRequests / totalRequests) * 100;
        
        const durations = this.requests.filter(r => r.success).map(r => r.duration);
        const avgResponseTime = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
        const minResponseTime = durations.length > 0 ? Math.min(...durations) : 0;
        const maxResponseTime = durations.length > 0 ? Math.max(...durations) : 0;
        
        return {
            totalRequests,
            successfulRequests,
            failedRequests,
            successRate,
            totalTime,
            requestsPerSecond: totalRequests / (totalTime / 1000),
            successfulRequestsPerSecond: successfulRequests / (totalTime / 1000),
            avgResponseTime,
            minResponseTime,
            maxResponseTime,
            errors: this.errors
        };
    }
}

class MaxThroughputTester {
    constructor(port = 9650) {
        this.port = port;
        this.baseUrl = `http://localhost:${port}`;
        this.hyphaCore = null;
    }

    async setup() {
        console.log('🚀 Setting up MAX THROUGHPUT Deno server...\n');
        
        // Initialize HyphaCore with Deno WebSocket server
        this.hyphaCore = new HyphaCore({
            port: this.port,
            ServerClass: DenoWebSocketServer
        });

        // Start the server and get the API
        this.api = await this.hyphaCore.start();
        console.log(`✅ MAX THROUGHPUT Server started on ${this.baseUrl}\n`);

        // Register a high-performance service
        await this.api.registerService({
            id: 'max-throughput-service',
            name: 'Max Throughput Service',
            description: 'Ultra-fast service optimized for maximum throughput',
            
            // Ultra-fast simple operations
            ping: () => ({ pong: true, timestamp: Date.now() }),
            add: (a = 1, b = 1) => ({ result: Number(a) + Number(b) }),
            multiply: (a = 1, b = 1) => ({ result: Number(a) * Number(b) }),
            square: (n = 1) => ({ result: Number(n) ** 2 }),
            double: (n = 1) => ({ result: Number(n) * 2 }),
            
            // Fast math object
            math: {
                add: (a = 1, b = 1) => ({ result: Number(a) + Number(b) }),
                multiply: (a = 1, b = 1) => ({ result: Number(a) * Number(b) }),
                power: (base = 2, exp = 2) => ({ result: Math.pow(Number(base), Number(exp)) }),
                sqrt: (n = 4) => ({ result: Math.sqrt(Number(n)) }),
                abs: (n = -5) => ({ result: Math.abs(Number(n)) }),
                min: (a = 1, b = 2) => ({ result: Math.min(Number(a), Number(b)) }),
                max: (a = 1, b = 2) => ({ result: Math.max(Number(a), Number(b)) })
            },
            
            // Fast string operations
            string: {
                length: (s = 'test') => ({ result: String(s).length }),
                upper: (s = 'test') => ({ result: String(s).toUpperCase() }),
                lower: (s = 'TEST') => ({ result: String(s).toLowerCase() }),
                reverse: (s = 'test') => ({ result: String(s).split('').reverse().join('') })
            },
            
            // Fast array operations
            array: {
                length: (size = 10) => ({ result: Array(Number(size)).fill(0).length }),
                sum: (size = 5) => {
                    const arr = Array.from({length: Number(size)}, (_, i) => i + 1);
                    return { result: arr.reduce((a, b) => a + b, 0) };
                }
            },
            
            // Ultra-fast info
            info: () => ({ 
                service: 'max-throughput', 
                version: '1.0.0', 
                timestamp: Date.now(),
                ready: true 
            })
        });
        
        console.log('✅ Max throughput service registered\n');
    }

    async makeRequestBatch(endpoints, batchSize = 100) {
        const promises = [];
        
        for (let i = 0; i < batchSize; i++) {
            const endpoint = endpoints[i % endpoints.length];
            promises.push(this.makeFastRequest(endpoint));
        }
        
        return await Promise.all(promises);
    }

    async makeFastRequest(endpoint) {
        const startTime = performance.now();
        
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`);
            const endTime = performance.now();
            
            if (response.status === 200) {
                // Skip JSON parsing for max speed in some cases
                const data = await response.json();
                return {
                    success: true,
                    duration: endTime - startTime,
                    statusCode: 200
                };
            } else {
                return {
                    success: false,
                    duration: endTime - startTime,
                    statusCode: response.status,
                    error: new Error(`Status: ${response.status}`)
                };
            }
        } catch (error) {
            const endTime = performance.now();
            return {
                success: false,
                duration: endTime - startTime,
                error,
                statusCode: null
            };
        }
    }

    async runMaxThroughputTest(endpoints, totalRequests = 10000, maxConcurrency = 100) {
        console.log(`🔥 MAXIMUM THROUGHPUT TEST`);
        console.log(`📊 ${totalRequests} total requests`);
        console.log(`⚡ ${maxConcurrency} max concurrent requests`);
        console.log(`🎯 ${endpoints.length} different endpoints\n`);

        const results = new MaxThroughputResults();
        results.startTime = performance.now();

        let completed = 0;
        const batchSize = Math.min(maxConcurrency, 500);
        
        while (completed < totalRequests) {
            const remaining = totalRequests - completed;
            const currentBatch = Math.min(batchSize, remaining);
            
            const batchResults = await this.makeRequestBatch(endpoints, currentBatch);
            
            for (const result of batchResults) {
                results.addRequest(
                    result.duration,
                    result.success,
                    'batch',
                    result.statusCode,
                    result.error
                );
            }
            
            completed += currentBatch;
            
            // Progress update every 1000 requests
            if (completed % 1000 === 0 || completed === totalRequests) {
                const progress = (completed / totalRequests * 100).toFixed(1);
                process.stdout.write(`\r⚡ Progress: ${progress}% (${completed}/${totalRequests})`);
            }
        }

        results.endTime = performance.now();
        console.log('\n\n🎉 MAXIMUM THROUGHPUT TEST COMPLETED!\n');
        
        return results.getStats();
    }

    async cleanup() {
        if (this.hyphaCore) {
            this.hyphaCore.close();
            console.log('✅ Server closed');
        }
    }
}

async function runMaxThroughputTest() {
    const tester = new MaxThroughputTester();
    
    try {
        await tester.setup();
        
        // Ultra-fast endpoints optimized for maximum throughput
        const fastEndpoints = [
            '/default/services/max-throughput-service/ping',
            '/default/services/max-throughput-service/add?a=5&b=7',
            '/default/services/max-throughput-service/multiply?a=3&b=4',
            '/default/services/max-throughput-service/square?n=8',
            '/default/services/max-throughput-service/double?n=15',
            '/default/services/max-throughput-service/math.add?a=9&b=22',
            '/default/services/max-throughput-service/math.multiply?a=9&b=22',
            '/default/services/max-throughput-service/math.power?base=2&exp=3',
            '/default/services/max-throughput-service/math.sqrt?n=16',
            '/default/services/max-throughput-service/math.abs?n=-10',
            '/default/services/max-throughput-service/string.length?s=hello',
            '/default/services/max-throughput-service/string.upper?s=world',
            '/default/services/max-throughput-service/array.length?size=10',
            '/default/services/max-throughput-service/info'
        ];

        // Multiple test scenarios for maximum throughput
        console.log('🧪 SCENARIO 1: Moderate Throughput (5,000 requests, 50 concurrent)');
        const moderate = await tester.runMaxThroughputTest(fastEndpoints, 5000, 50);
        console.log(formatMaxResults(moderate));

        console.log('\n🧪 SCENARIO 2: High Throughput (10,000 requests, 100 concurrent)');
        const high = await tester.runMaxThroughputTest(fastEndpoints, 10000, 100);
        console.log(formatMaxResults(high));

        console.log('\n🧪 SCENARIO 3: EXTREME Throughput (25,000 requests, 200 concurrent)');
        const extreme = await tester.runMaxThroughputTest(fastEndpoints, 25000, 200);
        console.log(formatMaxResults(extreme));

        console.log('\n🧪 SCENARIO 4: MAXIMUM Throughput (50,000 requests, 500 concurrent)');
        const maximum = await tester.runMaxThroughputTest(fastEndpoints, 50000, 500);
        console.log(formatMaxResults(maximum));

    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await tester.cleanup();
    }
}

function formatMaxResults(stats) {
    return `
🏆 MAXIMUM THROUGHPUT RESULTS:
   Total Requests: ${stats.totalRequests.toLocaleString()}
   Successful: ${stats.successfulRequests.toLocaleString()}
   Failed: ${stats.failedRequests.toLocaleString()}
   Success Rate: ${stats.successRate.toFixed(2)}%
   
⚡ EXTREME Performance:
   Total Time: ${stats.totalTime.toFixed(0)}ms
   Requests/sec: ${stats.requestsPerSecond.toFixed(0).toLocaleString()}
   Successful Requests/sec: ${stats.successfulRequestsPerSecond.toFixed(0).toLocaleString()}
   
🚀 Response Times:
   Average: ${stats.avgResponseTime.toFixed(2)}ms
   Minimum: ${stats.minResponseTime.toFixed(2)}ms
   Maximum: ${stats.maxResponseTime.toFixed(2)}ms
   
${stats.errors.length > 0 ? `❌ Errors: ${stats.errors.length}` : '✅ No errors'}`;
}

// Run the maximum throughput test
await runMaxThroughputTest(); 