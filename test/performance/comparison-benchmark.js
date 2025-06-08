#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env

import { singleInstanceBenchmark } from './single-instance-benchmark.js';
import { clusterBenchmark } from './cluster-benchmark.js';

/**
 * Comprehensive Comparison Benchmark
 * Compares single instance vs Docker cluster performance
 */
async function comparisonBenchmark() {
    console.log('\n🏁 COMPREHENSIVE PERFORMANCE COMPARISON');
    console.log('=======================================');
    console.log('🔥 Single Instance vs Docker Cluster + Redis');
    console.log('🎯 This test will run both scenarios and provide detailed comparison\n');
    
    const results = {
        singleInstance: null,
        cluster: null,
        comparison: null
    };
    
    // Phase 1: Single Instance Benchmark
    console.log('🚀 PHASE 1: Single Instance Benchmark');
    console.log('=====================================');
    try {
        results.singleInstance = await singleInstanceBenchmark();
        console.log('✅ Single instance benchmark completed\n');
    } catch (error) {
        console.error('❌ Single instance benchmark failed:', error.message);
        console.log('⚠️  Continuing with cluster benchmark only...\n');
    }
    
    // Brief pause before next phase
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Phase 2: Cluster Benchmark
    console.log('\n🚀 PHASE 2: Docker Cluster Benchmark');
    console.log('====================================');
    try {
        results.cluster = await clusterBenchmark();
        console.log('✅ Cluster benchmark completed\n');
    } catch (error) {
        console.error('❌ Cluster benchmark failed:', error.message);
        console.log('💡 Make sure cluster is running: deno task cluster:real\n');
    }
    
    // Phase 3: Generate Comparison
    if (results.singleInstance && results.cluster) {
        console.log('\n🚀 PHASE 3: Performance Comparison Analysis');
        console.log('==========================================');
        results.comparison = generateComparisonAnalysis(results.singleInstance, results.cluster);
    } else {
        console.log('\n⚠️  Cannot generate comparison - one or both benchmarks failed');
        if (!results.singleInstance) console.log('   ❌ Single instance benchmark failed');
        if (!results.cluster) console.log('   ❌ Cluster benchmark failed');
    }
    
    return results;
}

function generateComparisonAnalysis(singleResults, clusterResults) {
    console.log('\n📊 DETAILED PERFORMANCE COMPARISON');
    console.log('==================================');
    
    // Extract performance metrics for comparison
    const singleMetrics = extractMetrics(singleResults, 'Single Instance');
    const clusterMetrics = extractMetrics(clusterResults, 'Docker Cluster');
    
    // Calculate performance differences
    const comparison = {
        throughput: calculatePerformanceDiff(singleMetrics.avgThroughput, clusterMetrics.avgThroughput),
        responseTime: calculatePerformanceDiff(clusterMetrics.avgResponseTime, singleMetrics.avgResponseTime), // Lower is better
        reliability: calculatePerformanceDiff(singleMetrics.avgSuccessRate, clusterMetrics.avgSuccessRate),
        peakThroughput: calculatePerformanceDiff(singleMetrics.peakThroughput, clusterMetrics.peakThroughput)
    };
    
    // Generate comparison table
    console.log('\n📈 PERFORMANCE METRICS COMPARISON');
    console.log('| Metric | Single Instance | Docker Cluster | Difference |');
    console.log('|--------|----------------|----------------|------------|');
    console.log(`| Peak Throughput | ${singleMetrics.peakThroughput.toFixed(0)} req/s | ${clusterMetrics.peakThroughput.toFixed(0)} req/s | ${comparison.peakThroughput.display} |`);
    console.log(`| Avg Throughput | ${singleMetrics.avgThroughput.toFixed(0)} req/s | ${clusterMetrics.avgThroughput.toFixed(0)} req/s | ${comparison.throughput.display} |`);
    console.log(`| Avg Response Time | ${singleMetrics.avgResponseTime.toFixed(2)}ms | ${clusterMetrics.avgResponseTime.toFixed(2)}ms | ${comparison.responseTime.display} |`);
    console.log(`| Avg Success Rate | ${singleMetrics.avgSuccessRate.toFixed(1)}% | ${clusterMetrics.avgSuccessRate.toFixed(1)}% | ${comparison.reliability.display} |`);
    
    // Performance by load scenario
    console.log('\n📋 PERFORMANCE BY LOAD SCENARIO');
    console.log('| Scenario | Single (req/s) | Cluster (req/s) | Difference |');
    console.log('|----------|---------------|----------------|------------|');
    
    const scenarios = ['Light Load', 'Medium Load', 'Heavy Load', 'Extreme Load', 'Maximum Load'];
    scenarios.forEach(scenario => {
        const singleScenario = singleResults.find(s => s.scenario === scenario);
        const clusterScenario = clusterResults.find(s => s.scenario === scenario);
        
        if (singleScenario && clusterScenario) {
            const singleAvg = singleScenario.endpoints.reduce((sum, e) => sum + e.requestsPerSecond, 0) / singleScenario.endpoints.length;
            const clusterAvg = clusterScenario.endpoints.reduce((sum, e) => sum + e.requestsPerSecond, 0) / clusterScenario.endpoints.length;
            const diff = calculatePerformanceDiff(singleAvg, clusterAvg);
            
            console.log(`| ${scenario.padEnd(12)} | ${singleAvg.toFixed(0).padStart(11)} | ${clusterAvg.toFixed(0).padStart(12)} | ${diff.display.padStart(8)} |`);
        }
    });
    
    // Analysis and recommendations
    console.log('\n🔍 PERFORMANCE ANALYSIS');
    console.log('=======================');
    
    if (comparison.throughput.percentage > 0) {
        console.log(`🏆 WINNER: Docker Cluster (+${comparison.throughput.percentage.toFixed(1)}% throughput)`);
        console.log('📊 Cluster shows better performance due to:');
        console.log('   ✅ Horizontal scaling across multiple instances');
        console.log('   ✅ Load distribution');
        console.log('   ✅ Parallel processing capability');
    } else {
        console.log(`🏆 WINNER: Single Instance (+${Math.abs(comparison.throughput.percentage).toFixed(1)}% throughput)`);
        console.log('📊 Single instance shows better performance due to:');
        console.log('   ✅ No network overhead');
        console.log('   ✅ Direct memory access');
        console.log('   ✅ No inter-container communication latency');
    }
    
    // Trade-offs analysis
    console.log('\n⚖️  TRADE-OFFS ANALYSIS');
    console.log('=======================');
    
    console.log('\n🖥️  Single Instance:');
    console.log('   ✅ Pros: Lower latency, simpler deployment, no network overhead');
    console.log('   ❌ Cons: Single point of failure, limited scalability, CPU-bound');
    
    console.log('\n🐳 Docker Cluster:');
    console.log('   ✅ Pros: High availability, horizontal scaling, fault tolerance');
    console.log('   ❌ Cons: Network latency, coordination overhead, complex deployment');
    
    // Recommendations
    console.log('\n💡 RECOMMENDATIONS');
    console.log('===================');
    
    if (comparison.throughput.percentage > 20) {
        console.log('🚀 Recommendation: USE DOCKER CLUSTER');
        console.log('   • Significant performance advantage');
        console.log('   • Better for production workloads');
        console.log('   • Handles high availability requirements');
    } else if (comparison.throughput.percentage < -20) {
        console.log('🚀 Recommendation: USE SINGLE INSTANCE');
        console.log('   • Better raw performance');
        console.log('   • Simpler for development/testing');
        console.log('   • Lower resource overhead');
    } else {
        console.log('🚀 Recommendation: DEPENDS ON USE CASE');
        console.log('   • Performance is similar');
        console.log('   • Choose based on availability requirements');
        console.log('   • Single instance: Development/testing');
        console.log('   • Docker cluster: Production/high availability');
    }
    
    // Performance thresholds
    console.log('\n📏 PERFORMANCE THRESHOLDS');
    console.log('=========================');
    const maxThroughput = Math.max(singleMetrics.peakThroughput, clusterMetrics.peakThroughput);
    console.log(`🎯 Peak Performance Achieved: ${maxThroughput.toFixed(0)} req/s`);
    
    if (maxThroughput > 15000) {
        console.log('🏆 EXCELLENT: > 15K req/s - Enterprise grade performance');
    } else if (maxThroughput > 10000) {
        console.log('✅ GOOD: > 10K req/s - Production ready performance');
    } else if (maxThroughput > 5000) {
        console.log('⚠️  ACCEPTABLE: > 5K req/s - Suitable for moderate loads');
    } else {
        console.log('❌ NEEDS OPTIMIZATION: < 5K req/s - Consider performance tuning');
    }
    
    return {
        metrics: { single: singleMetrics, cluster: clusterMetrics },
        comparison,
        winner: comparison.throughput.percentage > 0 ? 'cluster' : 'single'
    };
}

function extractMetrics(results, name) {
    let totalThroughput = 0;
    let totalResponseTime = 0;
    let totalSuccessRate = 0;
    let count = 0;
    let peakThroughput = 0;
    
    results.forEach(scenario => {
        scenario.endpoints.forEach(endpoint => {
            totalThroughput += endpoint.requestsPerSecond;
            totalResponseTime += endpoint.avgMs;
            totalSuccessRate += endpoint.successRate;
            peakThroughput = Math.max(peakThroughput, endpoint.requestsPerSecond);
            count++;
        });
    });
    
    return {
        avgThroughput: totalThroughput / count,
        avgResponseTime: totalResponseTime / count,
        avgSuccessRate: totalSuccessRate / count,
        peakThroughput,
        name
    };
}

function calculatePerformanceDiff(value1, value2) {
    const diff = value1 - value2;
    const percentage = (diff / value2) * 100;
    
    let display;
    if (percentage > 0) {
        display = `+${percentage.toFixed(1)}%`;
    } else if (percentage < 0) {
        display = `${percentage.toFixed(1)}%`;
    } else {
        display = '0.0%';
    }
    
    return {
        absolute: diff,
        percentage,
        display
    };
}

// Helper function to run quick comparison (for CI/automated testing)
export async function quickComparison() {
    console.log('\n⚡ QUICK PERFORMANCE COMPARISON');
    console.log('==============================');
    
    // Reduced test scenarios for quick comparison
    const quickScenarios = [
        { name: 'Quick Test', requests: 1000, concurrency: 50 }
    ];
    
    // This would need to be implemented with reduced test loads
    // For now, just run the full comparison
    return await comparisonBenchmark();
}

// Export for use in other tests
export { comparisonBenchmark };

// Run if called directly
if (import.meta.main) {
    await comparisonBenchmark();
} 