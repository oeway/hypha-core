// Hypha Core Test WebWorker
// This worker demonstrates service registration within a WebWorker environment

// Import Hypha RPC for WebWorker integration
importScripts("https://cdn.jsdelivr.net/npm/hypha-rpc@0.20.55/dist/hypha-rpc-websocket.min.js");

console.log('🔧 Test Worker: Starting Hypha client setup...');

// Setup worker as Hypha client
hyphaWebsocketClient.setupLocalClient({
    enable_execution: true,
    workspace: "worker-workspace",
    client_id: "computational-worker-001"
}).then(async (api) => {
    console.log('✅ Test Worker: Hypha client initialized successfully');
    
    // Register computational services
    const exportedServices = await api.export({
        id: 'computational-services:v1',
        name: 'Computational Services',
        description: 'CPU-intensive computations optimized for WebWorker environment',
        
        // Mathematical computations
        fibonacci: function(n) {
            console.log(`🔢 Worker: Computing fibonacci(${n})`);
            if (n <= 1) return n;
            let a = 0, b = 1;
            for (let i = 2; i <= n; i++) {
                [a, b] = [b, a + b];
            }
            return b;
        },
        
        factorial: function(n) {
            console.log(`🔢 Worker: Computing factorial(${n})`);
            if (n <= 1) return 1;
            let result = 1;
            for (let i = 2; i <= n; i++) {
                result *= i;
            }
            return result;
        },
        
        // Prime number operations
        isPrime: function(n) {
            console.log(`🔍 Worker: Checking if ${n} is prime`);
            if (n <= 1) return false;
            if (n <= 3) return true;
            if (n % 2 === 0 || n % 3 === 0) return false;
            for (let i = 5; i * i <= n; i += 6) {
                if (n % i === 0 || n % (i + 2) === 0) return false;
            }
            return true;
        },
        
        findPrimesInRange: function(start, end) {
            console.log(`🔍 Worker: Finding primes between ${start} and ${end}`);
            const primes = [];
            for (let i = start; i <= end; i++) {
                if (this.isPrime(i)) {
                    primes.push(i);
                }
            }
            return primes;
        },
        
        // Array processing operations
        processArray: function(arr, operation) {
            console.log(`📊 Worker: Processing array with operation: ${operation}`);
            const operations = {
                sum: () => arr.reduce((a, b) => a + b, 0),
                product: () => arr.reduce((a, b) => a * b, 1),
                average: () => arr.reduce((a, b) => a + b, 0) / arr.length,
                max: () => Math.max(...arr),
                min: () => Math.min(...arr),
                sort: () => [...arr].sort((a, b) => a - b),
                reverse: () => [...arr].reverse(),
                unique: () => [...new Set(arr)],
                median: () => {
                    const sorted = [...arr].sort((a, b) => a - b);
                    const mid = Math.floor(sorted.length / 2);
                    return sorted.length % 2 === 0 
                        ? (sorted[mid - 1] + sorted[mid]) / 2 
                        : sorted[mid];
                }
            };
            
            if (!operations[operation]) {
                throw new Error(`Unknown operation: ${operation}. Available: ${Object.keys(operations).join(', ')}`);
            }
            
            return operations[operation]();
        },
        
        // Matrix operations
        multiplyMatrices: function(matrixA, matrixB) {
            console.log('🔢 Worker: Multiplying matrices');
            const rows = matrixA.length;
            const cols = matrixB[0].length;
            const result = Array(rows).fill().map(() => Array(cols).fill(0));
            
            for (let i = 0; i < rows; i++) {
                for (let j = 0; j < cols; j++) {
                    for (let k = 0; k < matrixB.length; k++) {
                        result[i][j] += matrixA[i][k] * matrixB[k][j];
                    }
                }
            }
            
            return result;
        },
        
        // String processing
        processText: function(text, operation) {
            console.log(`📝 Worker: Processing text with operation: ${operation}`);
            const operations = {
                reverse: () => text.split('').reverse().join(''),
                uppercase: () => text.toUpperCase(),
                lowercase: () => text.toLowerCase(),
                wordCount: () => text.trim().split(/\s+/).length,
                charCount: () => text.length,
                removeSpaces: () => text.replace(/\s/g, ''),
                palindrome: () => {
                    const cleaned = text.toLowerCase().replace(/[^a-z0-9]/g, '');
                    return cleaned === cleaned.split('').reverse().join('');
                },
                wordFrequency: () => {
                    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
                    const frequency = {};
                    words.forEach(word => {
                        frequency[word] = (frequency[word] || 0) + 1;
                    });
                    return frequency;
                }
            };
            
            if (!operations[operation]) {
                throw new Error(`Unknown text operation: ${operation}. Available: ${Object.keys(operations).join(', ')}`);
            }
            
            return operations[operation]();
        },
        
        // Heavy computation simulation
        heavyComputation: function(iterations = 1000000) {
            console.log(`⚡ Worker: Running heavy computation with ${iterations} iterations`);
            const startTime = Date.now();
            let result = 0;
            
            for (let i = 0; i < iterations; i++) {
                result += Math.sin(i) * Math.cos(i) * Math.tan(i / 1000);
            }
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            return {
                result: result,
                iterations: iterations,
                duration: duration,
                performance: `${iterations / duration} ops/ms`
            };
        },
        
        // Worker status and capabilities
        getWorkerInfo: function() {
            return {
                type: 'webworker',
                environment: 'dedicated-worker',
                timestamp: new Date().toISOString(),
                location: 'WebWorker Thread',
                capabilities: [
                    'fibonacci', 'factorial', 'isPrime', 'findPrimesInRange',
                    'processArray', 'multiplyMatrices', 'processText', 'heavyComputation'
                ],
                memory: self.performance?.memory ? {
                    usedJSHeapSize: self.performance.memory.usedJSHeapSize,
                    totalJSHeapSize: self.performance.memory.totalJSHeapSize,
                    jsHeapSizeLimit: self.performance.memory.jsHeapSizeLimit
                } : 'Memory info not available',
                userAgent: navigator.userAgent,
                hardwareConcurrency: navigator.hardwareConcurrency
            };
        },
        
        // Performance benchmarking
        benchmark: function(testName = 'fibonacci', parameter = 30) {
            console.log(`🏃 Worker: Running benchmark for ${testName}(${parameter})`);
            const startTime = performance.now();
            
            let result;
            switch (testName) {
                case 'fibonacci':
                    result = this.fibonacci(parameter);
                    break;
                case 'factorial':
                    result = this.factorial(parameter);
                    break;
                case 'isPrime':
                    result = this.isPrime(parameter);
                    break;
                case 'heavyComputation':
                    result = this.heavyComputation(parameter);
                    break;
                default:
                    throw new Error(`Unknown benchmark test: ${testName}`);
            }
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            return {
                test: testName,
                parameter: parameter,
                result: result,
                duration: duration,
                timestamp: new Date().toISOString()
            };
        }
    });
    
    console.log('✅ Test Worker: All computational services registered successfully');
    console.log('📋 Available services:', exportedServices);
    
    // Notify main thread that worker is ready
    self.postMessage({ 
        type: 'worker_ready', 
        message: 'Test worker services registered successfully',
        services: Object.keys(exportedServices).filter(key => typeof exportedServices[key] === 'function')
    });
    
}).catch(error => {
    console.error('❌ Test Worker: Failed to setup Hypha client:', error);
    self.postMessage({ 
        type: 'worker_error', 
        error: error.message,
        stack: error.stack 
    });
});

// Handle messages from main thread
self.onmessage = function(event) {
    console.log('📨 Test Worker: Received message from main thread:', event.data);
    
    const { type, data } = event.data;
    
    switch (type) {
        case 'ping':
            self.postMessage({ 
                type: 'pong', 
                message: 'Test worker is alive and operational',
                timestamp: new Date().toISOString()
            });
            break;
            
        case 'status':
            self.postMessage({
                type: 'status_response',
                status: 'running',
                uptime: Date.now() - startTime,
                memory: self.performance?.memory || 'not available'
            });
            break;
            
        case 'shutdown':
            console.log('🛑 Test Worker: Shutdown requested');
            self.postMessage({ type: 'shutdown_acknowledged' });
            self.close();
            break;
            
        default:
            console.warn('⚠️ Test Worker: Unknown message type:', type);
            self.postMessage({ 
                type: 'error', 
                message: `Unknown message type: ${type}` 
            });
    }
};

// Error handling
self.onerror = function(error) {
    console.error('💥 Test Worker: Unhandled error:', error);
    self.postMessage({ 
        type: 'worker_error', 
        error: error.message,
        filename: error.filename,
        lineno: error.lineno 
    });
};

// Track worker start time
const startTime = Date.now();

console.log('🚀 Test Worker: WebWorker initialization complete'); 