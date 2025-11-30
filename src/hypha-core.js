import { Server, WebSocket } from 'mock-socket';
import { hyphaWebsocketClient } from 'hypha-rpc';
import { randId, MessageEmitter, WebsocketRPCConnection, RedisRPCConnection, assert, Environment, convertToSnakeCase } from './utils/index.js';
import { Workspace } from './workspace.js';
import { toCamelCase } from './utils/index.js';
import redisClient from './utils/redis-mock.js';

const connectToServer = hyphaWebsocketClient.connectToServer;
const AUTH0_NAMESPACE = "https://api.imjoy.io/";

// JWT HS256 Implementation (for verification only)
function base64UrlEncode(data) {
    // Check if btoa is available (browser and Deno)
    if (typeof btoa !== 'undefined') {
        const base64 = btoa(
            typeof data === 'string' 
                ? data 
                : String.fromCharCode(...new Uint8Array(data))
        );
        return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    } else if (typeof Buffer !== 'undefined') {
        // For Node.js
        const buffer = typeof data === 'string' ? Buffer.from(data) : Buffer.from(data);
        const base64 = buffer.toString('base64');
        return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    } else {
        throw new Error('Base64 encoding not available in current environment');
    }
}

function base64UrlDecode(base64Url) {
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
        base64 += '=';
    }
    
    // Check if atob is available (browser and Deno)
    if (typeof atob !== 'undefined') {
        return atob(base64);
    } else if (typeof Buffer !== 'undefined') {
        // For Node.js
        return Buffer.from(base64, 'base64').toString('binary');
    } else {
        throw new Error('Base64 decoding not available in current environment');
    }
}

async function hmacSha256(key, data) {
    // Check if Web Crypto API is available
    if (typeof crypto !== 'undefined' && crypto.subtle) {
        const encoder = new TextEncoder();
        const keyData = encoder.encode(key);
        const msgData = encoder.encode(data);
        
        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        
        const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData);
        return new Uint8Array(signature);
    } else {
        throw new Error('JWT HS256 signing requires Web Crypto API (browser) or crypto module (Node.js/Deno)');
    }
}

async function verifyJWT(token, secret) {
    const parts = token.split('.');
    if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
    }
    
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const unsigned = `${encodedHeader}.${encodedPayload}`;
    
    try {
        const header = JSON.parse(base64UrlDecode(encodedHeader));
        if (header.alg !== 'HS256') {
            throw new Error('Unsupported algorithm');
        }
        
        const expectedSignature = await hmacSha256(secret, unsigned);
        const actualSignature = new Uint8Array(
            Array.from(base64UrlDecode(encodedSignature)).map(c => c.charCodeAt(0))
        );
        
        if (expectedSignature.length !== actualSignature.length) {
            throw new Error('Invalid signature');
        }
        
        for (let i = 0; i < expectedSignature.length; i++) {
            if (expectedSignature[i] !== actualSignature[i]) {
                throw new Error('Invalid signature');
            }
        }
        
        const payload = JSON.parse(base64UrlDecode(encodedPayload));
        
        // Check expiration
        if (payload.exp && Date.now() / 1000 > payload.exp) {
            throw new Error('Token expired');
        }
        
        return payload;
    } catch (error) {
        throw new Error(`JWT verification failed: ${error.message}`);
    }
}

async function generateJWT(payload, secret) {
    const header = {
        alg: 'HS256',
        typ: 'JWT'
    };
    
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const unsigned = `${encodedHeader}.${encodedPayload}`;
    
    const signature = await hmacSha256(secret, unsigned);
    const encodedSignature = base64UrlEncode(signature);
    return `${unsigned}.${encodedSignature}`;
}

class HyphaCore extends MessageEmitter {
    static servers = {};

    constructor(config) {
        super();
        config = config || {};
        this.redis = redisClient;
        this.port = config.port || 8080;
        
        // Environment-specific host configuration
        // Browser: Use 'local-hypha-server' for imjoy plugin compatibility
        // Server: Use configurable host (default 'localhost') for real deployment
        if (config.host) {
            this.host = config.host;
        } else if (Environment.isBrowser()) {
            this.host = 'local-hypha-server';
        } else {
            this.host = 'localhost';
        }
        
        // Use environment-safe base URL detection
        // here we keep config.base_url for backward compatibility
        this.baseUrl = config.baseUrl || config.base_url || Environment.getSafeBaseUrl();
        if (!this.baseUrl.endsWith("/")) {
            this.baseUrl += "/";
        }
        
        if (config.url && config.port) {
            throw new Error("Please provide either url or port, not both.");
        }
        this.ServerClass = config.ServerClass || Server;
        this.WebSocketClass = config.WebSocketClass || WebSocket;
        if (config.url && (config.url.startsWith("wss://") || config.url.startsWith("ws://"))) {
            if (!config.url.endsWith("/ws")) {
                throw new Error("Please provide a valid wss url ending with /ws");
            }
            this.url = config.url.replace("wss://", "https://").replace("ws://", "http://").slice(0, -3);
            this.wsUrl = config.url;
        }
        else {
            this.url = config.url || `https://${this.host}:${this.port}`;
            this.wsUrl = this.url.replace("https://", "wss://").replace("http://", "ws://") + "/ws";
        }
        this.api = null;
        this.server = null;
        this.workspaceManagerId = "workspace-manager";
        this.connections = {};
        // here we keep config.default_service for backward compatibility
        const defaultServices = config.defaultService || config.default_service || {};
        
        // Convert camelCase methods to snake_case for Python/JavaScript compatibility
        if (defaultServices && typeof defaultServices === 'object' && Object.keys(defaultServices).length > 0) {
            this.defaultServices = convertToSnakeCase(defaultServices);
            console.debug('🔧 Converted defaultService methods to snake_case for compatibility');
        } else {
            this.defaultServices = defaultServices;
        }
        this.imjoyPluginWindows = new Map();
        this.jwtSecret = config.jwtSecret || "hypha-core-default-secret-" + randId();

        // Environment info for debugging
        this.environment = Environment.getEnvironment();
        
        // Only log window creation in browser environment
        this.on("add_window", (config) => {
            if (Environment.isBrowser()) {
                console.log("Creating window: ", config);
            } else {
                console.warn(`Window creation requested but not supported in ${this.environment} environment:`, config);
            }
        });
    }

    async emit(event, data) {
        this._fire(event, data);
    }

    async _handleImJoyPlugin(event) {
        // Only load imjoyRPC in browser environments when needed
        if (!Environment.isBrowser()) {
            console.warn("ImJoy plugin handling is only supported in browser environments");
            return;
        }

        let imjoyRPC;
        try {
            // Lazy load imjoy-rpc only when needed
            const imjoyModule = await import('imjoy-rpc');
            imjoyRPC = imjoyModule.imjoyRPC;
        } catch (error) {
            console.error("Failed to load imjoy-rpc:", error);
            return;
        }

        const contentWindow = event.source;
        const data = event.data;
        let cid = null;
        for (const [key, value] of Object.entries(this.connections)) {
            if (value.source === contentWindow) {
                cid = key;
                break;
            }
        }
        if (!cid) {
            console.error("Client id not found for the plugin: ", data);
            return;
        }
        const defaultService = this.workspaceManager.getDefaultService();
        const coreInterface = {};
        for (const key in defaultService) {
            const camelKey = toCamelCase(key);
            if (typeof defaultService[key] === "function") {
                coreInterface[camelKey] = async (...args) => {
                    // Create context with user information from the connection
                    const context = {
                        ws: this.connections[cid].workspace,
                        from: `${cid}`,
                        to: `${this.connections[cid].workspace}/${this.workspaceManagerId}`,
                        user: this.connections[cid].user || {
                            id: "anonymous",
                            is_anonymous: true,
                            email: "anonymous@amun.ai",
                            roles: [],
                            scopes: []
                        }
                    };
                    return await defaultService[key](...args, context);
                }
            }
            else {
                coreInterface[camelKey] = defaultService[key];
            }
        }
        const coreConnection = {
            peer_id: data.peer_id,
            fire(m) {
                if (coreConnection._messageHandler[m.type]) {
                    coreConnection._messageHandler[m.type](m);
                }
            },
            disconnect: function () { },
            emit: msg => {
                msg.peer_id = coreConnection.peer_id;
                Environment.safePostMessage(contentWindow, msg, "*");
            },
            on: function (event, handler) {
                coreConnection._messageHandler[event] = handler;
            },
            _messageHandler: {},
            async execute(code) {
                coreConnection.emit({ type: "execute", code: code });
            }
        };
        const pluginConfig = data.config;
        if (data.error) {
            console.error("Failed to initialize the plugin", data.error);
            return;
        }
        if (!data.peer_id) {
            throw "Please provide a peer_id for the connection.";
        }

        this.imjoyPluginWindows.set(event.source,
            {
                coreConnection,
                cid,
            }
        );
        console.log("plugin initialized:", pluginConfig);
        const core = new imjoyRPC.RPC(coreConnection, { name: "core"});
        core.setInterface(coreInterface);
        core.on("interfaceSetAsRemote", () => {
            core.on("remoteReady", async () => {
                const api = core.getRemote();
                api.id = `${cid}:default`;
                api.type = "imjoy";
                await this.workspaceManager.eventBus.emit("service_added", api);
            });
            core.requestRemote();
        });
        core.sendInterface();
    }

    _handleClientMessage(event) {
        if(event.data && event.data.type === "hyphaClientReady"){
            // For iframe windows: use event.source
            // For web workers: event.source is null, use event.currentTarget
            const sourceToMatch = event.source || event.currentTarget;
            let found = false;
            for(const key in this.connections){
                const conn = this.connections[key];
                
                if(conn.source === sourceToMatch){
                    console.log(`✅ [DEBUG] Found matching connection: ${key}`);
                    this.emit("connection_ready", conn);
                    found = true;
                    break;
                }
            }
            
            if (!found) {
                console.error("❌ [DEBUG] No matching connection found for hyphaClientReady message!");
            }
        }
        const workspace = event.data.workspace;
        if (!workspace) {
            if (event.data.type === "initialized") {
                this._handleImJoyPlugin(event).catch(error => {
                    console.error("Error handling ImJoy plugin:", error);
                });
            }
            else if (this.imjoyPluginWindows.has(event.source)) {
                const coreConnection = this.imjoyPluginWindows.get(event.source).coreConnection;
                coreConnection.fire(event.data);
            }
            return;
        }
        const clientId = event.data.from;
        if (!clientId || !this.connections[workspace + "/" + clientId]) {
            console.warn("Connection not found for client: ", clientId);
            return;
        }
        const connection = this.connections[workspace + "/" + clientId];
        const ws = connection.websocket;
        if (event.data.type === "message") {
            ws.send(event.data.data);
        }
        else if (event.data.type === "close") {
            ws.close();
        }
        else if (event.data.type === "connect") {
            const ws = new this.WebSocketClass(event.data.url);
            ws.onmessage = (evt) => {
                connection.postMessage({ type: "message", data: evt.data, to: clientId });
            }
            ws.onopen = () => {
                connection.postMessage({ type: "connected", to: clientId });
            }
            ws.onclose = () => {
                connection.postMessage({ type: "closed", to: clientId });
            }
            connection.websocket = ws;
        }
    }

    async start(config) {
        if (HyphaCore.servers[this.url]) {
            throw new Error(`Server already running at ${this.url}`);
        }
        else {
            // Pass hyphaCore to server constructor to enable HTTP service endpoints
            const serverOptions = { 
                mock: false,
                hyphaCore: this  // Enable HTTP service proxy functionality
            };
            
            this.server = new this.ServerClass(this.wsUrl, serverOptions);
            HyphaCore.servers[this.url] = this.server;
            this.messageHandler = this._handleClientMessage.bind(this);
            
            // Only add window event listener in browser environment
            if (Environment.isBrowser()) {
                Environment.safeAddEventListener(window, "message", this.messageHandler);
            } else {
                console.log(`Running in ${this.environment} environment - window message handling disabled`);
            }
            
      
        }
        
        this.server.on('connection', async websocket => {
            await this._handleWebsocketConnection(websocket);
        });
        
        config = config || {};
        config.server = this;
        config.WebSocketClass = this.WebSocketClass;
        assert(config.workspace === undefined, "workspace is not allowed to be set in the config");
        assert(config.client_id === undefined, "client_id is not allowed to be set in the config");
                
        this.workspaceManager = new Workspace(this);
        await this.workspaceManager.setup({
            client_id: this.workspaceManagerId,
            method_timeout: 60,
            default_service: this.defaultServices,
        })

        // Instead of creating a root API connection that causes circular dependency,
        // we'll create an API wrapper that directly accesses the workspace manager
        const api = this._createDirectAPIWrapper();

        // expose root api
        this.api = api;
        return api;
    }

    async _handleWebsocketConnection(websocket) {
        let authConfig = {};
        let userInfo;
        let workspace;
        let clientId;

        try {
            // Wait for first message with authentication information
            const authData = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Authentication timeout'));
                }, 30000); // 30 second timeout

                websocket.on('message', (data) => {
                    clearTimeout(timeout);
                    resolve(data);
                });
                
                websocket.on('error', (error) => {
                    clearTimeout(timeout);
                    reject(error);
                });
                
                websocket.on('close', () => {
                    clearTimeout(timeout);
                    reject(new Error('Connection closed during authentication'));
                });
            });

            try {
                authConfig = JSON.parse(authData);
            } catch (parseError) {
                await this._disconnectWebsocket(websocket, "Failed to decode authentication information", 1003);
                return;
            }

            // All clients must provide authentication information
            if (authConfig.workspace === undefined && authConfig.client_id === undefined && authConfig.token === undefined) {
                throw new Error("Authentication required: workspace, client_id, or token must be provided");
            }

            // Authenticate user
            const authResult = await this._authenticateUser(authConfig);
            userInfo = authResult.userInfo;
            workspace = authResult.workspace;
            clientId = authConfig.client_id;

            if (!workspace) {
                workspace = "workspace-" + randId();
            }

            if (!clientId) {
                clientId = "client-" + randId();
            }

            // Check permissions
            await this._checkClientPermissions(clientId, workspace, userInfo);

            // Establish communication
            await this._establishWebsocketCommunication(websocket, workspace, clientId, userInfo);
            
        } catch (error) {
            console.error("WebSocket connection failed:", error.message);
            await this._disconnectWebsocket(websocket, `Failed to establish connection: ${error.message}`, 1001);
        }
    }

    async _authenticateUser(authConfig) {
        let userInfo;
        let workspace = authConfig.workspace;

        if (authConfig.token) {
            try {
                // Try to verify JWT token
                const payload = await verifyJWT(authConfig.token, this.jwtSecret);
                
                userInfo = {
                    id: payload.sub || payload.user_id || "anonymous",
                    is_anonymous: !payload.email,
                    email: payload.email || "",
                    roles: payload.roles || [],
                    scopes: payload.scope ? payload.scope.split(' ') : [],
                    expires_at: payload.exp,
                };
                
                workspace = payload.workspace || authConfig.workspace || "default";
                
            } catch (jwtError) {
                // Try legacy JWT parsing (without verification for backward compatibility)
                try {
                    const info = parseJwt(authConfig.token);
                    const expiresAt = info["exp"];
                    userInfo = {
                        id: info["sub"],
                        is_anonymous: !info[AUTH0_NAMESPACE + "email"],
                        email: info[AUTH0_NAMESPACE + "email"],
                        roles: info[AUTH0_NAMESPACE + "roles"],
                        scopes: info["scope"],
                        expires_at: expiresAt,
                    };
                    workspace = info.workspace || authConfig.workspace || userInfo.id;
                } catch (parseError) {
                    throw new Error(`Token verification failed: ${jwtError.message}`);
                }
            }
        } else if (authConfig.reconnection_token) {
            // Handle reconnection token (simplified - in full implementation would verify against stored tokens)
            try {
                const payload = await verifyJWT(authConfig.reconnection_token, this.jwtSecret);
                userInfo = {
                    id: payload.sub || "anonymous",
                    is_anonymous: !payload.email,
                    email: payload.email || "",
                    roles: payload.roles || [],
                    scopes: payload.scope ? payload.scope.split(' ') : [],
                    expires_at: payload.exp,
                };
                workspace = payload.workspace || authConfig.workspace;
                
                // Verify client_id matches for reconnection
                if (payload.client_id && authConfig.client_id && payload.client_id !== authConfig.client_id) {
                    throw new Error("Client ID mismatch during reconnection");
                }
            } catch (error) {
                throw new Error(`Reconnection token verification failed: ${error.message}`);
            }
        } else {
            // Anonymous users get a generated user ID and workspace
            const anonymousUserId = "anonymous-" + randId();
            userInfo = { 
                id: anonymousUserId, 
                is_anonymous: true, 
                email: "anonymous@amun.ai",
                roles: [],
                scopes: []
            };
            
            // If no workspace specified, use user ID as workspace for isolation
            const requestedWorkspace = authConfig.workspace;
            if (!requestedWorkspace) {
                workspace = anonymousUserId; // Use user ID as workspace for isolation
            } else {
                // For security: anonymous clients can only access public workspaces or their own workspace
                if (requestedWorkspace !== "public" && requestedWorkspace !== anonymousUserId) {
                    throw new Error(`Anonymous client attempted to access protected workspace: ${requestedWorkspace}`);
                }
                workspace = requestedWorkspace;
            }
        }

        return { userInfo, workspace };
    }

    async _checkClientPermissions(clientId, workspace, userInfo) {
        // Basic permission check - in full implementation would be more comprehensive
        if (workspace === "public") {
            // Public workspaces are generally accessible
            return;
        }
        
        // For private workspaces, check if user has permission
        if (userInfo.is_anonymous && !workspace.startsWith("anonymous-")) {
            throw new Error(`Permission denied for workspace: ${workspace}`);
        }
    }

    async _establishWebsocketCommunication(websocket, workspace, clientId, userInfo) {
        const connectionKey = `${workspace}/${clientId}`;
        
        // Store websocket connection
        if (!this._websockets) {
            this._websockets = {};
        }
        this._websockets[connectionKey] = websocket;

        try {
            // Create RPC connection
            const conn = new RedisRPCConnection(this, workspace, clientId, userInfo, this.workspaceManagerId);
            
            // Set up message handling
            conn.on_message(data => {
                if (websocket.readyState === websocket.OPEN) {
                    websocket.send(data);
                }
            });

            // Generate reconnection token
            const reconnectionToken = await this._generateReconnectionToken(userInfo, workspace, clientId);
            
            // Send connection info
            const baseUrl = this.url.endsWith("/") ? this.url.slice(0, -1) : this.url;
            const connectionInfo = {
                "type": "connection_info",
                "hypha_version": "0.1.0",
                "public_base_url": baseUrl,
                "local_base_url": baseUrl,
                "manager_id": this.workspaceManagerId,
                "workspace": workspace,
                "client_id": clientId,
                "user": userInfo,
                "reconnection_token": reconnectionToken,
                "reconnection_token_life_time": 3600 // 1 hour
            };
            
            websocket.send(JSON.stringify(connectionInfo));

            // Handle incoming messages
            websocket.on('message', async (data) => {
                try {
                    if (typeof data === 'string') {
                        // Handle text messages (control messages)
                        if (data.length > 1000) {
                            console.warn(`Ignoring long text message: ${data.substring(0, 1000)}...`);
                            return;
                        }
                        
                        const message = JSON.parse(data);
                        
                        if (message.type === "ping") {
                            websocket.send(JSON.stringify({ type: "pong" }));
                        } else if (message.type === "refresh_token") {
                            const newReconnectionToken = await this._generateReconnectionToken(userInfo, workspace, clientId);
                            websocket.send(JSON.stringify({
                                type: "reconnection_token",
                                reconnection_token: newReconnectionToken
                            }));
                        } else {
                            console.info("Unknown message type:", message.type);
                        }
                    } else {
                        // Handle binary messages (RPC data)
                        await conn.emit_message(data);
                    }
                } catch (error) {
                    console.error("Error processing websocket message:", error);
                }
            });

            // Handle disconnection
            websocket.on('close', async () => {
                await this._handleWebsocketDisconnection(websocket, workspace, clientId, userInfo, conn);
            });

            websocket.on('error', async (error) => {
                console.error(`WebSocket error for ${connectionKey}:`, error);
                await this._handleWebsocketDisconnection(websocket, workspace, clientId, userInfo, conn);
            });

        } catch (error) {
            // Clean up on error
            if (this._websockets && this._websockets[connectionKey]) {
                delete this._websockets[connectionKey];
            }
            throw error;
        }
    }

    async _generateReconnectionToken(userInfo, workspace, clientId) {
        const payload = {
            sub: userInfo.id,
            workspace: workspace,
            client_id: clientId,
            email: userInfo.email,
            roles: userInfo.roles || [],
            scope: Array.isArray(userInfo.scopes) ? userInfo.scopes.join(' ') : "",
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
            iss: "hypha-core",
            aud: "hypha-reconnection"
        };
        
        return await generateJWT(payload, this.jwtSecret);
    }

    async _handleWebsocketDisconnection(websocket, workspace, clientId, userInfo, conn) {
        const connectionKey = `${workspace}/${clientId}`;
        
        try {
            if (conn) {
                await conn.disconnect("disconnected");
            }
            
            console.info(`Client disconnected: ${connectionKey}`);
        } catch (error) {
            console.error(`Error handling disconnection for ${connectionKey}:`, error);
        } finally {
            // Clean up websocket tracking
            if (this._websockets && this._websockets[connectionKey]) {
                delete this._websockets[connectionKey];
            }
        }
    }

    async _disconnectWebsocket(websocket, reason, code = 1000) {
        console.error("Disconnecting websocket, reason:", reason, "code:", code);
        
        try {
            // Send error message if connection is still open
            if (websocket.readyState === websocket.OPEN) {
                websocket.send(JSON.stringify({ type: "error", message: reason }));
            }
        } catch (error) {
            console.error("Error sending disconnect message:", error);
        }
        
        try {
            // Close the connection
            if (websocket.readyState === websocket.OPEN || websocket.readyState === websocket.CONNECTING) {
                websocket.close(code, reason);
            }
        } catch (error) {
            console.error("Error closing websocket:", error);
        }
    }

    getWebsockets() {
        return this._websockets || {};
    }

    async forceDisconnect(workspace, clientId, code, reason) {
        const connectionKey = `${workspace}/${clientId}`;
        const websocket = this._websockets && this._websockets[connectionKey];
        
        if (!websocket) {
            throw new Error(`Client not connected: ${connectionKey}`);
        }
        
        await this._disconnectWebsocket(websocket, reason, code);
    }

    async mountWorker(worker, config = {}) {
        if (!worker || typeof worker.postMessage !== 'function') {
            throw new Error('Invalid worker: must have postMessage method');
        }

        // Extract or generate connection details
        const workspace = config.workspace || "default";
        const clientId = config.client_id || "client-" + randId();
        const connectionKey = `${workspace}/${clientId}`;

        // Create user info
        const userInfo = config.user_info || {
            id: clientId,
            is_anonymous: true,
            email: "anonymous@amun.ai",
            roles: [],
            scopes: []
        };

        // Generate authentication token
        let authToken;
        try {
            const payload = {
                sub: userInfo.id,
                workspace: workspace,
                client_id: clientId,
                email: userInfo.email,
                roles: userInfo.roles,
                scope: Array.isArray(userInfo.scopes) ? userInfo.scopes.join(' ') : "",
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
                iss: "hypha-core",
                aud: "hypha-api"
            };
            authToken = await generateJWT(payload, this.jwtSecret);
        } catch (error) {
            console.warn("Failed to generate auth token for worker:", error);
        }

        // Create connection object
        this.connections[connectionKey] = {
            id: connectionKey,
            source: worker,
            workspace: workspace,
            user: userInfo,
            websocket: null,
            _rpcConnection: null,
            postMessage: (data) => {
                try {
                    worker.postMessage(data);
                } catch (error) {
                    console.error(`Error posting message to ${connectionKey}:`, error);
                }
            }
        };

        // Set up message handler for the worker
        const messageHandler = (event) => {
            // Create a synthetic event with currentTarget set to the worker
            // This allows _handleClientMessage to identify which worker sent the message
            const syntheticEvent = {
                data: event.data,
                source: null,
                currentTarget: worker,
                target: worker
            };
            this._handleClientMessage(syntheticEvent);
        };
        worker.addEventListener('message', messageHandler);

        // Create RPC connection
        const conn = new WebsocketRPCConnection(this, workspace, clientId, userInfo, this.workspaceManagerId);
        this.connections[connectionKey]._rpcConnection = conn;

        // Set up bidirectional message forwarding
        conn.on_message(data => {
            this.connections[connectionKey].postMessage({
                type: "message",
                data: data,
                to: clientId,
                workspace: workspace
            });
        });

        console.log(`✅ Registered worker connection: ${connectionKey}`);

        // Wait for worker to signal it's ready to receive messages (via hyphaClientReady)
        const timeout = config.timeout || 60000;
        try {
            await this._waitForConnection(connectionKey, timeout);
            console.log(`✅ Worker connection ready: ${connectionKey}`);
        } catch (error) {
            throw new Error(`Worker did not send hyphaClientReady within ${timeout}ms: ${error.message}`);
        }

        // Send initialization message to the worker
        const baseUrl = this.url.endsWith("/") ? this.url.slice(0, -1) : this.url;
        const initMessage = {
            type: "initializeHyphaClient",
            server_url: baseUrl,
            workspace: workspace,
            client_id: clientId,
            token: authToken || null,
            user_info: userInfo,
        };

        // If there's a config field, include it (for workers like Pyodide that expect it)
        if (config.config) {
            initMessage.config = config.config;
        }

        worker.postMessage(initMessage);

        // Wait for the worker's RPC client to connect and register a service
        try {
            const svc = await this.workspaceManager.waitForClient(connectionKey, timeout);
            console.log(`✅ Worker RPC client ready: ${connectionKey}`);
            return {
                workspace,
                client_id: clientId,
                connection: this.connections[connectionKey],
                service: svc
            };
        } catch (error) {
            throw new Error(`Worker RPC client did not become ready within ${timeout}ms: ${error.message}`);
        }
    }

    _waitForConnection(conn_id, timeout) {
        return new Promise((resolve, reject) => {
            const handler = (info) => {
                if (info.id === conn_id) {
                    this.off("connection_ready", handler);
                    clearTimeout(timeoutId);
                    resolve(info);
                }
            };
            const timeoutId = setTimeout(() => {
                this.off("connection_ready", handler);
                reject(new Error(`Timeout after ${timeout / 1000} s`));
            }, timeout);
            this.on("connection_ready", handler);
        });
    }

    async mountIframe(iframe, config = {}) {
        // Ensure we're in a browser environment
        Environment.requireBrowser('Iframe mounting');

        // Handle both iframe element and iframe.contentWindow
        let iframeElement = iframe;
        let iframeWindow;

        if (iframe && iframe.contentWindow) {
            // It's an iframe element
            iframeWindow = iframe.contentWindow;
        } else if (iframe && iframe.postMessage && iframe.parent) {
            // It's an iframe window (contentWindow)
            iframeWindow = iframe;
            // Try to find the iframe element (not always possible)
            iframeElement = null;
        } else {
            throw new Error('Invalid iframe: must be an iframe element or iframe.contentWindow');
        }

        // Extract or generate connection details
        const workspace = config.workspace || "default";
        const clientId = config.client_id || "client-" + randId();
        const connectionKey = `${workspace}/${clientId}`;

        // Create user info
        const userInfo = config.user_info || {
            id: clientId,
            is_anonymous: true,
            email: "anonymous@amun.ai",
            roles: [],
            scopes: []
        };

        // Generate authentication token
        let authToken;
        try {
            const payload = {
                sub: userInfo.id,
                workspace: workspace,
                client_id: clientId,
                email: userInfo.email,
                roles: userInfo.roles,
                scope: Array.isArray(userInfo.scopes) ? userInfo.scopes.join(' ') : "",
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
                iss: "hypha-core",
                aud: "hypha-api"
            };
            authToken = await generateJWT(payload, this.jwtSecret);
        } catch (error) {
            console.warn("Failed to generate auth token for iframe:", error);
        }

        // Create connection object
        this.connections[connectionKey] = {
            id: connectionKey,
            source: iframeWindow,
            workspace: workspace,
            user: userInfo,
            websocket: null,
            _rpcConnection: null,
            postMessage: (data) => {
                try {
                    Environment.safePostMessage(iframeWindow, data, "*");
                } catch (error) {
                    console.error(`Error posting message to ${connectionKey}:`, error);
                }
            }
        };

        // Set up message handler for the iframe
        // Note: iframe messages come through window message events, not directly from iframe
        // The existing window message handler in start() will handle these
        // We just need to make sure the connection is registered

        // Create RPC connection
        const conn = new WebsocketRPCConnection(this, workspace, clientId, userInfo, this.workspaceManagerId);
        this.connections[connectionKey]._rpcConnection = conn;

        // Set up bidirectional message forwarding
        conn.on_message(data => {
            this.connections[connectionKey].postMessage({
                type: "message",
                data: data,
                to: clientId,
                workspace: workspace
            });
        });

        console.log(`✅ Mounted iframe: ${connectionKey}`);

        // Send initialization message to the iframe
        const baseUrl = this.url.endsWith("/") ? this.url.slice(0, -1) : this.url;
        const initMessage = {
            type: "initializeHyphaClient",
            server_url: baseUrl,
            workspace: workspace,
            client_id: clientId,
            token: authToken || null,
            user_info: userInfo,
        };

        // Wait a bit for iframe to load if element is provided
        if (iframeElement && iframeElement.tagName === 'IFRAME') {
            await new Promise((resolve, reject) => {
                if (iframeElement.contentDocument && iframeElement.contentDocument.readyState === 'complete') {
                    resolve();
                } else {
                    iframeElement.onload = resolve;
                    iframeElement.onerror = reject;
                }
            });
        }

        this.connections[connectionKey].postMessage(initMessage);

        // Wait for the iframe to be ready (optional timeout)
        const timeout = config.timeout || 60000;
        try {
            await this.workspaceManager.waitForClient(connectionKey, timeout);
            console.log(`✅ Iframe ready: ${connectionKey}`);
        } catch (error) {
            console.warn(`Iframe did not become ready within ${timeout}ms:`, error);
        }

        return {
            workspace,
            client_id: clientId,
            connection: this.connections[connectionKey]
        };
    }

    async connect(config){
        config = config || {};
        config.server = this;
        config.WebSocketClass = this.WebSocketClass;
        
        // Don't set default workspace here - let the server-side logic handle it
        // config.workspace = config.workspace || "default";
        
        assert(config.client_id !== "root", "client_id cannot be 'root'");
        config.client_id = config.client_id || randId();
        const rawApi = await connectToServer(config);
        
        // Create camelCase wrapper for the API and add config exposure
        return this._createCamelCaseWrapper(rawApi, config);
    }

    _createCamelCaseWrapper(rawApi, connectionConfig = {}) {
        const wrappedApi = {};
        
        // Copy all properties and convert method names to camelCase
        for (const key in rawApi) {
            const camelKey = toCamelCase(key);
            if (typeof rawApi[key] === "function") {
                wrappedApi[camelKey] = rawApi[key].bind(rawApi);
            } else {
                wrappedApi[camelKey] = rawApi[key];
            }
        }
        
        // Expose server configuration information
        // Preserve existing config if it exists (for direct API), otherwise create from connection info
        if (rawApi.config) {
            // Use existing config from direct API wrapper
            wrappedApi.config = rawApi.config;
        } else {
            // Try to get connection info from rawApi if available (from hypha-rpc)
            const connectionInfo = rawApi._connection_info || rawApi.connection_info || {};
            
            wrappedApi.config = {
                // Connection info from server (if available)
                public_base_url: connectionInfo.public_base_url || this.url,
                workspace: connectionInfo.workspace || connectionConfig.workspace,
                client_id: connectionInfo.client_id || connectionConfig.client_id,
                
                // Additional useful config info
                local_base_url: connectionInfo.local_base_url || this.url,
                server_url: this.url,
                manager_id: connectionInfo.manager_id,
                user: connectionInfo.user,
                
                // Connection metadata
                hypha_version: connectionInfo.hypha_version,
                reconnection_token: connectionInfo.reconnection_token,
                reconnection_token_life_time: connectionInfo.reconnection_token_life_time
            };
        }
        
        return wrappedApi;
    }

    async reset() {
        this.close();
        await this.start();
    }

    close() {
        if (this.messageHandler) {
            // Only remove window event listener in browser environment
            if (Environment.isBrowser()) {
                Environment.safeRemoveEventListener(window, "message", this.messageHandler);
            }
        }
        
        if (this.server) {
            this.server.close();
            delete HyphaCore.servers[this.url];
        }
    }

    _createDirectAPIWrapper() {
        // Create API wrapper that directly accesses workspace manager without WebSocket connection
        const context = {
            ws: "default",
            from: "default/root", 
            user: {
                id: "root",
                is_anonymous: false,
                email: "root@localhost",
                roles: ["admin"],
                scopes: []
            }
        };

        const api = {
            // API properties that tests expect
            id: context.from.split('/')[1], // Extract client ID from "workspace/clientId"
            config: {
                public_base_url: this.url,
                workspace: context.ws,
                client_id: context.from.split('/')[1],
                local_base_url: this.url,
                server_url: this.url,
                manager_id: this.workspaceManagerId,
                user: context.user
            },
            
            // Workspace management functions
            registerService: async (service) => {
                return await this.workspaceManager.registerService(service, context);
            },
            
            unregisterService: async (serviceId) => {
                return await this.workspaceManager.unregisterService(serviceId, context);
            },
            
            listServices: async (query = {}) => {
                return await this.workspaceManager.listServices(query, context);
            },
            
            getService: async (serviceId, options = {}) => {
                return await this.workspaceManager.getService(serviceId, options, context);
            },
            
            close: () => {
                this.close();
            },

            // Event methods
            emit: async (type, data) => {
                await this.workspaceManager.eventBus.emit(type, data);
            },
            
            on: (event, handler) => {
                this.workspaceManager.eventBus.on(event, handler);
            },
            
            off: (event, handler) => {
                this.workspaceManager.eventBus.off(event, handler);
            },

            // Utility methods
            echo: (msg) => {
                return msg;
            },
            
            alert: (msg) => {
                alert(msg);
            },
            
            confirm: (msg) => {
                return confirm(msg);
            },
            
            prompt: (msg, default_value) => {
                return prompt(msg, default_value);
            },
            
            showProgress: (progress) => {
                console.log("showProgress", progress);
            },
            
            showMessage: (msg) => {
                console.log(msg);
            },
            
            log: (msg) => {
                console.log(msg);
            },
            
            info: (msg) => {
                console.info(msg);
            },
            
            error: (msg) => {
                console.error(msg);
            },
            
            warning: (msg) => {
                console.warn(msg);
            },
            
            critical: (msg) => {
                console.error(msg);
            },

            // Token generation
            generateToken: async (tokenConfig) => {
                if (!tokenConfig) {
                    tokenConfig = {};
                }
                
                const currentWorkspace = context.ws;
                const currentClientId = context.from?.split('/')[1];
                
                // Determine target workspace with access control
                let targetWorkspace = tokenConfig.workspace || currentWorkspace;
                
                // Only root client in default workspace can generate tokens for other workspaces
                if (targetWorkspace !== currentWorkspace) {
                    if (currentWorkspace !== "default" || currentClientId !== "root") {
                        throw new Error(`Access denied: Cannot generate token for workspace '${targetWorkspace}' from workspace '${currentWorkspace}' with client '${currentClientId}'. Only root client in default workspace can generate cross-workspace tokens.`);
                    }
                }
                
                // Build JWT payload
                const payload = {
                    sub: tokenConfig.user_id || context.user?.id || "anonymous",
                    workspace: targetWorkspace,
                    client_id: tokenConfig.client_id || context.from?.split('/')[1] || "anonymous-" + Date.now().toString(),
                    email: tokenConfig.email || context.user?.email || "",
                    roles: tokenConfig.roles || context.user?.roles || [],
                    scope: Array.isArray(tokenConfig.scopes) ? tokenConfig.scopes.join(' ') : (tokenConfig.scope || ""),
                    iat: Math.floor(Date.now() / 1000),
                    exp: tokenConfig.expires_in ? Math.floor(Date.now() / 1000) + tokenConfig.expires_in : Math.floor(Date.now() / 1000) + (24 * 60 * 60), // Default 24 hours
                    iss: "hypha-core",
                    aud: "hypha-api"
                };
                
                // Get JWT secret from server
                const jwtSecret = this.jwtSecret;
                if (!jwtSecret) {
                    throw new Error("JWT secret not configured on server");
                }
                
                // Generate and return JWT token using the function imported at the top of the file
                return await generateJWT(payload, jwtSecret);
            },

            // App and window management methods
            loadApp: async (config, extra_config) => {
                return await this.workspaceManager.loadApp(config, extra_config, context);
            },
            
            createWindow: async (config, extra_config) => {
                return await this.workspaceManager.createWindow(config, extra_config, context);
            },
            
            getWindow: async (config) => {
                return await this.workspaceManager.getWindow(config, context);
            },
            
            getApp: async (config, extra_config) => {
                return await this.workspaceManager.getApp(config, extra_config, context);
            }
        };

        // Add aliases for compatibility
        api.getPlugin = api.getApp;
        api.loadPlugin = api.loadApp;

        // Register the default service to ensure there are always services available
        this.workspaceManager.registerService({
            id: "default",
            name: "Default workspace management service",
            description: "Services for managing workspace.",
            config: {
                visibility: "public",
            },
            ...this.workspaceManager.getDefaultService()
        }, context).catch(err => {
            console.warn("Could not register default service:", err.message);
        });

        // Add camelCase versions
        return this._createCamelCaseWrapper(api);
    }
}

function parseJwt(token) {
    var base64Url = token.split('.')[1];
    var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    var jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
}

// Lazy export for imjoyRPC - only available in browser environments
let _imjoyRPC = null;
async function getImjoyRPC() {
    if (!Environment.isBrowser()) {
        throw new Error("imjoyRPC is only available in browser environments");
    }
    if (!_imjoyRPC) {
        const imjoyModule = await import('imjoy-rpc');
        _imjoyRPC = imjoyModule.imjoyRPC;
    }
    return _imjoyRPC;
}

export { HyphaCore, connectToServer, getImjoyRPC as imjoyRPC, hyphaWebsocketClient, WebSocket, Workspace, WebsocketRPCConnection };
