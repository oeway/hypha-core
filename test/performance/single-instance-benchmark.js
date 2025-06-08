#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env

import { HyphaCore } from '../../src/hypha-core.js';
import { DenoWebSocketServer } from '../../src/deno-websocket-server.js';

/**
 * Single Instance Performance Benchmark
 * Tests the performance of a single Deno WebSocket server instance
 */
async function singleInstanceBenchmark() {
    const port = 9640;
    const baseUrl = `http://localhost:${port}`;
    
    console.log('\n🔥 SINGLE INSTANCE PERFORMANCE BENCHMARK');
    console.log('==========================================');
    console.log(`🖥️  Mode: Single Deno WebSocket Server`);
    console.log(`🌐 URL: ${baseUrl}`);
    console.log(`🎯 Testing endpoints: REST API service calls\n`);
    
    // Initialize HyphaCore with Deno WebSocket server
    const hyphaCore = new HyphaCore({
        port: port,
        host: 'localhost',
        ServerClass: DenoWebSocketServer
    });

    let api;
    try {
        console.log('🚀 Starting single instance server...');
        api = await hyphaCore.start();
        
        // Register comprehensive test services
        await api.registerService({
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
            status: () => ({ status: 'ok', server: 'single-instance', timestamp: Date.now() })
        });
        
        console.log('✅ Single instance server ready');
        console.log('✅ Benchmark service registered\n');
        
        // Define test scenarios
        const scenarios = [
            { name: 'Light Load', requests: 1000, concurrency: 10, description: '1K requests, 10 concurrent' },
            { name: 'Medium Load', requests: 5000, concurrency: 50, description: '5K requests, 50 concurrent' },
            { name: 'Heavy Load', requests: 10000, concurrency: 100, description: '10K requests, 100 concurrent' },
            { name: 'Extreme Load', requests: 20000, concurrency: 200, description: '20K requests, 200 concurrent' },
            { name: 'Maximum Load', requests: 50000, concurrency: 500, description: '50K requests, 500 concurrent' }
        ];
        
        // Test endpoints
        const endpoints = [
            { path: '/default/services/benchmark-service/math.multiply?a=9&b=22', name: 'Math Multiply' },
            { path: '/default/services/benchmark-service/math.add?a=15&b=30', name: 'Math Add' },
            { path: '/default/services/benchmark-service/string.upper?s=performance', name: 'String Upper' },
            { path: '/default/services/benchmark-service/echo?message=benchmark', name: 'Echo' },
            { path: '/default/services/benchmark-service/status', name: 'Status' }
        ];
        
        const results = [];
        
        // Run benchmark scenarios
        for (const scenario of scenarios) {
            console.log(`\n🧪 ${scenario.name}: ${scenario.description}`);
            console.log('='.repeat(50));
            
            const scenarioResults = [];
            
            for (const endpoint of endpoints) {
                console.log(`🎯 Testing: ${endpoint.name}`);
                const url = baseUrl + endpoint.path;
                const result = await runLoadTest(url, scenario.requests, scenario.concurrency);
                
                scenarioResults.push({
                    endpoint: endpoint.name,
                    ...result
                });
                
                console.log(`   📊 ${result.requestsPerSecond.toFixed(0)} req/sec (${result.successRate.toFixed(1)}% success)`);
                console.log(`   ⏱️  ${result.avgMs.toFixed(2)}ms avg, ${result.minMs.toFixed(2)}ms min, ${result.maxMs.toFixed(2)}ms max`);
                
                // Brief pause between endpoints
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            results.push({
                scenario: scenario.name,
                config: scenario,
                endpoints: scenarioResults
            });
            
            // Calculate scenario averages
            const avgThroughput = scenarioResults.reduce((sum, r) => sum + r.requestsPerSecond, 0) / scenarioResults.length;
            const avgSuccess = scenarioResults.reduce((sum, r) => sum + r.successRate, 0) / scenarioResults.length;
            const avgResponse = scenarioResults.reduce((sum, r) => sum + r.avgMs, 0) / scenarioResults.length;
            
            console.log(`\n📈 ${scenario.name} Summary:`);
            console.log(`   🚀 Average Throughput: ${avgThroughput.toFixed(0)} req/sec`);
            console.log(`   ✅ Average Success Rate: ${avgSuccess.toFixed(1)}%`);
            console.log(`   ⏱️  Average Response Time: ${avgResponse.toFixed(2)}ms`);
        }
        
        // Generate comprehensive report
        generateSingleInstanceReport(results);
        
        return results;
        
    } catch (error) {
        console.error('\n❌ Benchmark failed:', error);
        throw error;
    } finally {
        if (hyphaCore) {
            hyphaCore.close();
            console.log('\n✅ Single instance server closed');
        }
    }
}

async function runLoadTest(url, totalRequests, concurrency) {
    const results = [];
    const startTime = performance.now();
    
    let completed = 0;
    const batchSize = Math.min(concurrency, totalRequests);
    
    while (completed < totalRequests) {
        const currentBatch = Math.min(batchSize, totalRequests - completed);
        const promises = [];
        
        for (let i = 0; i < currentBatch; i++) {
            promises.push(makeRequest(url));
        }
        
        const batchResults = await Promise.all(promises);
        results.push(...batchResults);
        completed += currentBatch;
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    const successful = results.filter(r => r.success);
    const durations = successful.map(r => r.duration);
    
    return {
        total: results.length,
        successful: successful.length,
        failed: results.length - successful.length,
        duration: duration,
        requestsPerSecond: results.length / (duration / 1000),
        successRate: (successful.length / results.length) * 100,
        avgMs: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
        minMs: durations.length > 0 ? Math.min(...durations) : 0,
        maxMs: durations.length > 0 ? Math.max(...durations) : 0
    };
}

async function makeRequest(url) {
    const startTime = performance.now();
    
    try {
        const response = await fetch(url);
        const endTime = performance.now();
        
        if (response.status === 200) {
            await response.json(); // Actually consume the response
            return {
                success: true,
                duration: endTime - startTime,
                status: response.status
            };
        } else {
            return {
                success: false,
                duration: endTime - startTime,
                status: response.status
            };
        }
    } catch (error) {
        const endTime = performance.now();
        return {
            success: false,
            duration: endTime - startTime,
            error: error.message
        };
    }
}

function generateSingleInstanceReport(results) {
    console.log('\n\n🏆 SINGLE INSTANCE PERFORMANCE REPORT');
    console.log('=====================================');
    
    // Find best performers
    let bestThroughput = 0;
    let bestEndpoint = '';
    let bestScenario = '';
    
    results.forEach(scenario => {
        scenario.endpoints.forEach(endpoint => {
            if (endpoint.requestsPerSecond > bestThroughput) {
                bestThroughput = endpoint.requestsPerSecond;
                bestEndpoint = endpoint.endpoint;
                bestScenario = scenario.scenario;
            }
        });
    });
    
    console.log(`🥇 Peak Performance: ${bestThroughput.toFixed(0)} req/sec`);
    console.log(`🎯 Best Endpoint: ${bestEndpoint}`);
    console.log(`📊 Best Scenario: ${bestScenario}\n`);
    
    // Summary table
    console.log('📋 Performance Summary by Load:');
    console.log('| Scenario | Avg Throughput | Avg Response | Success Rate |');
    console.log('|----------|---------------|--------------|--------------|');
    
    results.forEach(scenario => {
        const avgThroughput = scenario.endpoints.reduce((sum, r) => sum + r.requestsPerSecond, 0) / scenario.endpoints.length;
        const avgResponse = scenario.endpoints.reduce((sum, r) => sum + r.avgMs, 0) / scenario.endpoints.length;
        const avgSuccess = scenario.endpoints.reduce((sum, r) => sum + r.successRate, 0) / scenario.endpoints.length;
        
        console.log(`| ${scenario.scenario.padEnd(12)} | ${avgThroughput.toFixed(0).padStart(11)} req/s | ${avgResponse.toFixed(1).padStart(10)}ms | ${avgSuccess.toFixed(1).padStart(10)}% |`);
    });
    
    console.log('\n📊 Single Instance Characteristics:');
    console.log('   ✅ No network overhead between services');
    console.log('   ✅ Direct memory access');
    console.log('   ✅ Single process optimization');
    console.log('   ⚠️  Single point of failure');
    console.log('   ⚠️  Limited by single CPU core utilization');
}

// Export for use in comparison tests
export { singleInstanceBenchmark };

// Run if called directly
if (import.meta.main) {
    await singleInstanceBenchmark();
} 