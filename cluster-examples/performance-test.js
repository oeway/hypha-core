/**
 * Performance Test Script for Clustered Deno WebSocket Server
 * 
 * This script tests:
 * 1. WebSocket connection performance
 * 2. HTTP API performance
 * 3. Load balancing distribution
 * 4. Message throughput
 */

const TEST_TARGETS = [
    'http://localhost:8080',
    'http://localhost:8081', 
    'http://localhost:8082',
    'http://localhost'  // Load balancer
];

const WS_TARGETS = [
    'ws://localhost:8080/ws',
    'ws://localhost:8081/ws',
    'ws://localhost:8082/ws', 
    'ws://localhost/ws'  // Load balancer
];

/**
 * Test HTTP endpoint performance
 */
async function testHttpPerformance(url, concurrent = 10, requests = 100) {
    console.log(`\n🔥 Testing HTTP performance: ${url}`);
    console.log(`   Concurrent connections: ${concurrent}`);
    console.log(`   Total requests: ${requests}`);
    
    const startTime = Date.now();
    const promises = [];
    const results = { success: 0, errors: 0, responses: [] };
    
    for (let i = 0; i < concurrent; i++) {
        const promise = async () => {
            for (let j = 0; j < Math.ceil(requests / concurrent); j++) {
                try {
                    const reqStart = Date.now();
                    const response = await fetch(`${url}/health`);
                    const reqEnd = Date.now();
                    
                    if (response.ok) {
                        results.success++;
                        results.responses.push(reqEnd - reqStart);
                    } else {
                        results.errors++;
                    }
                } catch (error) {
                    results.errors++;
                    console.error(`Request error: ${error.message}`);
                }
            }
        };
        promises.push(promise());
    }
    
    await Promise.all(promises);
    const totalTime = Date.now() - startTime;
    
    // Calculate statistics
    const avgResponseTime = results.responses.reduce((a, b) => a + b, 0) / results.responses.length;
    const minResponseTime = Math.min(...results.responses);
    const maxResponseTime = Math.max(...results.responses);
    const requestsPerSecond = (results.success / totalTime) * 1000;
    
    console.log(`✅ Results:`);
    console.log(`   Total time: ${totalTime}ms`);
    console.log(`   Successful requests: ${results.success}`);
    console.log(`   Failed requests: ${results.errors}`);
    console.log(`   Requests/second: ${requestsPerSecond.toFixed(2)}`);
    console.log(`   Avg response time: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`   Min response time: ${minResponseTime}ms`);
    console.log(`   Max response time: ${maxResponseTime}ms`);
    
    return {
        url,
        totalTime,
        success: results.success,
        errors: results.errors,
        requestsPerSecond,
        avgResponseTime,
        minResponseTime,
        maxResponseTime
    };
}

/**
 * Test WebSocket connection performance
 */
async function testWebSocketPerformance(wsUrl, connections = 10, messagesPerConnection = 100) {
    console.log(`\n🔌 Testing WebSocket performance: ${wsUrl}`);
    console.log(`   Concurrent connections: ${connections}`);
    console.log(`   Messages per connection: ${messagesPerConnection}`);
    
    const startTime = Date.now();
    const promises = [];
    const results = { 
        connectionsEstablished: 0, 
        messagesSent: 0, 
        messagesReceived: 0, 
        connectionErrors: 0,
        responseTimes: []
    };
    
    for (let i = 0; i < connections; i++) {
        const promise = new Promise((resolve) => {
            let ws;
            let messageCount = 0;
            let connectionStartTime = Date.now();
            
            try {
                ws = new WebSocket(wsUrl);
                
                ws.onopen = () => {
                    results.connectionsEstablished++;
                    console.log(`Connection ${i + 1} established`);
                    
                    // Send test messages
                    for (let j = 0; j < messagesPerConnection; j++) {
                        const msgStartTime = Date.now();
                        const testMessage = JSON.stringify({
                            type: 'test',
                            id: `${i}-${j}`,
                            timestamp: msgStartTime,
                            data: `Test message ${j} from connection ${i}`
                        });
                        
                        ws.send(testMessage);
                        results.messagesSent++;
                    }
                };
                
                ws.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        if (message.type === 'connection_info') {
                            // Ignore connection info messages
                            return;
                        }
                        
                        results.messagesReceived++;
                        const responseTime = Date.now() - message.timestamp;
                        results.responseTimes.push(responseTime);
                        
                        messageCount++;
                        if (messageCount >= messagesPerConnection) {
                            ws.close();
                        }
                    } catch (error) {
                        console.error('Message parsing error:', error);
                    }
                };
                
                ws.onclose = () => {
                    console.log(`Connection ${i + 1} closed`);
                    resolve();
                };
                
                ws.onerror = (error) => {
                    results.connectionErrors++;
                    console.error(`WebSocket error on connection ${i + 1}:`, error);
                    resolve();
                };
                
                // Timeout after 30 seconds
                setTimeout(() => {
                    if (ws.readyState === WebSocket.OPEN) {
                        ws.close();
                    }
                    resolve();
                }, 30000);
                
            } catch (error) {
                results.connectionErrors++;
                console.error(`Failed to create WebSocket connection ${i + 1}:`, error);
                resolve();
            }
        });
        
        promises.push(promise);
    }
    
    await Promise.all(promises);
    const totalTime = Date.now() - startTime;
    
    // Calculate statistics
    const avgResponseTime = results.responseTimes.length > 0 
        ? results.responseTimes.reduce((a, b) => a + b, 0) / results.responseTimes.length 
        : 0;
    const minResponseTime = results.responseTimes.length > 0 ? Math.min(...results.responseTimes) : 0;
    const maxResponseTime = results.responseTimes.length > 0 ? Math.max(...results.responseTimes) : 0;
    const messagesPerSecond = (results.messagesReceived / totalTime) * 1000;
    
    console.log(`✅ WebSocket Results:`);
    console.log(`   Total time: ${totalTime}ms`);
    console.log(`   Connections established: ${results.connectionsEstablished}/${connections}`);
    console.log(`   Connection errors: ${results.connectionErrors}`);
    console.log(`   Messages sent: ${results.messagesSent}`);
    console.log(`   Messages received: ${results.messagesReceived}`);
    console.log(`   Messages/second: ${messagesPerSecond.toFixed(2)}`);
    console.log(`   Avg response time: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`   Min response time: ${minResponseTime}ms`);
    console.log(`   Max response time: ${maxResponseTime}ms`);
    
    return {
        wsUrl,
        totalTime,
        connectionsEstablished: results.connectionsEstablished,
        connectionErrors: results.connectionErrors,
        messagesSent: results.messagesSent,
        messagesReceived: results.messagesReceived,
        messagesPerSecond,
        avgResponseTime,
        minResponseTime,
        maxResponseTime
    };
}

/**
 * Test load balancing distribution
 */
async function testLoadBalancing(requests = 100) {
    console.log(`\n⚖️ Testing load balancing distribution`);
    console.log(`   Total requests: ${requests}`);
    
    const serverCounts = {};
    
    for (let i = 0; i < requests; i++) {
        try {
            const response = await fetch('http://localhost/health');
            const serverHeader = response.headers.get('server') || 'unknown';
            serverCounts[serverHeader] = (serverCounts[serverHeader] || 0) + 1;
        } catch (error) {
            console.error(`Request ${i} failed:`, error.message);
        }
        
        // Small delay to see distribution
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    console.log(`✅ Load distribution:`);
    Object.entries(serverCounts).forEach(([server, count]) => {
        const percentage = ((count / requests) * 100).toFixed(1);
        console.log(`   ${server}: ${count} requests (${percentage}%)`);
    });
    
    return serverCounts;
}

/**
 * Test cluster status endpoints
 */
async function testClusterStatus() {
    console.log(`\n📊 Testing cluster status endpoints`);
    
    for (const url of TEST_TARGETS.slice(0, 3)) { // Skip load balancer for this test
        try {
            console.log(`\n🔍 Checking ${url}...`);
            
            // Test health endpoint
            const healthResponse = await fetch(`${url}/health`);
            console.log(`   Health status: ${healthResponse.status} ${healthResponse.statusText}`);
            
            // Test workspace services
            const servicesResponse = await fetch(`${url}/default/services`);
            if (servicesResponse.ok) {
                const services = await servicesResponse.json();
                console.log(`   Available services: ${Array.isArray(services) ? services.length : 'unknown'}`);
            } else {
                console.log(`   Services endpoint: ${servicesResponse.status} ${servicesResponse.statusText}`);
            }
            
        } catch (error) {
            console.error(`   Error testing ${url}: ${error.message}`);
        }
    }
}

/**
 * Main performance test function
 */
async function runPerformanceTests() {
    console.log('🚀 Starting Performance Tests for Clustered Deno WebSocket Server\n');
    
    const results = {
        httpTests: [],
        webSocketTests: [],
        loadBalancing: null,
        timestamp: new Date().toISOString()
    };
    
    try {
        // Test cluster status first
        await testClusterStatus();
        
        // Test HTTP performance for each server
        console.log('\n' + '='.repeat(60));
        console.log('HTTP PERFORMANCE TESTS');
        console.log('='.repeat(60));
        
        for (const url of TEST_TARGETS) {
            try {
                const result = await testHttpPerformance(url, 5, 50);
                results.httpTests.push(result);
            } catch (error) {
                console.error(`HTTP test failed for ${url}:`, error.message);
            }
        }
        
        // Test WebSocket performance
        console.log('\n' + '='.repeat(60));
        console.log('WEBSOCKET PERFORMANCE TESTS');
        console.log('='.repeat(60));
        
        for (const wsUrl of WS_TARGETS) {
            try {
                const result = await testWebSocketPerformance(wsUrl, 5, 10);
                results.webSocketTests.push(result);
            } catch (error) {
                console.error(`WebSocket test failed for ${wsUrl}:`, error.message);
            }
        }
        
        // Test load balancing
        console.log('\n' + '='.repeat(60));
        console.log('LOAD BALANCING TESTS');
        console.log('='.repeat(60));
        
        try {
            results.loadBalancing = await testLoadBalancing(50);
        } catch (error) {
            console.error('Load balancing test failed:', error.message);
        }
        
        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('PERFORMANCE TEST SUMMARY');
        console.log('='.repeat(60));
        
        console.log('\n📈 HTTP Performance Summary:');
        results.httpTests.forEach(result => {
            console.log(`   ${result.url}: ${result.requestsPerSecond.toFixed(2)} req/s, ${result.avgResponseTime.toFixed(2)}ms avg`);
        });
        
        console.log('\n🔌 WebSocket Performance Summary:');
        results.webSocketTests.forEach(result => {
            console.log(`   ${result.wsUrl}: ${result.messagesPerSecond.toFixed(2)} msg/s, ${result.avgResponseTime.toFixed(2)}ms avg`);
        });
        
        // Save results to file
        await Deno.writeTextFile(
            'performance-test-results.json', 
            JSON.stringify(results, null, 2)
        );
        console.log('\n💾 Results saved to performance-test-results.json');
        
    } catch (error) {
        console.error('❌ Performance test failed:', error);
    }
    
    console.log('\n🎉 Performance tests completed!');
}

// Run tests if this file is executed directly
if (import.meta.main) {
    await runPerformanceTests();
}

export { runPerformanceTests, testHttpPerformance, testWebSocketPerformance }; 