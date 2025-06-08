#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env

/**
 * Performance Testing Demo
 * Demonstrates how to run single instance vs cluster performance tests
 */

console.log('🎯 HYPHA CORE PERFORMANCE TESTING DEMO');
console.log('======================================');
console.log('');

console.log('📋 Available Performance Tests:');
console.log('');

console.log('🆚 1. COMPARISON BENCHMARK (Recommended)');
console.log('   Runs both single instance and cluster tests, then compares results');
console.log('   Command: deno task perf:compare');
console.log('   Requirements: None (automatically starts single instance)');
console.log('   Duration: ~3-5 minutes');
console.log('');

console.log('🖥️  2. SINGLE INSTANCE BENCHMARK');
console.log('   Tests performance of a single Deno WebSocket server');
console.log('   Command: deno task perf:single');
console.log('   Requirements: None (automatically starts server)');
console.log('   Duration: ~2-3 minutes');
console.log('');

console.log('🐳 3. CLUSTER BENCHMARK');
console.log('   Tests performance of Docker cluster with Redis');
console.log('   Command: deno task perf:cluster');
console.log('   Requirements: Running cluster (see setup below)');
console.log('   Duration: ~2-3 minutes');
console.log('');

console.log('🚀 QUICK START GUIDE:');
console.log('====================');
console.log('');

console.log('Option A: Run comparison (easiest):');
console.log('  1. deno task perf:compare');
console.log('     # This will test single instance and prompt for cluster');
console.log('');

console.log('Option B: Test single instance only:');
console.log('  1. deno task perf:single');
console.log('');

console.log('Option C: Test Docker cluster:');
console.log('  1. Start cluster: deno task cluster:real');
console.log('     # Wait for "cluster is running..." message');
console.log('  2. In new terminal: deno task perf:cluster');
console.log('  3. Stop cluster: Ctrl+C in first terminal');
console.log('');

console.log('Option D: Full comparison with real cluster:');
console.log('  1. Start cluster: deno task cluster:real');
console.log('  2. In new terminal: deno task perf:compare');
console.log('  3. Stop cluster: Ctrl+C in first terminal');
console.log('');

console.log('📊 SAMPLE OUTPUT COMPARISON:');
console.log('============================');
console.log('| Metric          | Single Instance | Docker Cluster | Winner    |');
console.log('|-----------------|-----------------|----------------|-----------|');
console.log('| Peak Throughput | 12,000 req/s    | 8,500 req/s    | Single    |');
console.log('| Avg Response    | 3.2ms           | 5.8ms          | Single    |');
console.log('| Scalability     | Limited         | Horizontal     | Cluster   |');
console.log('| Availability    | Single Point    | High Avail     | Cluster   |');
console.log('');

console.log('💡 RECOMMENDATIONS:');
console.log('===================');
console.log('• Development/Testing: Use single instance (better performance)');
console.log('• Production: Use Docker cluster (high availability)');
console.log('• Load > 10K req/s: Consider cluster for load distribution');
console.log('• Critical systems: Always use cluster for fault tolerance');
console.log('');

console.log('🔧 TROUBLESHOOTING:');
console.log('===================');
console.log('• Port already in use: Stop other services on ports 8080-8082');
console.log('• Cluster not found: Make sure "deno task cluster:real" is running');
console.log('• Permission denied: Use --allow-all flags');
console.log('• Low performance: Close other applications, check system resources');
console.log('');

console.log('Ready to run performance tests! Choose an option above.');
console.log('For best results, start with: deno task perf:compare'); 