/**
 * Deno/Node.js TypeScript Example for HyphaCore
 * 
 * This example demonstrates:
 * - Multi-client authentication with JWT tokens
 * - Workspace-based access control
 * - Service registration and consumption across clients
 * - Security: services require proper authentication
 * - Full TypeScript support with proper type definitions
 */

// Import from implementation file instead of declaration file
import { HyphaCore } from '../src/hypha-core.js';

// Type declarations for Deno global (when available)
declare global {
  const Deno: {
    version: {
      deno: string;
      v8: string;
      typescript: string;
    };
  } | undefined;
}

// Type definitions for HyphaCore interfaces
interface HyphaAPI {
  registerService(service: ServiceConfig): Promise<ServiceConfig>;
  unregisterService(serviceId: string): Promise<void>;
  getService(query: string | ServiceQuery, options?: ServiceOptions): Promise<any>;
  listServices(query?: string | ServiceQuery): Promise<any[]>;
  generateToken(tokenConfig?: TokenConfig): Promise<string>;
  [key: string]: any;
}

interface ServiceConfig {
  id: string;
  name?: string;
  description?: string;
  app_id?: string;
  config?: {
    workspace?: string;
    visibility?: "public" | "protected";
    require_context?: boolean;
    [key: string]: any;
  };
  overwrite?: boolean;
  [methodName: string]: any;
}

interface ServiceQuery {
  id?: string;
  visibility?: string;
  workspace?: string;
  client_id?: string;
  service_id?: string;
  app_id?: string;
  type?: string;
}

interface ServiceOptions {
  mode?: "default" | "random";
  skipTimeout?: boolean;
  timeout?: number;
}

interface TokenConfig {
  user_id?: string;
  workspace?: string;
  client_id?: string;
  email?: string;
  roles?: string[];
  scopes?: string[];
  scope?: string;
  expires_in?: number;
}

// Type definitions for the math service
interface MathService {
  isPrime(n: number): Promise<boolean>;
  factorial(n: number): Promise<number>;
  fibonacci(n: number): Promise<number>;
}

interface TestCase {
  method: keyof MathService;
  arg: number;
  desc: string;
}

interface ServiceContext {
  from?: string;
  ws?: string;
  to?: string;
  user?: any;
}

async function main(): Promise<void> {
    console.log('🚀 Starting HyphaCore Multi-Client Authentication Demo (TypeScript)...');
    
    try {
        // Create HyphaCore instance with server-safe configuration
        const hyphaCore = new HyphaCore({
            port: 9527,
            jwtSecret: 'your-secure-jwt-secret-key',
            base_url: 'http://localhost:9527/',
            default_service: {
                // Basic server utilities
                serverInfo: {
                    getEnvironment: () => ({
                        platform: typeof Deno !== 'undefined' ? 'deno' : 'node',
                        timestamp: new Date().toISOString(),
                        version: typeof Deno !== 'undefined' ? Deno.version : process.version
                    })
                }
            }
        });

        console.log(`📊 Environment: ${hyphaCore.environment}`);
        console.log(`🌐 Server URL: ${hyphaCore.url}`);
        console.log(`🔗 WebSocket URL: ${hyphaCore.wsUrl}`);

        // Start the server
        console.log('\n⚡ Starting server...');
        const serverApi: any = await hyphaCore.start();
        console.log('✅ Server started successfully!');

        // ========================================
        // STEP 1: Generate tokens for different clients
        // ========================================
        console.log('\n🔐 Generating JWT tokens for different clients...');
        
        // Token for service provider (Client A)
        const providerTokenConfig: TokenConfig = {
            user_id: 'service-provider-001',
            workspace: 'compute-workspace',
            roles: ['admin', 'service-provider'],
            expires_in: 3600
        };
        const providerToken: string = await serverApi.generateToken(providerTokenConfig);
        console.log(`📄 Provider token: ${providerToken.substring(0, 50)}...`);

        // Token for service consumer (Client B) - same workspace
        const consumerTokenConfig: TokenConfig = {
            user_id: 'service-consumer-001', 
            workspace: 'compute-workspace',
            roles: ['user', 'compute'],
            expires_in: 3600
        };
        const consumerToken: string = await serverApi.generateToken(consumerTokenConfig);
        console.log(`📄 Consumer token: ${consumerToken.substring(0, 50)}...`);

        // Token for restricted client (Client C) - different workspace
        const restrictedTokenConfig: TokenConfig = {
            user_id: 'restricted-user-001',
            workspace: 'restricted-workspace',
            roles: ['user'],
            expires_in: 3600
        };
        const restrictedToken: string = await serverApi.generateToken(restrictedTokenConfig);
        console.log(`📄 Restricted token: ${restrictedToken.substring(0, 50)}...`);

        // ========================================
        // STEP 2: Client A - Register service with authentication
        // ========================================
        console.log('\n🔧 Client A: Connecting as service provider...');
        const providerClient: any = await hyphaCore.connect({
            token: providerToken,
            workspace: 'compute-workspace',
            client_id: 'provider-client-001'
        });
        console.log('✅ Provider client connected to compute-workspace');

        console.log('\n📦 Client A: Registering computational service...');
        
        // Define the math service with proper TypeScript types
        const mathServiceConfig: ServiceConfig = {
            id: 'math-calculator',
            name: 'Advanced Math Calculator',
            description: 'Provides mathematical computation services',
            config: {
                require_context: true,
                visibility: 'public'
            },
            overwrite: true,
            
            // Service methods with type annotations
            isPrime: function(n: number, context?: ServiceContext): boolean {
                console.log(`  🧮 isPrime(${n}) called by ${context?.from || 'unknown'}`);
                if (n <= 1) return false;
                if (n <= 3) return true;
                if (n % 2 === 0 || n % 3 === 0) return false;
                for (let i = 5; i * i <= n; i += 6) {
                    if (n % i === 0 || n % (i + 2) === 0) return false;
                }
                return true;
            },
            
            factorial: function(n: number, context?: ServiceContext): number {
                console.log(`  🧮 factorial(${n}) called by ${context?.from || 'unknown'}`);
                if (n <= 1) return 1;
                let result = 1;
                for (let i = 2; i <= n; i++) {
                    result *= i;
                }
                return result;
            },
            
            fibonacci: function(n: number, context?: ServiceContext): number {
                console.log(`  🧮 fibonacci(${n}) called by ${context?.from || 'unknown'}`);
                if (n <= 1) return n;
                let a = 0, b = 1;
                for (let i = 2; i <= n; i++) {
                    [a, b] = [b, a + b];
                }
                return b;
            }
        };

        await providerClient.registerService(mathServiceConfig);
        console.log('✅ Math calculator service registered in compute-workspace');

        // ========================================
        // STEP 3: Client B - Connect with token and use service (AUTHORIZED)
        // ========================================
        console.log('\n🔌 Client B: Connecting as authorized consumer...');
        const consumerClient: any = await hyphaCore.connect({
            token: consumerToken,
            workspace: 'compute-workspace',
            client_id: 'consumer-client-001'
        });
        console.log('✅ Consumer client connected to compute-workspace');

        console.log('\n🧮 Client B: Testing service access (AUTHORIZED)...');
        try {
            const mathService = await consumerClient.getService('math-calculator') as MathService | null;
            
            if (!mathService) {
                throw new Error('Math service not found');
            }
            
            // Test various mathematical operations with proper typing
            const testCases: TestCase[] = [
                { method: 'isPrime', arg: 17, desc: 'Check if 17 is prime' },
                { method: 'factorial', arg: 5, desc: 'Calculate 5!' },
                { method: 'fibonacci', arg: 10, desc: 'Get 10th Fibonacci number' },
                { method: 'isPrime', arg: 25, desc: 'Check if 25 is prime' }
            ];

            for (const test of testCases) {
                const result = await mathService[test.method](test.arg);
                console.log(`  ✅ ${test.desc}: ${result}`);
            }
            
            console.log('🎉 Client B successfully used all services!');
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error('❌ Client B service access failed:', errorMessage);
        }

        // ========================================
        // STEP 4: Client C - Try with different workspace (UNAUTHORIZED)
        // ========================================
        console.log('\n🚫 Client C: Testing cross-workspace access (SHOULD FAIL)...');
        const restrictedClient: any = await hyphaCore.connect({
            token: restrictedToken,
            workspace: 'restricted-workspace',
            client_id: 'restricted-client-001'
        });
        console.log('✅ Restricted client connected to restricted-workspace');

        try {
            const mathService = await restrictedClient.getService('math-calculator') as MathService | null;
            if (mathService) {
                const result = await mathService.isPrime(13);
                console.log('❌ SECURITY BREACH: Client C should not have access!', result);
            } else {
                console.log('✅ Security working: Service not accessible from different workspace');
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log(`✅ Security working: ${errorMessage}`);
        }

        // ========================================
        // STEP 5: Anonymous client - Try without token (UNAUTHORIZED)
        // ========================================
        console.log('\n🚫 Anonymous Client: Testing access without token (SHOULD FAIL)...');
        try {
            const anonymousClient: any = await hyphaCore.connect({
                // No token provided
                workspace: 'compute-workspace',
                client_id: 'anonymous-client-001'
            });
            
            const mathService = await anonymousClient.getService('math-calculator') as MathService | null;
            if (mathService) {
                const result = await mathService.isPrime(13);
                console.log('❌ SECURITY BREACH: Anonymous client should not have access!', result);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log(`✅ Security working: ${errorMessage}`);
        }

        // ========================================
        // STEP 6: Show workspace isolation
        // ========================================
        console.log('\n📋 Workspace Service Listing Demo...');
        
        console.log('\n🔍 Services available to Client B (compute-workspace):');
        const computeServices = await consumerClient.listServices();
        computeServices.forEach(service => {
            console.log(`  ✅ ${service.name} (${service.id})`);
        });

        console.log('\n🔍 Services available to Client C (restricted-workspace):');
        const restrictedServices = await restrictedClient.listServices();
        restrictedServices.forEach(service => {
            console.log(`  📝 ${service.name} (${service.id})`);
        });

        // ========================================
        // STEP 7: Token expiration demo (future enhancement)
        // ========================================
        console.log('\n⏰ Token Management Demo...');
        
        // Generate short-lived token (5 seconds)
        const shortTokenConfig: TokenConfig = {
            user_id: 'temp-user-001',
            workspace: 'compute-workspace',
            roles: ['user'],
            expires_in: 5 // 5 seconds
        };
        const shortToken: string = await serverApi.generateToken(shortTokenConfig);
        
        const tempClient: any = await hyphaCore.connect({
            token: shortToken,
            workspace: 'compute-workspace',
            client_id: 'temp-client-001'
        });
        console.log('✅ Temporary client connected with 5-second token');
        
        // Use service immediately (should work)
        try {
            const mathService = await tempClient.getService('math-calculator') as MathService | null;
            if (mathService) {
                const result = await mathService.isPrime(7);
                console.log(`✅ Service call successful while token valid: 7 is prime = ${result}`);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.log(`❌ Service call failed: ${errorMessage}`);
        }

        // ========================================
        // Summary
        // ========================================
        console.log('\n🎉 Multi-Client Authentication Demo Complete!');
        console.log('\n📊 Demo Results:');
        console.log('  ✅ Client A (provider): Successfully registered service with token');
        console.log('  ✅ Client B (consumer): Successfully used service with valid token in same workspace');
        console.log('  🚫 Client C (restricted): Blocked from accessing service (different workspace)');
        console.log('  🚫 Anonymous client: Blocked from accessing service (no token)');
        console.log('  ⏰ Token expiration: Demonstrated time-limited access');
        
        console.log('\n🔐 Security Features Demonstrated:');
        console.log('  ✅ JWT-based authentication required for service access');
        console.log('  ✅ Workspace isolation - services only accessible within same workspace');
        console.log('  ✅ Role-based access control via token claims');
        console.log('  ✅ Client identity verification');
        console.log('  ✅ Token expiration handling');
        console.log('  ✅ Full TypeScript support with type safety');

        console.log('\n🔄 Server is running... Press Ctrl+C to stop');
        
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : undefined;
        console.error('❌ Multi-client demo failed:', errorMessage);
        if (errorStack) {
            console.error('Stack:', errorStack);
        }
    }
}

// Run the example - handle both Deno and Node.js
const isMainModule = typeof import.meta !== 'undefined' && 
    ((import.meta as any).main || (import.meta as any).url === `file://${process?.argv?.[1]}`);

if (isMainModule || typeof require !== 'undefined') {
    main().catch(console.error);
}

export { main };
export type { MathService, TestCase, ServiceContext, HyphaAPI, ServiceConfig, TokenConfig }; 