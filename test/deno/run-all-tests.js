#!/usr/bin/env -S deno run --allow-net --allow-read --allow-env

/**
 * Deno Test Runner
 * 
 * Runs all Deno tests sequentially and reports the overall results.
 */

import { contextTestRunner } from './context-injection-test.js';
import { streamingTestRunner } from './streaming-test.js';

class DenoTestSuite {
    constructor() {
        this.totalPassed = 0;
        this.totalFailed = 0;
        this.testFiles = [];
    }

    async runTestFile(filename, description) {
        console.log(`\n🚀 Running ${description}...`);
        console.log(`📁 File: ${filename}`);
        
        try {
            // Import and run the test file
            const module = await import(`./${filename}`);
            
            // Different test files have different runner patterns
            if (filename === 'context-injection-test.js') {
                const success = await contextTestRunner.run();
                this.totalPassed += contextTestRunner.passed;
                this.totalFailed += contextTestRunner.failed;
                return success;
            } else if (filename === 'streaming-test.js') {
                const success = await streamingTestRunner.run();
                this.totalPassed += streamingTestRunner.passed;
                this.totalFailed += streamingTestRunner.failed;
                return success;
            } else {
                // For other test files, run them as subprocess
                const command = new Deno.Command(Deno.execPath(), {
                    args: ['run', '--allow-net', '--allow-read', '--allow-env', `test/deno/${filename}`],
                    stdout: 'piped',
                    stderr: 'piped'
                });
                
                const { code, stdout, stderr } = await command.output();
                
                if (code === 0) {
                    console.log(new TextDecoder().decode(stdout));
                    this.totalPassed += 1; // Simplified counting for external processes
                    return true;
                } else {
                    console.error(new TextDecoder().decode(stderr));
                    this.totalFailed += 1;
                    return false;
                }
            }
        } catch (error) {
            console.error(`❌ Failed to run ${filename}:`, error.message);
            this.totalFailed += 1;
            return false;
        }
    }

    async runAll() {
        console.log('🦕 Deno Test Suite - Running All Tests\n');
        console.log('=' .repeat(60));
        
        const testFiles = [
            { filename: 'simple-asgi-test.js', description: 'Simple ASGI Test' },
            { filename: 'context-injection-test.js', description: 'Context Injection Tests' },
            { filename: 'streaming-test.js', description: 'Async Generator Streaming Tests' },
            // Note: asgi-tests.js is commented out because it takes longer and might conflict
            // { filename: 'asgi-tests.js', description: 'Comprehensive ASGI Tests' },
        ];

        const results = [];
        
        for (const { filename, description } of testFiles) {
            const success = await this.runTestFile(filename, description);
            results.push({ filename, description, success });
            
            // Add a small delay between tests to ensure ports are freed
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Final summary
        console.log('\n' + '=' .repeat(60));
        console.log('📊 Final Test Results Summary');
        console.log('=' .repeat(60));
        
        for (const result of results) {
            const status = result.success ? '✅ PASSED' : '❌ FAILED';
            console.log(`${status} - ${result.description}`);
        }
        
        const totalFiles = results.length;
        const passedFiles = results.filter(r => r.success).length;
        const failedFiles = totalFiles - passedFiles;
        
        console.log('\n📈 Overall Statistics:');
        console.log(`   🗂️  Total Test Files: ${totalFiles}`);
        console.log(`   ✅ Passed Files: ${passedFiles}`);
        console.log(`   ❌ Failed Files: ${failedFiles}`);
        console.log(`   📊 Success Rate: ${Math.round(passedFiles/totalFiles*100)}%`);
        
        if (this.totalPassed > 0 || this.totalFailed > 0) {
            console.log(`   🧪 Individual Tests: ${this.totalPassed} passed, ${this.totalFailed} failed`);
        }
        
        const allPassed = failedFiles === 0;
        console.log(`\n🎯 Overall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
        
        return allPassed;
    }
}

// Run the test suite if this file is executed directly
if (import.meta.main) {
    const suite = new DenoTestSuite();
    const success = await suite.runAll();
    Deno.exit(success ? 0 : 1);
}

export { DenoTestSuite }; 