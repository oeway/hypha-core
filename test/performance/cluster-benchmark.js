#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env

/**
 * Docker Cluster Performance Benchmark
 * Tests the performance of multiple Deno WebSocket servers with Redis clustering
 */
async function clusterBenchmark() {
    console.log('\n🐳 DOCKER CLUSTER PERFORMANCE BENCHMARK');
    console.log('=========================================');
    console.log(`🖥️  Mode: Multi-Instance Docker Cluster + Redis`);
    console.log(`🌐 Servers: localhost:8080, localhost:8081, localhost:8082`);
    console.log(`🎯 Testing endpoints: REST API service calls\n`);
    
    // Test cluster availability first
    const servers = [
        { url: 'http://localhost:8080', name: 'Server 1' },
        { url: 'http://localhost:8081', name: 'Server 2' },
        { url: 'http://localhost:8082', name: 'Server 3' }
    ];
    
    console.log('🔍 Checking cluster availability...');
    const availableServers = [];
    
    for (const server of servers) {
        try {
            const response = await fetch(`${server.url}/health`, { 
                method: 'GET',
                headers: { 'Accept': 'text/plain' }
            });
            if (response.status === 200) {
                availableServers.push(server);
                console.log(`✅ ${server.name} (${server.url}): Available`);
            } else {
                console.log(`❌ ${server.name} (${server.url}): Status ${response.status}`);
            }
        } catch (error) {
            console.log(`❌ ${server.name} (${server.url}): ${error.message}`);
        }
    }
    
    if (availableServers.length === 0) {
        console.log('\n❌ No cluster servers available!');
        console.log('💡 Start the cluster first with: deno task cluster:real');
        console.log('💡 Or with Docker Compose: docker-compose -f cluster-examples/docker-compose.yml up -d');
        throw new Error('Cluster not available');
    }
    
    console.log(`\n✅ ${availableServers.length} servers available for testing\n`);
    
    // Check if benchmark services are available
    console.log('🔍 Checking for benchmark services on cluster...');
    
    try {
        const testServer = availableServers[0];
        const servicesResponse = await fetch(`${testServer.url}/default/services`);
        if (servicesResponse.ok) {
            const services = await servicesResponse.json();
            const benchmarkService = services.find(s => s.id === 'root:benchmark-service');
            if (benchmarkService) {
                console.log('✅ Benchmark services found on cluster');
            } else {
                console.log('⚠️  Benchmark services not found - cluster may need restart with updated image');
                throw new Error('Benchmark services not available on cluster');
            }
        }
    } catch (error) {
        console.log('❌ Benchmark services check failed:', error.message);
        console.log('💡 Please rebuild and restart the cluster with: docker-compose -f cluster-examples/docker-compose.yml up -d --build');
        throw error;
    }
    
    console.log('\n🚀 Starting cluster benchmarks...\n');
    
    // Define test scenarios
    const scenarios = [
        { name: 'Light Load', requests: 1000, concurrency: 10, description: '1K requests, 10 concurrent' },
        { name: 'Medium Load', requests: 5000, concurrency: 50, description: '5K requests, 50 concurrent' },
        { name: 'Heavy Load', requests: 10000, concurrency: 100, description: '10K requests, 100 concurrent' },
        { name: 'Extreme Load', requests: 20000, concurrency: 200, description: '20K requests, 200 concurrent' },
        { name: 'Maximum Load', requests: 50000, concurrency: 500, description: '50K requests, 500 concurrent' }
    ];
    
    // Test endpoints - use benchmark services registered on cluster startup
    const endpoints = [
        { path: '/default/services/root:benchmark-service/math.multiply?a=9&b=22', name: 'Math Multiply' },
        { path: '/default/services/root:benchmark-service/math.add?a=15&b=30', name: 'Math Add' },
        { path: '/default/services/root:benchmark-service/string.upper?s=performance', name: 'String Upper' },
        { path: '/default/services/root:benchmark-service/echo?message=benchmark', name: 'Echo' },
        { path: '/default/services/root:benchmark-service/status', name: 'Status' }
    ];
    
    const results = [];
    
    // Run benchmark scenarios
    for (const scenario of scenarios) {
        console.log(`\n🧪 ${scenario.name}: ${scenario.description}`);
        console.log('='.repeat(50));
        
        const scenarioResults = [];
        
        for (const endpoint of endpoints) {
            console.log(`🎯 Testing: ${endpoint.name}`);
            
            // Test across all available servers with load balancing
            const result = await runClusterLoadTest(availableServers, endpoint.path, scenario.requests, scenario.concurrency);
            
            scenarioResults.push({
                endpoint: endpoint.name,
                ...result
            });
            
            console.log(`   📊 ${result.requestsPerSecond.toFixed(0)} req/sec (${result.successRate.toFixed(1)}% success)`);
            console.log(`   ⏱️  ${result.avgMs.toFixed(2)}ms avg, ${result.minMs.toFixed(2)}ms min, ${result.maxMs.toFixed(2)}ms max`);
            console.log(`   🌐 Load distribution: ${result.serverDistribution}`);
            
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
    generateClusterReport(results, availableServers.length);
    
    return results;
}

async function runClusterLoadTest(servers, endpoint, totalRequests, concurrency) {
    const results = [];
    const serverCounts = new Map();
    const startTime = performance.now();
    
    // Initialize server counters
    servers.forEach(server => serverCounts.set(server.url, 0));
    
    let completed = 0;
    const batchSize = Math.min(concurrency, totalRequests);
    
    while (completed < totalRequests) {
        const currentBatch = Math.min(batchSize, totalRequests - completed);
        const promises = [];
        
        for (let i = 0; i < currentBatch; i++) {
            // Load balance across servers (round-robin)
            const server = servers[completed % servers.length];
            const url = server.url + endpoint;
            promises.push(makeClusterRequest(url, server.url));
        }
        
        const batchResults = await Promise.all(promises);
        
        // Count successful requests per server
        batchResults.forEach(result => {
            if (result.success && result.serverUrl) {
                serverCounts.set(result.serverUrl, serverCounts.get(result.serverUrl) + 1);
            }
        });
        
        results.push(...batchResults);
        completed += currentBatch;
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    const successful = results.filter(r => r.success);
    const durations = successful.map(r => r.duration);
    
    // Create server distribution string
    const distribution = Array.from(serverCounts.entries())
        .map(([url, count]) => `${url.split('://')[1]}:${count}`)
        .join(', ');
    
    return {
        total: results.length,
        successful: successful.length,
        failed: results.length - successful.length,
        duration: duration,
        requestsPerSecond: results.length / (duration / 1000),
        successRate: (successful.length / results.length) * 100,
        avgMs: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
        minMs: durations.length > 0 ? Math.min(...durations) : 0,
        maxMs: durations.length > 0 ? Math.max(...durations) : 0,
        serverDistribution: distribution
    };
}

async function makeClusterRequest(url, serverUrl) {
    const startTime = performance.now();
    
    try {
        const response = await fetch(url);
        const endTime = performance.now();
        
        if (response.status === 200) {
            // Consume the response body to complete the request
            const contentType = response.headers.get('content-type');
            let responseData = null;
            
            if (contentType && contentType.includes('application/json')) {
                responseData = await response.json();
            } else {
                responseData = await response.text();
            }
            
            return {
                success: true,
                duration: endTime - startTime,
                status: response.status,
                serverUrl: serverUrl,
                data: responseData
            };
        } else {
            // Consume the response body even for non-200 responses
            try {
                await response.text();
            } catch {
                // Ignore consumption errors
            }
            return {
                success: false,
                duration: endTime - startTime,
                status: response.status,
                serverUrl: serverUrl
            };
        }
    } catch (error) {
        const endTime = performance.now();
        return {
            success: false,
            duration: endTime - startTime,
            error: error.message,
            serverUrl: serverUrl
        };
    }
}

function generateClusterReport(results, serverCount) {
    console.log('\n\n🏆 DOCKER CLUSTER PERFORMANCE REPORT');
    console.log('====================================');
    
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
    console.log(`📊 Best Scenario: ${bestScenario}`);
    console.log(`🖥️  Cluster Size: ${serverCount} servers\n`);
    
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
    
    console.log('\n📊 Docker Cluster Characteristics:');
    console.log(`   ✅ Horizontal scalability (${serverCount} servers)`);
    console.log('   ✅ High availability and fault tolerance');
    console.log('   ✅ Load distribution across instances');
    console.log('   ✅ Redis-based inter-server communication');
    console.log('   ⚠️  Network overhead between containers');
    console.log('   ⚠️  Redis coordination latency');
    console.log('   ⚠️  Docker networking stack overhead');
}

// Export for use in comparison tests
export { clusterBenchmark };

// Run if called directly
if (import.meta.main) {
    await clusterBenchmark();
} 