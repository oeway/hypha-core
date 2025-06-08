#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env

import { HyphaCore } from '../../src/hypha-core.js';
import { DenoWebSocketServer } from '../../src/deno-websocket-server.js';

class StressTestResults {
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
            endpoint,
            statusCode,
            error,
            timestamp: Date.now()
        });
        
        if (!success) {
            this.errors.push({ endpoint, error: error?.message || 'Unknown error', statusCode });
        }
    }

    getStats() {
        const totalRequests = this.requests.length;
        const successfulRequests = this.requests.filter(r => r.success).length;
        const failedRequests = totalRequests - successfulRequests;
        
        const durations = this.requests.filter(r => r.success).map(r => r.duration);
        const avgDuration = durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0;
        const minDuration = durations.length > 0 ? Math.min(...durations) : 0;
        const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;
        
        const totalTime = this.endTime - this.startTime;
        const requestsPerSecond = totalRequests / (totalTime / 1000);
        const successfulRequestsPerSecond = successfulRequests / (totalTime / 1000);

        return {
            totalRequests,
            successfulRequests,
            failedRequests,
            successRate: (successfulRequests / totalRequests * 100).toFixed(2),
            avgDuration: avgDuration.toFixed(2),
            minDuration: minDuration.toFixed(2),
            maxDuration: maxDuration.toFixed(2),
            totalTime: totalTime.toFixed(2),
            requestsPerSecond: requestsPerSecond.toFixed(2),
            successfulRequestsPerSecond: successfulRequestsPerSecond.toFixed(2),
            errors: this.errors
        };
    }
}

class DenoServerStressTester {
    constructor(port = 9640) {
        this.port = port;
        this.baseUrl = `http://localhost:${port}`;
        this.hyphaCore = null;
        this.api = null;
    }

    async setup() {
        console.log('🚀 Setting up Deno server for stress testing...\n');
        
        // Create HyphaCore instance with Deno server
        this.hyphaCore = new HyphaCore({
            port: this.port,
            ServerClass: DenoWebSocketServer,
            WebSocketClass: WebSocket
        });
        
        // Start the server
        this.api = await this.hyphaCore.start();
        console.log(`✅ Server started on ${this.baseUrl}\n`);
        
        // Register a comprehensive test service
        await this.api.registerService({
            id: 'stress-test-service',
            name: 'Stress Test Service',
            description: 'A service designed for stress testing with various function types',
            config: {
                require_context: false,
                visibility: 'public'
            },
            // Simple functions
            echo: function(message = 'Hello') {
                return { echo: message, timestamp: Date.now() };
            },
            
            add: function(a = 1, b = 1) {
                return { result: Number(a) + Number(b), operation: 'addition' };
            },
            
            multiply: function(a = 1, b = 1) {
                return { result: Number(a) * Number(b), operation: 'multiplication' };
            },
            
            // Math operations object
            math: {
                add: function(a, b) {
                    return Number(a) + Number(b);
                },
                multiply: function(a, b) {
                    return Number(a) * Number(b);
                },
                power: function(base, exponent) {
                    return Math.pow(Number(base), Number(exponent));
                },
                factorial: function(n) {
                    const num = Number(n);
                    if (num <= 1) return 1;
                    let result = 1;
                    for (let i = 2; i <= num; i++) {
                        result *= i;
                    }
                    return result;
                }
            },
            
            // CPU intensive function  
            fibonacci: function(n = 10) {
                const num = Number(n);
                if (num <= 1) return { result: num, input: num };
                
                // Use iterative approach for better performance
                let a = 0, b = 1, temp;
                for (let i = 2; i <= num; i++) {
                    temp = a + b;
                    a = b;
                    b = temp;
                }
                return { result: b, input: num };
            },
            
            // Array processing
            processArray: function(size = 100) {
                const arr = Array.from({ length: Number(size) }, (_, i) => i + 1);
                return {
                    original: arr.slice(0, 5), // Show first 5
                    sum: arr.reduce((a, b) => a + b, 0),
                    average: arr.reduce((a, b) => a + b, 0) / arr.length,
                    size: arr.length
                };
            },
            
            // String processing
            processString: function(text = 'Hello World', repeat = 1) {
                const repeated = text.repeat(Number(repeat));
                return {
                    original: text,
                    repeated: repeated,
                    length: repeated.length,
                    upperCase: repeated.toUpperCase(),
                    wordCount: repeated.split(' ').length
                };
            },
            
            // Information functions
            getServerInfo: function() {
                return {
                    name: 'Stress Test Service',
                    version: '1.0.0',
                    platform: 'Deno',
                    timestamp: Date.now()
                };
            },
            
            // Async simulation
            delayedResponse: async function(delay = 100) {
                await new Promise(resolve => setTimeout(resolve, Number(delay)));
                return { 
                    message: 'Delayed response completed',
                    delay: Number(delay),
                    timestamp: Date.now()
                };
            }
        });
        
        console.log('✅ Stress test service registered\n');
    }

    async makeRequest(endpoint, expectedStatusCode = 200) {
        const startTime = performance.now();
        
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`);
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            if (response.status === expectedStatusCode) {
                const data = await response.json();
                return {
                    success: true,
                    duration,
                    data,
                    statusCode: response.status
                };
            } else {
                return {
                    success: false,
                    duration,
                    statusCode: response.status,
                    error: new Error(`Unexpected status code: ${response.status}`)
                };
            }
        } catch (error) {
            const endTime = performance.now();
            const duration = endTime - startTime;
            return {
                success: false,
                duration,
                error,
                statusCode: null
            };
        }
    }

    async runConcurrentRequests(endpoints, concurrency = 10, requestsPerEndpoint = 100) {
        console.log(`🔥 Running stress test with ${concurrency} concurrent requests...`);
        console.log(`📊 ${requestsPerEndpoint} requests per endpoint across ${endpoints.length} endpoints`);
        console.log(`📈 Total requests: ${endpoints.length * requestsPerEndpoint}\n`);

        const results = new StressTestResults();
        results.startTime = Date.now();

        const allRequests = [];
        
        // Create all request promises
        for (const endpoint of endpoints) {
            for (let i = 0; i < requestsPerEndpoint; i++) {
                allRequests.push(endpoint);
            }
        }

        // Shuffle requests for better concurrency simulation
        for (let i = allRequests.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allRequests[i], allRequests[j]] = [allRequests[j], allRequests[i]];
        }

        // Process requests in batches of 'concurrency' size
        for (let i = 0; i < allRequests.length; i += concurrency) {
            const batch = allRequests.slice(i, i + concurrency);
            
            const batchPromises = batch.map(async (endpoint) => {
                const result = await this.makeRequest(endpoint);
                results.addRequest(
                    result.duration,
                    result.success,
                    endpoint,
                    result.statusCode,
                    result.error
                );
                return result;
            });

            // Wait for the current batch to complete
            await Promise.all(batchPromises);
            
            // Progress indicator
            const progress = ((i + batch.length) / allRequests.length * 100).toFixed(1);
            const stdout = new TextEncoder().encode(`\r⏳ Progress: ${progress}% (${i + batch.length}/${allRequests.length})`);
            await Deno.stdout.write(stdout);
        }

        results.endTime = Date.now();
        console.log('\n\n✅ Stress test completed!\n');
        
        return results.getStats();
    }

    async cleanup() {
        if (this.hyphaCore) {
            this.hyphaCore.close();
            console.log('✅ Server closed');
        }
    }
}

async function runStressTest() {
    const tester = new DenoServerStressTester();
    
    try {
        await tester.setup();
        
        // Define test endpoints to stress test
        const endpoints = [
            // Service info endpoints
            '/default/services/stress-test-service',
            
            // Simple function calls
            '/default/services/stress-test-service/echo?message=StressTest',
            '/default/services/stress-test-service/add?a=15&b=25',
            '/default/services/stress-test-service/multiply?a=7&b=9',
            
            // Math object function calls  
            '/default/services/stress-test-service/math.add?a=9&b=22',
            '/default/services/stress-test-service/math.multiply?a=9&b=22',
            '/default/services/stress-test-service/math.power?base=2&exponent=10',
            '/default/services/stress-test-service/math.factorial?n=5',
            
            // More complex operations
            '/default/services/stress-test-service/processArray?size=50',
            '/default/services/stress-test-service/processString?text=Hello&repeat=5',
            '/default/services/stress-test-service/getServerInfo',
            
            // CPU intensive (smaller numbers for stress test)
            '/default/services/stress-test-service/fibonacci?n=15',
            
            // Workspace service endpoints
            '/default/services/ws/echo?msg=WorkspaceTest'
        ];

        // Run multiple test scenarios
        console.log('🧪 Test Scenario 1: Light Load (5 concurrent, 50 requests each)');
        const lightResults = await tester.runConcurrentRequests(endpoints, 5, 50);
        console.log(formatResults(lightResults));

        console.log('\n🧪 Test Scenario 2: Medium Load (10 concurrent, 100 requests each)');
        const mediumResults = await tester.runConcurrentRequests(endpoints, 10, 100);
        console.log(formatResults(mediumResults));

        console.log('\n🧪 Test Scenario 3: Heavy Load (20 concurrent, 150 requests each)');
        const heavyResults = await tester.runConcurrentRequests(endpoints, 20, 150);
        console.log(formatResults(heavyResults));

        // Individual endpoint performance test
        console.log('\n🎯 Individual Endpoint Performance Test:');
        await testIndividualEndpoints(tester, [
            '/default/services/stress-test-service/math.multiply?a=9&b=22',
            '/default/services/stress-test-service/math.add?a=15&b=30',
            '/default/services/stress-test-service/echo?message=Performance'
        ]);

    } catch (error) {
        console.error('❌ Stress test failed:', error);
    } finally {
        await tester.cleanup();
    }
}

async function testIndividualEndpoints(tester, endpoints) {
    for (const endpoint of endpoints) {
        console.log(`\n📍 Testing: ${endpoint}`);
        
        const results = new StressTestResults();
        results.startTime = Date.now();
        
        // Test with very high concurrency for this single endpoint
        const requests = 500;
        const concurrency = 50;
        
        const allPromises = [];
        for (let i = 0; i < requests; i++) {
            allPromises.push(async () => {
                const result = await tester.makeRequest(endpoint);
                results.addRequest(
                    result.duration,
                    result.success,
                    endpoint,
                    result.statusCode,
                    result.error
                );
            });
        }
        
        // Process in batches
        for (let i = 0; i < allPromises.length; i += concurrency) {
            const batch = allPromises.slice(i, i + concurrency);
            await Promise.all(batch.map(fn => fn()));
        }
        
        results.endTime = Date.now();
        const stats = results.getStats();
        
        console.log(`   📊 ${stats.totalRequests} requests in ${stats.totalTime}ms`);
        console.log(`   🚀 ${stats.requestsPerSecond} req/sec (${stats.successfulRequestsPerSecond} successful/sec)`);
        console.log(`   ⏱️  Avg: ${stats.avgDuration}ms, Min: ${stats.minDuration}ms, Max: ${stats.maxDuration}ms`);
        console.log(`   ✅ Success rate: ${stats.successRate}%`);
        
        if (stats.errors.length > 0) {
            console.log(`   ❌ Errors: ${stats.errors.length}`);
        }
    }
}

function formatResults(stats) {
    return `
📊 Stress Test Results:
   Total Requests: ${stats.totalRequests}
   Successful: ${stats.successfulRequests}
   Failed: ${stats.failedRequests}
   Success Rate: ${stats.successRate}%
   
⏱️  Performance:
   Total Time: ${stats.totalTime}ms
   Requests/sec: ${stats.requestsPerSecond}
   Successful Requests/sec: ${stats.successfulRequestsPerSecond}
   
📈 Response Times:
   Average: ${stats.avgDuration}ms
   Minimum: ${stats.minDuration}ms
   Maximum: ${stats.maxDuration}ms
   
${stats.errors.length > 0 ? `❌ Errors (${stats.errors.length}):
${stats.errors.slice(0, 5).map(e => `   • ${e.endpoint}: ${e.error} (${e.statusCode || 'N/A'})`).join('\n')}
${stats.errors.length > 5 ? `   ... and ${stats.errors.length - 5} more` : ''}` : '✅ No errors'}
`;
}

// Run the stress test
console.log('🔥 Deno Server HTTP Endpoint Stress Test\n');
console.log('This test will evaluate the throughput and performance of:');
console.log('• Service info endpoints');
console.log('• Simple function calls with parameters');  
console.log('• Nested function calls (e.g., math.multiply)');
console.log('• Complex data processing functions');
console.log('• Concurrent request handling\n');

runStressTest(); 