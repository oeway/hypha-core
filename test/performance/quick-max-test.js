#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env

import { HyphaCore } from '../../src/hypha-core.js';
import { DenoWebSocketServer } from '../../src/deno-websocket-server.js';

// Quick maximum throughput test for the specific endpoint format
async function quickMaxThroughputTest() {
    const port = 9640;
    const baseUrl = `http://localhost:${port}`;
    
    console.log('🚀 Quick Maximum Throughput Test');
    console.log('🛠️  Setting up server...');
    
    // Initialize HyphaCore with Deno WebSocket server
    const hyphaCore = new HyphaCore({
        port: port,
        ServerClass: DenoWebSocketServer
    });

    let api;
    try {
        // Start the server and get the API
        api = await hyphaCore.start();
        
        // Register a simple math service 
        await api.registerService({
            id: 'stress-test-service',
            name: 'Stress Test Service',
            description: 'Simple service for stress testing',
            
            math: {
                multiply: (a = 1, b = 1) => ({ result: Number(a) * Number(b) }),
                add: (a = 1, b = 1) => ({ result: Number(a) + Number(b) })
            }
        });
        
        console.log('✅ Server ready on', baseUrl);
        
        // Test your exact endpoint format: math.multiply?a=9&b=22
        const endpoint = '/default/services/stress-test-service/math.multiply?a=9&b=22';
        
        console.log(`🎯 Testing endpoint: ${endpoint}`);
        console.log('⚡ Starting in 2 seconds...\n');
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const scenarios = [
            { name: 'Burst 1: 1,000 requests, 50 concurrent', total: 1000, concurrency: 50 },
            { name: 'Burst 2: 2,000 requests, 100 concurrent', total: 2000, concurrency: 100 },
            { name: 'Burst 3: 5,000 requests, 200 concurrent', total: 5000, concurrency: 200 },
            { name: 'Burst 4: 10,000 requests, 500 concurrent', total: 10000, concurrency: 500 },
            { name: 'Burst 5: 20,000 requests, 1000 concurrent', total: 20000, concurrency: 1000 },
        ];
        
        for (const scenario of scenarios) {
            console.log(`\n🔥 ${scenario.name}`);
            const results = await runBurst(baseUrl + endpoint, scenario.total, scenario.concurrency);
            console.log(`   📊 ${results.total} requests in ${results.duration.toFixed(1)}ms`);
            console.log(`   🚀 ${results.requestsPerSecond.toFixed(0)} req/sec`);
            console.log(`   ✅ Success rate: ${results.successRate.toFixed(2)}%`);
            console.log(`   ⏱️  Avg: ${results.avgMs.toFixed(2)}ms, Min: ${results.minMs.toFixed(2)}ms, Max: ${results.maxMs.toFixed(2)}ms`);
            
            // Short break between scenarios
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        // Clean up
        if (hyphaCore) {
            hyphaCore.close();
            console.log('\n✅ Server closed');
        }
    }
}

async function runBurst(url, totalRequests, concurrency) {
    const results = [];
    const startTime = performance.now();
    
    let completed = 0;
    
    while (completed < totalRequests) {
        const batchSize = Math.min(concurrency, totalRequests - completed);
        const promises = [];
        
        for (let i = 0; i < batchSize; i++) {
            promises.push(makeRequest(url));
        }
        
        const batchResults = await Promise.all(promises);
        results.push(...batchResults);
        completed += batchSize;
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    const successful = results.filter(r => r.success);
    const durations = successful.map(r => r.duration);
    
    return {
        total: results.length,
        successful: successful.length,
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
            const data = await response.json();
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

await quickMaxThroughputTest();