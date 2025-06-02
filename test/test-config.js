// Test configuration and utilities

const TEST_CONFIG = {
    // Test timeouts
    TIMEOUT: {
        SHORT: 5000,
        MEDIUM: 10000,
        LONG: 30000
    },
    
    // Test URLs
    URLS: {
        LOCAL_BASE: 'http://localhost:8080',
        LITE_HTML: 'http://localhost:8080/lite.html',
        IMJOY_FIDDLE: 'https://if.imjoy.io'
    },
    
    // Mock data
    MOCK_DATA: {
        JWT_TOKEN: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwiZXhwIjoxNjcwMDAwMDAwLCJodHRwczovL2FwaS5pbWpveS5pby9lbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJodHRwczovL2FwaS5pbWpveS5pby9yb2xlcyI6WyJ1c2VyIl0sInNjb3BlIjoicmVhZCB3cml0ZSJ9.signature',
        
        USER_INFO: {
            authenticated: {
                id: 'user123',
                is_anonymous: false,
                email: 'test@example.com',
                roles: ['user'],
                scopes: 'read write'
            },
            anonymous: {
                id: 'anonymous',
                is_anonymous: true,
                email: 'anonymous@imjoy.io'
            }
        },
        
        WORKSPACE_CONFIG: {
            workspace: 'test-workspace',
            client_id: 'test-client',
            default_service: {
                testService: () => 'test-result'
            }
        },
        
        CONNECTION_INFO: {
            type: 'connection_info',
            hypha_version: '0.1.0',
            public_base_url: 'http://localhost:8080',
            local_base_url: 'http://localhost:8080',
            manager_id: 'workspace-manager',
            workspace: 'test-workspace',
            client_id: 'test-client',
            reconnection_token: null
        }
    }
};

// Test utilities
const TestUtils = {
    // Create a mock WebSocket
    createMockWebSocket() {
        return class MockWebSocket {
            constructor(url) {
                this.url = url;
                this.readyState = 1; // OPEN
                this.onopen = null;
                this.onclose = null;
                this.onmessage = null;
                this.onerror = null;
                
                setTimeout(() => {
                    if (this.onopen) this.onopen();
                }, 10);
            }
            
            send(data) {
                console.log('MockWebSocket send:', data);
            }
            
            close() {
                this.readyState = 3; // CLOSED
                if (this.onclose) this.onclose();
            }
        };
    },
    
    // Create a mock event
    createMockEvent(type, data, source = null) {
        return {
            data: { type, ...data },
            source: source || { postMessage: () => {} },
            currentTarget: source || { postMessage: () => {} }
        };
    },
    
    // Wait for condition
    waitFor(condition, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            const check = () => {
                if (condition()) {
                    resolve();
                } else if (Date.now() - start > timeout) {
                    reject(new Error('Timeout waiting for condition'));
                } else {
                    setTimeout(check, 100);
                }
            };
            check();
        });
    },
    
    // Generate random test ID
    randomId() {
        return 'test-' + Math.random().toString(36).substr(2, 9);
    },
    
    // Create JWT token for testing
    createJWTToken(payload) {
        const header = { alg: 'HS256', typ: 'JWT' };
        const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '');
        const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '');
        return `${encodedHeader}.${encodedPayload}.mock-signature`;
    },
    
    // Delay execution
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};

// Mock implementations
const Mocks = {
    // Mock HyphaCore for testing
    createMockHyphaCore() {
        return {
            port: 8080,
            baseUrl: 'http://localhost:8080/',
            workspaceManagerId: 'workspace-manager',
            connections: {},
            defaultServices: {},
            api: null,
            server: null,
            
            async start() {
                this.api = { mock: 'api' };
                return this.api;
            },
            
            async connect() {
                return { mock: 'connection' };
            },
            
            close() {
                this.server = null;
            },
            
            emit() {
                return Promise.resolve();
            },
            
            on() {},
            off() {}
        };
    },
    
    // Mock Workspace
    createMockWorkspace() {
        return {
            id: 'test-workspace',
            setup: () => Promise.resolve(),
            getDefaultService: () => ({
                testService: () => 'test-result'
            }),
            eventBus: {
                emit: () => Promise.resolve(),
                on: () => {},
                off: () => {}
            }
        };
    },
    
    // Mock Server
    createMockServer() {
        return {
            on: () => {},
            stop: () => {},
            url: 'ws://localhost:8080/ws'
        };
    }
};

// Export for Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TEST_CONFIG, TestUtils, Mocks };
} else if (typeof window !== 'undefined') {
    window.TEST_CONFIG = TEST_CONFIG;
    window.TestUtils = TestUtils;
    window.Mocks = Mocks;
} 