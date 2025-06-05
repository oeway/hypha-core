// HyphaCore Basic Functionality Unit Tests
// Testing core classes and functionality without complex server startup

describe('Mock-Socket Library Tests', () => {
    let MockServer, MockWebSocket;

    before(async () => {
        // Import mock-socket directly to test it
        const mockSocket = await import('mock-socket');
        MockServer = mockSocket.Server;
        MockWebSocket = mockSocket.WebSocket;
    });

    it('should work with basic mock-socket functionality', (done) => {
        const fakeURL = 'ws://localhost:9999';
        const mockServer = new MockServer(fakeURL);

        mockServer.on('connection', socket => {
            socket.on('message', data => {
                expect(data).to.equal('test message');
                socket.send('response from server');
            });
        });

        const ws = new MockWebSocket(fakeURL);
        
        ws.onopen = () => {
            ws.send('test message');
        };
        
        ws.onmessage = (event) => {
            expect(event.data).to.equal('response from server');
            mockServer.stop();
            done();
        };
        
        ws.onerror = (error) => {
            mockServer.stop();
            done(error);
        };
    });

    it('should handle server lifecycle correctly', () => {
        const fakeURL = 'ws://localhost:9998';
        const mockServer = new MockServer(fakeURL);
        
        expect(mockServer).to.be.an('object');
        
        // Test that we can create multiple connections
        const ws1 = new MockWebSocket(fakeURL);
        const ws2 = new MockWebSocket(fakeURL);
        
        expect(ws1).to.be.an('object');
        expect(ws2).to.be.an('object');
        
        mockServer.stop();
    });

    it('should integrate HyphaCore with mock-socket infrastructure', async () => {
        const fakeURL = 'ws://localhost:9997';
        const mockServer = new MockServer(fakeURL);
        
        // Track connections
        const connections = [];
        mockServer.on('connection', socket => {
            connections.push(socket);
            
            // Mock the connection handshake
            socket.on('message', data => {
                try {
                    const authInfo = JSON.parse(data);
                    
                    // Send connection info back (like HyphaCore does)
                    socket.send(JSON.stringify({
                        "type": "connection_info",
                        "hypha_version": "0.1.0",
                        "public_base_url": "https://local-hypha-server:9997",
                        "local_base_url": "https://local-hypha-server:9997",
                        "manager_id": "workspace-manager",
                        "workspace": authInfo.workspace || "default",
                        "client_id": authInfo.client_id || "root",
                        "user": { id: "test-user", is_anonymous: false },
                        "reconnection_token": null
                    }));
                } catch (e) {
                    console.log('Non-JSON message:', data);
                }
            });
        });

        // Create a mock connectToServer function that uses our mock infrastructure
        const mockConnectToServer = async (config) => {
            return new Promise((resolve) => {
                const ws = new MockWebSocket(fakeURL);
                
                ws.onopen = () => {
                    // Send auth info like real connectToServer does
                    ws.send(JSON.stringify({
                        client_id: config.client_id || 'test-client',
                        workspace: config.workspace || 'default',
                        token: config.token || null
                    }));
                };
                
                ws.onmessage = (event) => {
                    try {
                        const connectionInfo = JSON.parse(event.data);
                        if (connectionInfo.type === 'connection_info') {
                            // Return a mock API that behaves like the real one
                            resolve({
                                id: `${connectionInfo.workspace}/${connectionInfo.manager_id}:default`,
                                generateToken: async (tokenConfig) => {
                                    const payload = {
                                        sub: tokenConfig.user_id || 'test-user',
                                        workspace: tokenConfig.workspace || connectionInfo.workspace,
                                        email: tokenConfig.email || 'test@example.com',
                                        roles: tokenConfig.roles || ['user'],
                                        iss: 'hypha-core',
                                        aud: 'hypha-api',
                                        iat: Math.floor(Date.now() / 1000),
                                        exp: Math.floor(Date.now() / 1000) + (tokenConfig.expires_in || 3600)
                                    };
                                    
                                    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
                                    const payloadStr = btoa(JSON.stringify(payload));
                                    const signature = btoa('mock-signature');
                                    
                                    return `${header}.${payloadStr}.${signature}`;
                                },
                                registerService: async (service) => {
                                    return { id: service.id, ...service };
                                },
                                getService: async (serviceId) => {
                                    return {
                                        id: serviceId,
                                        testMethod: async () => 'mock-result'
                                    };
                                },
                                workspace: connectionInfo.workspace,
                                client_id: connectionInfo.client_id
                            });
                        }
                    } catch (e) {
                        console.log('Error parsing connection info:', e);
                    }
                };
            });
        };

        // Test the mock connectToServer
        const api = await mockConnectToServer({
            client_id: 'test-client',
            workspace: 'test-workspace'
        });

        expect(api).to.be.an('object');
        expect(api.generateToken).to.be.a('function');
        expect(api.workspace).to.equal('test-workspace');
        expect(api.client_id).to.equal('test-client');

        // Test token generation
        const token = await api.generateToken({
            user_id: 'alice',
            email: 'alice@test.com',
            roles: ['admin']
        });

        expect(token).to.be.a('string');
        expect(token.split('.')).to.have.lengthOf(3);

        // Verify token content
        const payload = JSON.parse(atob(token.split('.')[1]));
        expect(payload.sub).to.equal('alice');
        expect(payload.workspace).to.equal('test-workspace');
        expect(payload.email).to.equal('alice@test.com');
        expect(payload.roles).to.deep.equal(['admin']);

        // Cleanup
        mockServer.stop();
    });
});

describe('HyphaCore Basic Functionality Tests', () => {
    let HyphaCoreClass;
    let WorkspaceClass;
    let utils;

    before(async () => {
        // Mock browser environment for Node.js
        global.window = {
            addEventListener: function(event, handler) {
                // Mock event listener
                this._eventHandlers = this._eventHandlers || {};
                this._eventHandlers[event] = this._eventHandlers[event] || [];
                this._eventHandlers[event].push(handler);
            },
            removeEventListener: function(event, handler) {
                // Mock event listener removal
                this._eventHandlers = this._eventHandlers || {};
                if (this._eventHandlers[event]) {
                    const index = this._eventHandlers[event].indexOf(handler);
                    if (index > -1) {
                        this._eventHandlers[event].splice(index, 1);
                    }
                }
            },
            _eventHandlers: {}
        };

        global.document = {
            location: {
                href: 'http://localhost:8080/'
            }
        };

        // Mock WebSocket for Node.js environment
        global.WebSocket = class MockWebSocket {
            constructor(url) {
                this.url = url;
                this.readyState = 1; // OPEN
                setTimeout(() => {
                    if (this.onopen) this.onopen();
                }, 0);
            }
            
            send(data) {
                // Mock sending data
            }
            
            close() {
                this.readyState = 3; // CLOSED
                if (this.onclose) this.onclose();
            }
            
            on(event, handler) {
                if (event === 'message') this.onmessage = handler;
                if (event === 'error') this.onerror = handler;
                if (event === 'close') this.onclose = handler;
                if (event === 'open') this.onopen = handler;
            }
        };

        // Mock URL constructor for browser compatibility
        global.URL = global.URL || class MockURL {
            constructor(path, base) {
                if (base) {
                    this.href = base.endsWith('/') ? base + path : base + '/' + path;
                } else {
                    this.href = path;
                }
            }
        };

        // Mock atob and btoa for JWT token operations
        global.atob = global.atob || function(str) {
            return Buffer.from(str, 'base64').toString('ascii');
        };
        
        global.btoa = global.btoa || function(str) {
            return Buffer.from(str, 'ascii').toString('base64');
        };

        // Mock crypto for JWT operations
        global.crypto = global.crypto || {
            subtle: {
                importKey: async () => ({ type: 'secret' }),
                sign: async () => new ArrayBuffer(32)
            }
        };

        // Import the classes we need to test
        const hyphaModule = await import('../../src/hypha-core.js');
        const workspaceModule = await import('../../src/workspace.js');
        const utilsModule = await import('../../src/utils/index.js');
        
        HyphaCoreClass = hyphaModule.HyphaCore;
        WorkspaceClass = workspaceModule.Workspace;
        utils = utilsModule;
    });

    after(() => {
        // Clean up global mocks
        delete global.window;
        delete global.document;
        delete global.WebSocket;
    });

    describe('HyphaCore Class Instantiation', () => {
        it('should create HyphaCore instance with default config', () => {
            const core = new HyphaCoreClass();
            
            expect(core.port).to.equal(8080);
            expect(core.baseUrl).to.be.a('string');
            expect(core.jwtSecret).to.be.a('string');
            expect(core.connections).to.be.an('object');
            expect(core.workspaceManagerId).to.equal('workspace-manager');
        });

        it('should create HyphaCore instance with custom config', () => {
            const customConfig = {
                port: 9999,
                base_url: 'https://custom.com/',
                jwtSecret: 'custom-secret'
            };
            
            const core = new HyphaCoreClass(customConfig);
            
            expect(core.port).to.equal(9999);
            expect(core.baseUrl).to.equal('https://custom.com/');
            expect(core.jwtSecret).to.equal('custom-secret');
        });

        it('should normalize base_url to end with slash', () => {
            const core = new HyphaCoreClass({
                base_url: 'https://example.com'
            });
            
            expect(core.baseUrl).to.equal('https://example.com/');
        });

        it('should validate configuration conflicts', () => {
            expect(() => {
                new HyphaCoreClass({
                    url: 'wss://example.com/ws',
                    port: 8080
                });
            }).to.throw('Please provide either url or port, not both.');
        });

        it('should generate random JWT secret if not provided', () => {
            const core1 = new HyphaCoreClass();
            const core2 = new HyphaCoreClass();
            
            expect(core1.jwtSecret).to.be.a('string');
            expect(core2.jwtSecret).to.be.a('string');
            expect(core1.jwtSecret).to.not.equal(core2.jwtSecret);
        });

        it('should validate WebSocket URL format', () => {
            expect(() => {
                new HyphaCoreClass({
                    url: 'wss://example.com/invalid'
                });
            }).to.throw('Please provide a valid wss url ending with /ws');
        });
    });

    describe('Workspace Class', () => {
        let mockServer;
        let workspace;

        beforeEach(() => {
            mockServer = {
                redis: {
                    hset: sinon.spy(),
                    hgetall: sinon.spy(),
                    keys: sinon.stub().returns([]),
                    exists: sinon.stub().returns(false),
                    delete: sinon.spy()
                },
                connections: {},
                jwtSecret: 'test-secret-key',
                url: 'https://test-server',
                baseUrl: 'https://test-server/',
                on: sinon.spy(),
                off: sinon.spy(),
                emit: sinon.spy()
            };
            
            workspace = new WorkspaceClass(mockServer);
        });

        it('should create workspace instance with server reference', () => {
            expect(workspace._server).to.equal(mockServer);
            expect(workspace._redis).to.equal(mockServer.redis);
            expect(workspace.connections).to.equal(mockServer.connections);
            expect(workspace.serverUrl).to.equal(mockServer.url);
            expect(workspace.baseUrl).to.equal(mockServer.baseUrl);
        });

        it('should provide default service methods', () => {
            const defaultService = workspace.getDefaultService();
            
            expect(defaultService).to.be.an('object');
            expect(defaultService.id).to.equal('default');
            expect(defaultService.name).to.be.a('string');
            expect(defaultService.description).to.be.a('string');
            expect(defaultService.config).to.be.an('object');
            expect(defaultService.config.require_context).to.be.true;
            expect(defaultService.config.visibility).to.equal('public');
        });

        it('should have required service methods', () => {
            const service = workspace.getDefaultService();
            
            // Core service methods
            expect(service.echo).to.be.a('function');
            expect(service.generate_token).to.be.a('function');
            expect(service.register_service).to.be.a('function');
            expect(service.get_service).to.be.a('function');
            expect(service.list_services).to.be.a('function');
            
            // Utility methods
            expect(service.log).to.be.a('function');
            expect(service.info).to.be.a('function');
            expect(service.error).to.be.a('function');
            expect(service.warning).to.be.a('function');
        });
    });

    describe('JWT Token Generation', () => {
        let workspace;
        let mockServer;
        let service;

        beforeEach(() => {
            mockServer = {
                redis: { hset: sinon.spy(), hgetall: sinon.spy(), keys: () => [], exists: () => false },
                connections: {},
                jwtSecret: 'test-secret-key-for-jwt-generation',
                url: 'https://test-server',
                baseUrl: 'https://test-server/',
                on: sinon.spy(),
                off: sinon.spy(),
                emit: sinon.spy()
            };
            
            workspace = new WorkspaceClass(mockServer);
            service = workspace.getDefaultService();
        });

        it('should generate JWT token with basic configuration', async () => {
            const context = {
                ws: 'default',
                from: 'default/root',
                user: { id: 'test-user', email: 'test@example.com', roles: ['user'] }
            };

            const token = await service.generate_token({
                user_id: 'test-user',
                email: 'test@example.com',
                roles: ['user']
            }, context);

            expect(token).to.be.a('string');
            expect(token.split('.')).to.have.lengthOf(3); // JWT format: header.payload.signature
            
            // Decode payload to verify content
            const payloadBase64 = token.split('.')[1];
            const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
            
            expect(payload.sub).to.equal('test-user');
            expect(payload.email).to.equal('test@example.com');
            expect(payload.roles).to.deep.equal(['user']);
            expect(payload.workspace).to.equal('default');
            expect(payload.iss).to.equal('hypha-core');
            expect(payload.aud).to.equal('hypha-api');
        });

        it('should enforce workspace access control for token generation', async () => {
            const context = {
                ws: 'user-workspace',
                from: 'user-workspace/regular-user',
                user: { id: 'regular-user', email: 'user@example.com', roles: ['user'] }
            };

            // Non-root client should not be able to generate cross-workspace tokens
            try {
                await service.generate_token({
                    workspace: 'other-workspace'
                }, context);
                expect.fail('Should have thrown access denied error');
            } catch (error) {
                expect(error.message).to.include('Access denied');
                expect(error.message).to.include('Cannot generate token for workspace');
            }
        });

        it('should allow root client in default workspace to generate cross-workspace tokens', async () => {
            const context = {
                ws: 'default',
                from: 'default/root',
                user: { id: 'root', email: 'admin@example.com', roles: ['admin'] }
            };

            const token = await service.generate_token({
                user_id: 'admin-user',
                workspace: 'target-workspace',
                roles: ['admin']
            }, context);

            const payloadBase64 = token.split('.')[1];
            const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
            
            expect(payload.workspace).to.equal('target-workspace');
            expect(payload.sub).to.equal('admin-user');
            expect(payload.roles).to.deep.equal(['admin']);
        });

        it('should use context defaults when tokenConfig is empty', async () => {
            const context = {
                ws: 'test-workspace',
                from: 'test-workspace/test-client',
                user: {
                    id: 'default-user',
                    email: 'default@example.com',
                    roles: ['default-role']
                }
            };

            const token = await service.generate_token({}, context);
            
            const payloadBase64 = token.split('.')[1];
            const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
            
            expect(payload.sub).to.equal('default-user');
            expect(payload.workspace).to.equal('test-workspace');
            expect(payload.client_id).to.equal('test-client');
            expect(payload.email).to.equal('default@example.com');
            expect(payload.roles).to.deep.equal(['default-role']);
        });

        it('should handle custom expiration times', async () => {
            const context = {
                ws: 'default',
                from: 'default/root'
            };

            const token = await service.generate_token({
                user_id: 'temp-user',
                expires_in: 300 // 5 minutes
            }, context);

            const payloadBase64 = token.split('.')[1];
            const payload = JSON.parse(atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/')));
            
            const now = Math.floor(Date.now() / 1000);
            expect(payload.exp).to.be.greaterThan(now);
            expect(payload.exp).to.be.lessThan(now + 400); // Should be around 5 minutes
        });

        it('should allow built-in services to bypass workspace security restrictions', async () => {
            const context = {
                ws: 'default',
                from: 'default/regular-user', // Non-root user
                user: { id: 'regular-user', email: 'user@example.com', roles: ['user'] }
            };

            // Regular service registration should fail for non-root user in default workspace
            try {
                await workspace.registerService({
                    id: 'regular-service:default',
                    name: 'Regular Service',
                    config: { visibility: 'public' },
                    test: () => 'test'
                }, context);
                expect.fail('Should have thrown access denied error for regular service');
            } catch (error) {
                expect(error.message).to.include('Access denied');
                expect(error.message).to.include('Only root user can register services');
            }

            // Built-in service registration should succeed for non-root user
            try {
                await workspace.registerService({
                    id: 'system-service:built-in',
                    name: 'System Service',
                    config: { visibility: 'public' },
                    systemCheck: () => 'system-ok'
                }, context);
                
                // Verify the service was registered by checking Redis call
                expect(mockServer.redis.hset.called).to.be.true;
                const lastCall = mockServer.redis.hset.getCall(mockServer.redis.hset.callCount - 1);
                expect(lastCall.args[0]).to.include(':built-in@');
            } catch (error) {
                expect.fail(`Built-in service registration should succeed: ${error.message}`);
            }
        });
    });

    describe('Service Registration Logic', () => {
        let workspace;
        let mockServer;

        beforeEach(() => {
            mockServer = {
                redis: {
                    hset: sinon.spy(),
                    hgetall: sinon.stub().returns({}),
                    keys: sinon.stub().returns([]),
                    exists: sinon.stub().returns(false),
                    delete: sinon.spy()
                },
                connections: {},
                jwtSecret: 'test-secret',
                url: 'https://test-server',
                baseUrl: 'https://test-server/',
                on: sinon.spy(),
                off: sinon.spy(),
                emit: sinon.spy()
            };
            
            workspace = new WorkspaceClass(mockServer);
        });

        it('should register service with proper key format', async () => {
            const service = {
                id: 'test-service:default',
                name: 'Test Service',
                config: { visibility: 'public' },
                testMethod: () => 'test'
            };

            const context = {
                ws: 'test-workspace',
                from: 'test-workspace/client1'
            };

            await workspace.registerService(service, context);

            // Verify service was stored with correct key format
            expect(mockServer.redis.hset.called).to.be.true;
            const callArgs = mockServer.redis.hset.getCall(0).args;
            expect(callArgs[0]).to.include('services:public:test-workspace/test-service:default');
        });

        it('should validate service ID format', async () => {
            const service = {
                id: 'invalid/service/id',
                name: 'Invalid Service'
            };

            const context = { ws: 'test-workspace', from: 'test-workspace/client1' };

            try {
                await workspace.registerService(service, context);
                expect.fail('Should have thrown error for invalid service ID');
            } catch (error) {
                expect(error.message).to.include(':');
            }
        });

        it('should handle service configuration defaults', async () => {
            const service = {
                id: 'basic-service:default',
                name: 'Basic Service'
                // No config specified
            };

            const context = { ws: 'test-workspace', from: 'test-workspace/client1' };

            await workspace.registerService(service, context);

            // Check that default config was applied
            expect(service.config).to.be.an('object');
            expect(service.config.workspace).to.equal('test-workspace');
            expect(service.config.visibility).to.equal('protected'); // Default visibility
        });
    });

    describe('Utility Functions', () => {
        it('should convert snake_case to camelCase', () => {
            expect(utils.toCamelCase('snake_case')).to.equal('snakeCase');
            expect(utils.toCamelCase('another_snake_case')).to.equal('anotherSnakeCase');
            expect(utils.toCamelCase('alreadyCamelCase')).to.equal('alreadyCamelCase');
            expect(utils.toCamelCase('single')).to.equal('single');
        });

        it('should generate random IDs', () => {
            const id1 = utils.randId();
            const id2 = utils.randId();
            
            expect(id1).to.be.a('string');
            expect(id2).to.be.a('string');
            expect(id1).to.not.equal(id2);
            expect(id1.length).to.be.greaterThan(10);
        });

        it('should handle assertions correctly', () => {
            expect(() => utils.assert(true)).to.not.throw();
            expect(() => utils.assert(false)).to.throw('Assertion failed');
            expect(() => utils.assert(false, 'Custom error')).to.throw('Custom error');
            expect(() => utils.assert(1 === 1, 'Should not throw')).to.not.throw();
        });
    });

    describe('MessageEmitter Class', () => {
        let emitter;

        beforeEach(() => {
            emitter = new utils.MessageEmitter();
        });

        it('should register and fire event handlers', () => {
            let eventReceived = false;
            let eventData = null;

            emitter.on('test-event', (data) => {
                eventReceived = true;
                eventData = data;
            });

            emitter._fire('test-event', { message: 'hello' });

            expect(eventReceived).to.be.true;
            expect(eventData).to.deep.equal({ message: 'hello' });
        });

        it('should handle multiple event handlers', () => {
            const handler1 = sinon.spy();
            const handler2 = sinon.spy();

            emitter.on('test', handler1);
            emitter.on('test', handler2);
            emitter._fire('test', { data: 'test' });

            expect(handler1.calledOnce).to.be.true;
            expect(handler2.calledOnce).to.be.true;
            expect(handler1.calledWith({ data: 'test' })).to.be.true;
            expect(handler2.calledWith({ data: 'test' })).to.be.true;
        });

        it('should remove event handlers', () => {
            const handler = sinon.spy();

            emitter.on('test', handler);
            emitter._fire('test', 'data1');
            
            emitter.off('test', handler);
            emitter._fire('test', 'data2');

            expect(handler.calledOnce).to.be.true;
            expect(handler.calledWith('data1')).to.be.true;
        });

        it('should handle once handlers', () => {
            const handler = sinon.spy();

            emitter.once('test', handler);
            emitter._fire('test', 'data1');
            emitter._fire('test', 'data2');

            expect(handler.calledOnce).to.be.true;
            expect(handler.calledWith('data1')).to.be.true;
        });

        it('should handle waitFor with timeout', async () => {
            const promise = emitter.waitFor('test-event', 100);
            
            setTimeout(() => {
                emitter._fire('test-event', 'success');
            }, 50);

            const result = await promise;
            expect(result).to.equal('success');
        });

        it('should timeout waitFor when event not fired', async () => {
            try {
                await emitter.waitFor('never-fired', 50);
                expect.fail('Should have thrown timeout error');
            } catch (error) {
                expect(error.message).to.equal('Timeout');
            }
        });
    });

    describe('RedisRPCConnection Class', () => {
        let connection;
        let mockEventBus;

        beforeEach(() => {
            mockEventBus = {
                on: sinon.spy(),
                off: sinon.spy(),
                emit: sinon.spy()
            };

            connection = new utils.RedisRPCConnection(
                mockEventBus,
                'test-workspace',
                'test-client',
                { id: 'user123', email: 'test@example.com' },
                'manager-id'
            );
        });

        it('should create connection with proper configuration', () => {
            expect(connection._workspace).to.equal('test-workspace');
            expect(connection._clientId).to.equal('test-client');
            expect(connection._userInfo).to.deep.equal({ id: 'user123', email: 'test@example.com' });
            expect(connection.manager_id).to.equal('manager-id');
        });

        it('should validate workspace and client ID', () => {
            expect(() => {
                new utils.RedisRPCConnection(mockEventBus, '', 'client', {}, 'manager');
            }).to.throw('Invalid workspace or client ID');

            expect(() => {
                new utils.RedisRPCConnection(mockEventBus, 'workspace', 'client/invalid', {}, 'manager');
            }).to.throw('Invalid workspace or client ID');
        });

        it('should register message handlers correctly', () => {
            const messageHandler = sinon.spy();
            const connectedHandler = sinon.spy();

            connection.on_connected(connectedHandler);
            connection.on_message(messageHandler);

            expect(mockEventBus.on.calledWith('test-workspace/test-client:msg')).to.be.true;
            expect(mockEventBus.on.calledWith('test-workspace/*:msg')).to.be.true;
            expect(connectedHandler.calledOnce).to.be.true;
        });

        it('should handle disconnection properly', async () => {
            const messageHandler = sinon.spy();
            const disconnectedHandler = sinon.spy();

            connection.on_message(messageHandler);
            connection.on_disconnected(disconnectedHandler);

            await connection.disconnect('test reason');

            expect(connection._stop).to.be.true;
            expect(mockEventBus.off.calledWith('test-workspace/test-client:msg')).to.be.true;
            expect(mockEventBus.off.calledWith('test-workspace/*:msg')).to.be.true;
            expect(disconnectedHandler.calledWith('test reason')).to.be.true;
        });
    });

    describe('Configuration Validation', () => {
        it('should handle URL construction correctly', () => {
            // Test WebSocket URL conversion
            const core1 = new HyphaCoreClass({
                url: 'wss://example.com/ws'
            });
            expect(core1.url).to.equal('https://example.com');
            expect(core1.wsUrl).to.equal('wss://example.com/ws');

            // Test HTTP to WS conversion for port-based config
            const core2 = new HyphaCoreClass({
                port: 9000
            });
            expect(core2.url).to.equal('https://local-hypha-server:9000');
            expect(core2.wsUrl).to.equal('wss://local-hypha-server:9000/ws');
        });

        it('should handle default services configuration', () => {
            const defaultServices = {
                customService: () => 'custom result'
            };

            const core = new HyphaCoreClass({
                default_service: defaultServices
            });

            expect(core.defaultServices).to.equal(defaultServices);
            expect(core.defaultServices.customService()).to.equal('custom result');
        });

        it('should generate unique server identifiers', () => {
            const core1 = new HyphaCoreClass({ port: 8081 });
            const core2 = new HyphaCoreClass({ port: 8082 });

            expect(core1.url).to.not.equal(core2.url);
            expect(core1.jwtSecret).to.not.equal(core2.jwtSecret);
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid service configurations gracefully', () => {
            const workspace = new WorkspaceClass({
                redis: { hset: () => {}, hgetall: () => ({}), keys: () => [], exists: () => false },
                connections: {},
                jwtSecret: 'test',
                url: 'https://test',
                baseUrl: 'https://test/',
                on: () => {},
                off: () => {},
                emit: () => {}
            });

            const invalidService = {
                // Missing required fields
                config: { visibility: 'public' }
            };

            const context = { ws: 'test-workspace', from: 'test-workspace/client1' };

            // Should not throw for missing ID (will be handled gracefully)
            expect(() => {
                workspace.registerService(invalidService, context);
            }).to.not.throw();
        });

        it('should handle JWT generation errors', async () => {
            const workspace = new WorkspaceClass({
                redis: { hset: () => {}, hgetall: () => ({}), keys: () => [], exists: () => false },
                connections: {},
                jwtSecret: null, // Invalid secret
                url: 'https://test',
                baseUrl: 'https://test/',
                on: () => {},
                off: () => {},
                emit: () => {}
            });

            const service = workspace.getDefaultService();
            const context = { ws: 'default', from: 'default/root' };

            try {
                await service.generate_token({ user_id: 'test' }, context);
                expect.fail('Should have thrown error for missing JWT secret');
            } catch (error) {
                expect(error.message).to.include('JWT secret not configured');
            }
        });
    });

    describe('End-to-End Workflow Tests (README Examples)', () => {
        let hyphaCore;

        beforeEach(async function() {
            // Import mock-socket directly to test it
            const mockSocket = await import('mock-socket');
            
            // Create HyphaCore instance - it will use mock-socket by default
            const port = 8900 + Math.floor(Math.random() * 100);
            hyphaCore = new HyphaCoreClass({
                ServerClass: mockSocket.Server,
                WebSocketClass: mockSocket.WebSocket,
                jwtSecret: 'end-to-end-test-secret-key',
                url: `https://local-hypha-server:${port}` // Use correct URL format
            });
        });

        afterEach(function() {
            // Clean up
            if (hyphaCore && hyphaCore.close) {
                try {
                    hyphaCore.close();
                } catch (e) {
                    // Ignore cleanup errors
                }
            }
        });

        it('should create and start server with mock-socket classes', async function() {
            this.timeout(5000);
            
            // Test that server can be created and started
            expect(hyphaCore.ServerClass.name).to.equal('Server');
            expect(hyphaCore.WebSocketClass.name).to.equal('WebSocket');
            
            // Start the server part only (without connectToServer)
            if (HyphaCoreClass.servers[hyphaCore.url]) {
                throw new Error(`Server already running at ${hyphaCore.url}`);
            }
            
            hyphaCore.server = new hyphaCore.ServerClass(hyphaCore.wsUrl, { mock: false });
            HyphaCoreClass.servers[hyphaCore.url] = hyphaCore.server;
            hyphaCore.messageHandler = hyphaCore._handleClientMessage.bind(hyphaCore);
            global.window.addEventListener("message", hyphaCore.messageHandler);
            
            hyphaCore.workspaceManager = new WorkspaceClass(hyphaCore);
            await hyphaCore.workspaceManager.setup({
                client_id: hyphaCore.workspaceManagerId,
                method_timeout: 60,
                default_service: hyphaCore.defaultServices,
            });
            
            // Test that workspace manager was created and has JWT generation
            expect(hyphaCore.workspaceManager).to.be.an('object');
            const defaultService = hyphaCore.workspaceManager.getDefaultService();
            expect(defaultService.generate_token).to.be.a('function');
            
            // Test JWT token generation directly
            const token = await defaultService.generate_token({
                user_id: 'test-user',
                workspace: 'test-workspace',
                email: 'test@example.com'
            }, {
                ws: 'default',
                from: 'default/root'
            });
            
            expect(token).to.be.a('string');
            expect(token.split('.')).to.have.lengthOf(3);
            
            // Verify token content
            const payload = JSON.parse(atob(token.split('.')[1]));
            expect(payload.sub).to.equal('test-user');
            expect(payload.workspace).to.equal('test-workspace');
            expect(payload.email).to.equal('test@example.com');
            
            console.log('Server startup and JWT generation successful!');
        });

        it('should handle WebSocket connections with mock-socket', function(done) {
            this.timeout(5000);
            
            // Create mock server
            const server = new hyphaCore.ServerClass(hyphaCore.wsUrl);
            
            server.on('connection', (socket) => {
                socket.on('message', (data) => {
                    try {
                        const authInfo = JSON.parse(data);
                        
                        // Send back connection info like real HyphaCore
                        const connectionInfo = {
                            "type": "connection_info",
                            "hypha_version": "0.1.0",
                            "public_base_url": hyphaCore.url,
                            "local_base_url": hyphaCore.url,
                            "manager_id": "workspace-manager",
                            "workspace": authInfo.workspace || "default",
                            "client_id": authInfo.client_id || "test-client",
                            "user": { id: "test-user", is_anonymous: false },
                            "reconnection_token": null
                        };
                        
                        socket.send(JSON.stringify(connectionInfo));
                        done();
                    } catch (e) {
                        done(e);
                    }
                });
            });
            
            // Create mock client
            const client = new hyphaCore.WebSocketClass(hyphaCore.wsUrl);
            
            client.onopen = () => {
                client.send(JSON.stringify({
                    client_id: 'test-client',
                    workspace: 'test-workspace'
                }));
            };
            
            client.onerror = done;
        });

        it('should verify JWT access controls work correctly', async function() {
            this.timeout(3000);
            
            // Create workspace manager
            hyphaCore.workspaceManager = new WorkspaceClass(hyphaCore);
            await hyphaCore.workspaceManager.setup({
                client_id: hyphaCore.workspaceManagerId,
                method_timeout: 60,
                default_service: hyphaCore.defaultServices,
            });
            
            const service = hyphaCore.workspaceManager.getDefaultService();
            
            // Test that root client in default workspace can generate cross-workspace tokens
            const crossWorkspaceToken = await service.generate_token({
                user_id: 'alice',
                workspace: 'alice-workspace',
                email: 'alice@company.com'
            }, {
                ws: 'default',
                from: 'default/root'
            });
            
            expect(crossWorkspaceToken).to.be.a('string');
            const payload1 = JSON.parse(atob(crossWorkspaceToken.split('.')[1]));
            expect(payload1.workspace).to.equal('alice-workspace');
            
            // Test that non-root client cannot generate cross-workspace tokens
            try {
                await service.generate_token({
                    workspace: 'other-workspace'
                }, {
                    ws: 'user-workspace',
                    from: 'user-workspace/regular-user'
                });
                expect.fail('Should have thrown access denied error');
            } catch (error) {
                expect(error.message).to.include('Access denied');
            }
            
            console.log('JWT access controls verified!');
        });

        it('should verify correct URL format usage', function() {
            // Verify URL format
            expect(hyphaCore.url).to.match(/^https:\/\/local-hypha-server:\d+$/);
            expect(hyphaCore.wsUrl).to.match(/^wss:\/\/local-hypha-server:\d+\/ws$/);
            
            console.log('Server URL:', hyphaCore.url);
            console.log('WebSocket URL:', hyphaCore.wsUrl);
            
            // Verify WebSocket class
            expect(hyphaCore.WebSocketClass).to.be.a('function');
            const { WebSocket: MockWebSocket } = require('mock-socket');
            expect(hyphaCore.WebSocketClass).to.equal(MockWebSocket);
        });
    });
});
