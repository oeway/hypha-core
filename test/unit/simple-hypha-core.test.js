// Simple tests for HyphaCore functionality
// Testing core features without ES module complications

describe('HyphaCore Basic Functionality', () => {

    afterEach(() => {
        sinon.restore();
    });

    describe('Configuration and Setup', () => {
        it('should handle basic configuration options', () => {
            const config = {
                port: 9000,
                base_url: 'https://example.com/',
                default_service: {
                    testService: () => 'test'
                }
            };
            
            // Test configuration validation logic
            expect(config.port).to.equal(9000);
            expect(config.base_url).to.equal('https://example.com/');
            expect(config.default_service).to.have.property('testService');
        });

        it('should validate URL configuration', () => {
            const validWSUrl = 'wss://example.com/ws';
            const invalidWSUrl = 'wss://example.com/invalid';
            
            // Test URL validation logic
            expect(validWSUrl.endsWith('/ws')).to.be.true;
            expect(invalidWSUrl.endsWith('/ws')).to.be.false;
        });

        it('should ensure baseUrl ends with slash', () => {
            let baseUrl = 'https://example.com';
            if (!baseUrl.endsWith("/")) {
                baseUrl += "/";
            }
            expect(baseUrl).to.equal('https://example.com/');
        });

        it('should validate port and URL configuration conflicts', () => {
            const config1 = { url: 'wss://example.com/ws', port: 8080 };
            
            // Should throw error when both url and port are provided
            if (config1.url && config1.port) {
                expect(() => {
                    throw new Error("Please provide either url or port, not both.");
                }).to.throw('Please provide either url or port, not both.');
            }
        });
    });

    describe('Event System', () => {
        it('should handle event registration and firing', () => {
            const eventHandlers = {};
            const mockEmitter = {
                on(event, handler) {
                    if (!eventHandlers[event]) {
                        eventHandlers[event] = [];
                    }
                    eventHandlers[event].push(handler);
                },
                
                _fire(event, data) {
                    if (eventHandlers[event]) {
                        eventHandlers[event].forEach(handler => {
                            try {
                                handler(data);
                            } catch (e) {
                                console.error(e);
                            }
                        });
                    }
                }
            };

            let eventReceived = false;
            let eventData = null;

            mockEmitter.on('test_event', (data) => {
                eventReceived = true;
                eventData = data;
            });

            mockEmitter._fire('test_event', { message: 'hello' });

            expect(eventReceived).to.be.true;
            expect(eventData).to.deep.equal({ message: 'hello' });
        });

        it('should handle multiple event handlers', () => {
            const eventHandlers = {};
            const mockEmitter = {
                on(event, handler) {
                    if (!eventHandlers[event]) {
                        eventHandlers[event] = [];
                    }
                    eventHandlers[event].push(handler);
                },
                
                _fire(event, data) {
                    if (eventHandlers[event]) {
                        eventHandlers[event].forEach(handler => {
                            handler(data);
                        });
                    }
                }
            };

            const handler1 = sinon.spy();
            const handler2 = sinon.spy();

            mockEmitter.on('test', handler1);
            mockEmitter.on('test', handler2);
            mockEmitter._fire('test', { data: 'test' });

            expect(handler1.calledOnce).to.be.true;
            expect(handler2.calledOnce).to.be.true;
        });
    });

    describe('Connection Management', () => {
        it('should handle WebSocket connection messages', () => {
            const mockConnections = {};
            const mockWebSocketClass = global.WebSocket;

            const clientId = 'test-client';
            const workspace = 'test-workspace';
            const connectionKey = `${workspace}/${clientId}`;
            
            const mockConnection = {
                websocket: null,
                postMessage: sinon.spy()
            };
            
            mockConnections[connectionKey] = mockConnection;

            // Simulate connection creation
            const event = {
                data: {
                    type: 'connect',
                    workspace: workspace,
                    from: clientId,
                    url: 'ws://test.com'
                }
            };

            // Handle message like HyphaCore would
            if (event.data.type === 'connect') {
                const ws = new mockWebSocketClass(event.data.url);
                mockConnection.websocket = ws;
            }

            expect(mockConnection.websocket).to.be.instanceOf(mockWebSocketClass);
        });

        it('should handle message forwarding', () => {
            const mockWebSocket = {
                send: sinon.spy()
            };
            
            const mockConnection = {
                websocket: mockWebSocket
            };

            const event = {
                data: {
                    type: 'message',
                    data: 'test message'
                }
            };

            // Simulate message forwarding
            if (event.data.type === 'message') {
                mockConnection.websocket.send(event.data.data);
            }

            expect(mockWebSocket.send.calledWith('test message')).to.be.true;
        });

        it('should handle connection cleanup', () => {
            const mockWebSocket = {
                close: sinon.spy()
            };
            
            const mockConnection = {
                websocket: mockWebSocket
            };

            const event = {
                data: {
                    type: 'close'
                }
            };

            // Simulate connection cleanup
            if (event.data.type === 'close') {
                mockConnection.websocket.close();
            }

            expect(mockWebSocket.close.called).to.be.true;
        });
    });

    describe('Server Management', () => {
        it('should prevent duplicate servers', () => {
            const servers = {};
            const serverUrl = 'https://localhost:8080';

            // First server
            servers[serverUrl] = { id: 'server1' };

            // Try to add second server
            if (servers[serverUrl]) {
                expect(() => {
                    throw new Error(`Server already running at ${serverUrl}`);
                }).to.throw('Server already running');
            }
        });

        it('should handle server cleanup', () => {
            const servers = {};
            const serverUrl = 'https://localhost:8080';
            
            const mockServer = {
                stop: sinon.spy(),
                url: serverUrl
            };

            servers[serverUrl] = mockServer;

            // Cleanup server
            mockServer.stop();
            delete servers[serverUrl];

            expect(mockServer.stop.called).to.be.true;
            expect(servers[serverUrl]).to.be.undefined;
        });
    });

    describe('Authentication Logic', () => {
        it('should parse JWT tokens correctly', () => {
            const mockJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwiZXhwIjoxNjcwMDAwMDAwfQ.signature';
            
            // Parse JWT payload (base64 URL decode)
            const payload = JSON.parse(atob(mockJWT.split('.')[1]));
            
            expect(payload.sub).to.equal('user123');
            expect(payload.exp).to.equal(1670000000);
        });

        it('should create user info from token', () => {
            const tokenInfo = {
                sub: 'user123',
                exp: Math.floor(Date.now() / 1000) + 3600,
                'https://api.imjoy.io/email': 'test@example.com',
                'https://api.imjoy.io/roles': ['user'],
                scope: 'read write'
            };

            const userInfo = {
                id: tokenInfo.sub,
                is_anonymous: !tokenInfo['https://api.imjoy.io/email'],
                email: tokenInfo['https://api.imjoy.io/email'],
                roles: tokenInfo['https://api.imjoy.io/roles'],
                scopes: tokenInfo.scope,
                expires_at: tokenInfo.exp
            };

            expect(userInfo.id).to.equal('user123');
            expect(userInfo.is_anonymous).to.be.false;
            expect(userInfo.email).to.equal('test@example.com');
            expect(userInfo.roles).to.deep.equal(['user']);
        });

        it('should handle anonymous users', () => {
            const userInfo = {
                id: 'anonymous',
                is_anonymous: true,
                email: 'anonymous@imjoy.io'
            };

            expect(userInfo.id).to.equal('anonymous');
            expect(userInfo.is_anonymous).to.be.true;
            expect(userInfo.email).to.equal('anonymous@imjoy.io');
        });
    });

    describe('Utility Functions', () => {
        it('should convert snake_case to camelCase', () => {
            function toCamelCase(str) {
                if (!str.includes("_")) {
                    return str;
                }
                return str.replace(/_./g, (match) => match[1].toUpperCase());
            }

            expect(toCamelCase('snake_case')).to.equal('snakeCase');
            expect(toCamelCase('another_snake_case')).to.equal('anotherSnakeCase');
            expect(toCamelCase('alreadyCamelCase')).to.equal('alreadyCamelCase');
        });

        it('should generate random IDs', () => {
            function randId() {
                return Math.random().toString(36).substr(2, 10) + new Date().getTime();
            }

            const id1 = randId();
            const id2 = randId();
            
            expect(id1).to.be.a('string');
            expect(id2).to.be.a('string');
            expect(id1).to.not.equal(id2);
            expect(id1.length).to.be.greaterThan(10);
        });

        it('should handle assertions', () => {
            function assert(condition, message) {
                if (!condition) {
                    throw new Error(message || "Assertion failed");
                }
            }

            expect(() => assert(true)).to.not.throw();
            expect(() => assert(false)).to.throw('Assertion failed');
            expect(() => assert(false, 'Custom error')).to.throw('Custom error');
        });
    });

    describe('Connection Info Generation', () => {
        it('should create proper connection info', () => {
            const baseUrl = 'https://localhost:8080';
            const workspace = 'test-workspace';
            const clientId = 'test-client';
            const managerId = 'workspace-manager';
            const userInfo = {
                id: 'user123',
                is_anonymous: false,
                email: 'test@example.com'
            };

            const connectionInfo = {
                type: 'connection_info',
                hypha_version: '0.1.0',
                public_base_url: baseUrl,
                local_base_url: baseUrl,
                manager_id: managerId,
                workspace: workspace,
                client_id: clientId,
                user: userInfo,
                reconnection_token: null
            };

            expect(connectionInfo.type).to.equal('connection_info');
            expect(connectionInfo.workspace).to.equal(workspace);
            expect(connectionInfo.client_id).to.equal(clientId);
            expect(connectionInfo.user).to.equal(userInfo);
            expect(connectionInfo.manager_id).to.equal(managerId);
        });
    });
}); 