#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env

/**
 * Streaming Tests
 * 
 * These tests verify that the HTTP proxy properly handles async generators
 * and regular generators by streaming their results as JSONL.
 */

import { HyphaCore } from '../../src/hypha-core.js';
import { DenoWebSocketServer } from '../../src/deno-websocket-server.js';

// Simple test framework
class StreamingTestRunner {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
    }

    test(name, fn) {
        this.tests.push({ name, fn });
    }

    async run() {
        console.log('🦕 Running Streaming Tests\n');
        
        for (const { name, fn } of this.tests) {
            try {
                console.log(`🧪 ${name}`);
                await fn();
                console.log(`✅ PASSED\n`);
                this.passed++;
            } catch (error) {
                console.log(`❌ FAILED: ${error.message}\n`);
                console.error(error.stack);
                this.failed++;
            }
        }
        
        console.log(`📊 Streaming Test Results:`);
        console.log(`   ✅ Passed: ${this.passed}`);
        console.log(`   ❌ Failed: ${this.failed}`);
        console.log(`   📈 Success Rate: ${this.passed}/${this.tests.length} (${Math.round(this.passed/this.tests.length*100)}%)`);
        
        return this.failed === 0;
    }
}

// Assertion helpers
function assert(condition, message) {
    if (!condition) {
        throw new Error(message || 'Assertion failed');
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(`${message || 'Values not equal'}\nExpected: ${expected}\nActual: ${actual}`);
    }
}

function assertExists(value, message) {
    if (value === null || value === undefined) {
        throw new Error(message || 'Value should exist');
    }
}

function assertContains(text, substring, message) {
    if (!text.includes(substring)) {
        throw new Error(`${message || 'Text should contain substring'}\nText: ${text}\nSubstring: ${substring}`);
    }
}

const runner = new StreamingTestRunner();

// Test: Async generator streaming via HTTP
runner.test('Async generator streaming via HTTP', async () => {
    const hyphaCore = new HyphaCore({
        ServerClass: DenoWebSocketServer,
        name: 'async-streaming-test-server',
        description: 'Test server for async generator streaming',
        port: 9800,
        baseUrl: 'http://localhost:9800'
    });

    try {
        const api = await hyphaCore.start();
        
        // Register a service with async generator functions
        await api.registerService({
            id: 'async-streaming-service',
            name: 'Async Streaming Service',
            type: 'functions',
            config: {
                visibility: 'public'
            },
            
            // Async generator that yields values with delays
            async* generateNumbers() {
                for (let i = 1; i <= 3; i++) {
                    yield { number: i, timestamp: Date.now() };
                    // Small delay to test streaming behavior
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            },
            
            // Async generator that yields different types of data
            async* generateMixedData() {
                yield { type: 'string', value: 'hello' };
                await new Promise(resolve => setTimeout(resolve, 25));
                yield { type: 'number', value: 42 };
                await new Promise(resolve => setTimeout(resolve, 25));
                yield { type: 'object', value: { nested: true, data: [1, 2, 3] } };
            }
        });
        
        // Test 1: Basic async generator streaming
        console.log('   📡 Testing basic async generator streaming...');
        const response1 = await fetch('http://localhost:9800/default/services/async-streaming-service/generateNumbers', {
            method: 'POST'
        });
        
        assertEqual(response1.status, 200, 'Response should be 200 OK');
        assertEqual(response1.headers.get('content-type'), 'application/x-ndjson', 'Content-Type should be JSONL');
        assert(response1.body, 'Response should have a body stream');
        
        // Read the streaming response
        const reader = response1.body.getReader();
        const decoder = new TextDecoder();
        const chunks = [];
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            chunks.push(chunk);
        }
        
        // Verify we got streaming chunks
        assert(chunks.length > 0, 'Should receive streaming chunks');
        console.log(`   📊 Received ${chunks.length} chunks`);
        
        // Parse and verify each chunk
        const fullData = chunks.join('');
        const lines = fullData.split('\n').filter(line => line.trim());
        
        assertEqual(lines.length, 3, 'Should receive 3 JSON lines');
        
        for (let i = 0; i < lines.length; i++) {
            const parsed = JSON.parse(lines[i]);
            assertEqual(parsed.number, i + 1, `Line ${i + 1} should have correct number`);
            assertExists(parsed.timestamp, `Line ${i + 1} should have timestamp`);
        }
        
        // Test 2: Mixed data types streaming
        console.log('   🔀 Testing mixed data types streaming...');
        const response2 = await fetch('http://localhost:9800/default/services/async-streaming-service/generateMixedData', {
            method: 'GET'
        });
        
        assertEqual(response2.status, 200, 'Mixed data response should be 200 OK');
        
        const reader2 = response2.body.getReader();
        const chunks2 = [];
        
        while (true) {
            const { done, value } = await reader2.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            chunks2.push(chunk);
        }
        
        const fullData2 = chunks2.join('');
        const lines2 = fullData2.split('\n').filter(line => line.trim());
        
        assertEqual(lines2.length, 3, 'Should receive 3 mixed data lines');
        
        const parsed1 = JSON.parse(lines2[0]);
        assertEqual(parsed1.type, 'string', 'First item should be string type');
        assertEqual(parsed1.value, 'hello', 'First item should have correct value');
        
        const parsed2 = JSON.parse(lines2[1]);
        assertEqual(parsed2.type, 'number', 'Second item should be number type');
        assertEqual(parsed2.value, 42, 'Second item should have correct value');
        
        const parsed3 = JSON.parse(lines2[2]);
        assertEqual(parsed3.type, 'object', 'Third item should be object type');
        assert(parsed3.value.nested === true, 'Third item should have nested object');
        
        console.log('   ✅ All streaming data verified correctly');
        
    } finally {
        hyphaCore.close();
    }
});

// Test: Regular generator streaming via HTTP
runner.test('Regular generator streaming via HTTP', async () => {
    const hyphaCore = new HyphaCore({
        ServerClass: DenoWebSocketServer,
        name: 'sync-streaming-test-server',
        description: 'Test server for regular generator streaming',
        port: 9801,
        baseUrl: 'http://localhost:9801'
    });

    try {
        const api = await hyphaCore.start();
        
        // Register a service with regular generator functions
        await api.registerService({
            id: 'sync-streaming-service',
            name: 'Sync Streaming Service',
            type: 'functions',
            config: {
                visibility: 'public'
            },
            
            // Regular generator that yields values synchronously
            *generateLetters() {
                const letters = ['A', 'B', 'C', 'D'];
                for (const letter of letters) {
                    yield { letter, code: letter.charCodeAt(0) };
                }
            },
            
            // Regular generator with complex objects
            *generateComplexData() {
                yield { id: 1, data: { items: [1, 2, 3], meta: 'first' } };
                yield { id: 2, data: { items: [4, 5, 6], meta: 'second' } };
                yield { id: 3, data: { items: [7, 8, 9], meta: 'third' } };
            }
        });
        
        // Test regular generator streaming
        console.log('   🔤 Testing regular generator streaming...');
        const response = await fetch('http://localhost:9801/default/services/sync-streaming-service/generateLetters');
        
        assertEqual(response.status, 200, 'Response should be 200 OK');
        assertEqual(response.headers.get('content-type'), 'application/x-ndjson', 'Content-Type should be JSONL');
        
        // Read the streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const chunks = [];
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            chunks.push(chunk);
        }
        
        const fullData = chunks.join('');
        const lines = fullData.split('\n').filter(line => line.trim());
        
        assertEqual(lines.length, 4, 'Should receive 4 letter lines');
        
        const expectedLetters = ['A', 'B', 'C', 'D'];
        for (let i = 0; i < lines.length; i++) {
            const parsed = JSON.parse(lines[i]);
            assertEqual(parsed.letter, expectedLetters[i], `Line ${i + 1} should have correct letter`);
            assertEqual(parsed.code, expectedLetters[i].charCodeAt(0), `Line ${i + 1} should have correct char code`);
        }
        
        // Test complex data streaming
        console.log('   🏗️ Testing complex data streaming...');
        const response2 = await fetch('http://localhost:9801/default/services/sync-streaming-service/generateComplexData');
        
        assertEqual(response2.status, 200, 'Complex data response should be 200 OK');
        
        const reader2 = response2.body.getReader();
        const chunks2 = [];
        
        while (true) {
            const { done, value } = await reader2.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            chunks2.push(chunk);
        }
        
        const fullData2 = chunks2.join('');
        const lines2 = fullData2.split('\n').filter(line => line.trim());
        
        assertEqual(lines2.length, 3, 'Should receive 3 complex data lines');
        
        for (let i = 0; i < lines2.length; i++) {
            const parsed = JSON.parse(lines2[i]);
            assertEqual(parsed.id, i + 1, `Item ${i + 1} should have correct ID`);
            assertExists(parsed.data, `Item ${i + 1} should have data`);
            assertExists(parsed.data.items, `Item ${i + 1} should have items array`);
            assertEqual(parsed.data.items.length, 3, `Item ${i + 1} should have 3 items`);
        }
        
        console.log('   ✅ All complex data verified correctly');
        
    } finally {
        hyphaCore.close();
    }
});

// Test: Function returning async generator (promise that resolves to generator)
runner.test('Function returning async generator promise', async () => {
    const hyphaCore = new HyphaCore({
        ServerClass: DenoWebSocketServer,
        name: 'promise-streaming-test-server',
        description: 'Test server for promise-wrapped generator streaming',
        port: 9802,
        baseUrl: 'http://localhost:9802'
    });

    try {
        const api = await hyphaCore.start();
        
        // Register a service with function that returns a promise of generator
        await api.registerService({
            id: 'promise-streaming-service',
            name: 'Promise Streaming Service',
            type: 'functions',
            config: {
                visibility: 'public'
            },
            
            // Function that returns a promise which resolves to an async generator
            async getAsyncGenerator() {
                // Simulate some async setup
                await new Promise(resolve => setTimeout(resolve, 10));
                
                // Return an async generator
                return (async function* () {
                    yield { step: 1, message: 'Starting process' };
                    await new Promise(resolve => setTimeout(resolve, 20));
                    yield { step: 2, message: 'Processing data' };
                    await new Promise(resolve => setTimeout(resolve, 20));
                    yield { step: 3, message: 'Finalizing results' };
                })();
            }
        });
        
        console.log('   🔄 Testing promise-wrapped async generator...');
        const response = await fetch('http://localhost:9802/default/services/promise-streaming-service/getAsyncGenerator');
        
        assertEqual(response.status, 200, 'Response should be 200 OK');
        assertEqual(response.headers.get('content-type'), 'application/x-ndjson', 'Content-Type should be JSONL');
        
        // Read the streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const chunks = [];
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            chunks.push(chunk);
        }
        
        const fullData = chunks.join('');
        const lines = fullData.split('\n').filter(line => line.trim());
        
        assertEqual(lines.length, 3, 'Should receive 3 process steps');
        
        for (let i = 0; i < lines.length; i++) {
            const parsed = JSON.parse(lines[i]);
            assertEqual(parsed.step, i + 1, `Step ${i + 1} should have correct step number`);
            assertExists(parsed.message, `Step ${i + 1} should have message`);
        }
        
        console.log('   ✅ Promise-wrapped generator streaming verified');
        
    } finally {
        hyphaCore.close();
    }
});

// Test: Error handling in streaming generators
runner.test('Error handling in streaming generators', async () => {
    const hyphaCore = new HyphaCore({
        ServerClass: DenoWebSocketServer,
        name: 'error-streaming-test-server',
        description: 'Test server for error handling in streaming',
        port: 9803,
        baseUrl: 'http://localhost:9803'
    });

    try {
        const api = await hyphaCore.start();
        
        // Register a service with error-throwing generator
        await api.registerService({
            id: 'error-streaming-service',
            name: 'Error Streaming Service',
            type: 'functions',
            config: {
                visibility: 'public'
            },
            
            // Async generator that throws an error after yielding some values
            async* generateWithError() {
                yield { step: 1, data: 'First value' };
                await new Promise(resolve => setTimeout(resolve, 10));
                yield { step: 2, data: 'Second value' };
                await new Promise(resolve => setTimeout(resolve, 10));
                throw new Error('Test error in generator');
            }
        });
        
        console.log('   💥 Testing error handling in streaming generator...');
        const response = await fetch('http://localhost:9803/default/services/error-streaming-service/generateWithError');
        
        assertEqual(response.status, 200, 'Response should be 200 OK even with generator error');
        assertEqual(response.headers.get('content-type'), 'application/x-ndjson', 'Content-Type should be JSONL');
        
        // Read the streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const chunks = [];
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            chunks.push(chunk);
        }
        
        const fullData = chunks.join('');
        const lines = fullData.split('\n').filter(line => line.trim());
        
        // Should have 2 successful values + 1 error
        assert(lines.length >= 2, 'Should receive at least 2 lines before error');
        
        // Verify successful values
        const parsed1 = JSON.parse(lines[0]);
        assertEqual(parsed1.step, 1, 'First value should be correct');
        
        const parsed2 = JSON.parse(lines[1]);
        assertEqual(parsed2.step, 2, 'Second value should be correct');
        
        // Check if error was included in stream
        if (lines.length > 2) {
            const errorLine = JSON.parse(lines[lines.length - 1]);
            assert(errorLine.error || errorLine.type === 'error', 'Should include error information');
            console.log('   📝 Error correctly captured in stream');
        }
        
        console.log('   ✅ Error handling verified');
        
    } finally {
        hyphaCore.close();
    }
});

const streamingTestRunner = runner;

// Run the tests if this file is executed directly
if (import.meta.main) {
    const success = await runner.run();
    Deno.exit(success ? 0 : 1);
}

export { streamingTestRunner }; 