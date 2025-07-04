/**
 * Deno WebSocket Server Wrapper with HyphaCore Integration
 * 
 * This module provides a wrapper around Deno's native HTTP server and WebSocket
 * to mimic the mock-socket Server API, allowing hypha-core to work with real
 * WebSocket connections in Deno. It includes a built-in adapter that makes Deno's 
 * DOM-style WebSocket API compatible with HyphaCore's Node.js WebSocket expectations.
 * 
 * Key Features:
 * - WebSocket API compatibility layer for HyphaCore integration
 * - HTTP service proxy functionality similar to Python hypha server
 * - Redis clustering support for horizontal scalability
 * - ASGI and function service routing
 * 
 * WebSocket Compatibility Fix:
 * The DenoWebSocketWrapper class bridges the gap between Deno's DOM WebSocket API
 * and Node.js WebSocket API that HyphaCore expects, handling event emission patterns,
 * method signatures, and property access correctly.
 */

import { MessageEmitter } from './utils/index.js';

/**
 * Redis Cluster Manager for horizontal scalability
 */
class RedisClusterManager {
    constructor(redis, serverId, options = {}) {
        this.redis = redis;
        this.serverId = serverId;
        this.options = options;
        this.heartbeatInterval = options.heartbeatInterval || 30000; // 30 seconds
        this.cleanupInterval = options.cleanupInterval || 60000; // 60 seconds
        this.serverTTL = options.serverTTL || 90; // 90 seconds
        this.isActive = false;
        this._heartbeatTimer = null;
        this._cleanupTimer = null;
        this.messageHandlers = new Map();
    }

    async start() {
        if (this.isActive) return;
        
        this.isActive = true;
        console.log(`Starting Redis cluster manager for server: ${this.serverId}`);
        
        // Start heartbeat
        await this._heartbeat();
        this._heartbeatTimer = setInterval(() => this._heartbeat(), this.heartbeatInterval);
        
        // Start cleanup
        this._cleanupTimer = setInterval(() => this._cleanup(), this.cleanupInterval);
        
        // Subscribe to cluster messages
        await this._subscribeToClusterMessages();
    }

    async stop() {
        if (!this.isActive) return;
        
        this.isActive = false;
        console.log(`Stopping Redis cluster manager for server: ${this.serverId}`);
        
        // Clear timers
        if (this._heartbeatTimer) {
            clearInterval(this._heartbeatTimer);
            this._heartbeatTimer = null;
        }
        if (this._cleanupTimer) {
            clearInterval(this._cleanupTimer);
            this._cleanupTimer = null;
        }
        
        // Remove server from active list
        await this.redis.del(`cluster:servers:${this.serverId}`);
        await this.redis.srem('cluster:active_servers', this.serverId);
        
        // Unsubscribe from messages
        await this._unsubscribeFromClusterMessages();
    }

    async registerClient(clientId, workspace) {
        const key = `cluster:clients:${workspace}:${clientId}`;
        await this.redis.hset(key, 'server_id', this.serverId, 'connected_at', Date.now(), 'workspace', workspace);
        await this.redis.expire(key, this.serverTTL);
        await this.redis.sadd(`cluster:servers:${this.serverId}:clients`, `${workspace}:${clientId}`);
    }

    async unregisterClient(clientId, workspace) {
        const key = `cluster:clients:${workspace}:${clientId}`;
        await this.redis.del(key);
        await this.redis.srem(`cluster:servers:${this.serverId}:clients`, `${workspace}:${clientId}`);
    }

    async findClientServer(clientId, workspace) {
        const key = `cluster:clients:${workspace}:${clientId}`;
        const clientInfo = await this.redis.hgetall(key);
        return clientInfo?.server_id || null;
    }

    async getActiveServers() {
        return await this.redis.smembers('cluster:active_servers') || [];
    }

    async broadcastMessage(channel, message, excludeServer = null) {
        const servers = await this.getActiveServers();
        const targetServers = excludeServer ? 
            servers.filter(id => id !== excludeServer) : servers;
        
        const promises = targetServers.map(serverId => {
            return this.redis.publish(`cluster:${serverId}`, JSON.stringify({
                type: 'message',
                channel: channel,
                message: message,
                from_server: this.serverId
            }));
        });
        
        await Promise.all(promises);
    }

    async forwardMessage(targetClientId, workspace, message) {
        const targetServer = await this.findClientServer(targetClientId, workspace);
        if (!targetServer) {
            throw new Error(`Client ${workspace}/${targetClientId} not found in cluster`);
        }
        
        if (targetServer === this.serverId) {
            // Local delivery - handled by caller
            return false;
        }
        
        // Remote delivery via Redis
        await this.redis.publish(`cluster:${targetServer}`, JSON.stringify({
            type: 'forward_message',
            target_client: `${workspace}:${targetClientId}`,
            message: message,
            from_server: this.serverId
        }));
        
        return true;
    }

    async onMessage(handler) {
        const wrappedHandler = (channel, message) => {
            try {
                // Skip parsing if message is a simple Redis response like "OK"
                if (typeof message === 'string' && (message === 'OK' || message.match(/^\d+$/))) {
                    // These are Redis command responses, not cluster messages
                    return;
                }
                const parsedMessage = JSON.parse(message);
                handler(parsedMessage);
            } catch (error) {
                console.error('Error parsing cluster message:', error);
            }
        };
        
        this.messageHandlers.set(handler, wrappedHandler);
        
        // Subscribe to this server's channel
        await this.redis.subscribe(`cluster:${this.serverId}`, wrappedHandler);
    }

    async offMessage(handler) {
        const wrappedHandler = this.messageHandlers.get(handler);
        if (wrappedHandler) {
            await this.redis.unsubscribe(`cluster:${this.serverId}`, wrappedHandler);
            this.messageHandlers.delete(handler);
        }
    }

    async _heartbeat() {
        const load = await this._getServerLoad();
        
        await this.redis.hset(`cluster:servers:${this.serverId}`, 
            'last_seen', Date.now(),
            'host', this.options.host || 'localhost',
            'port', this.options.port || 8080,
            'load', JSON.stringify(load)
        );
        await this.redis.expire(`cluster:servers:${this.serverId}`, this.serverTTL);
        await this.redis.sadd('cluster:active_servers', this.serverId);
        await this.redis.expire('cluster:active_servers', this.serverTTL);
    }

    async _cleanup() {
        const now = Date.now();
        const cutoff = now - (this.serverTTL * 1000);
        
        // Clean up dead servers
        const servers = await this.redis.smembers('cluster:active_servers') || [];
        for (const serverId of servers) {
            const serverInfo = await this.redis.hgetall(`cluster:servers:${serverId}`);
            if (serverInfo?.last_seen && parseInt(serverInfo.last_seen) < cutoff) {
                console.log(`Cleaning up dead server: ${serverId}`);
                await this.redis.srem('cluster:active_servers', serverId);
                await this.redis.del(`cluster:servers:${serverId}`);
                
                // Clean up clients from dead server
                const clients = await this.redis.smembers(`cluster:servers:${serverId}:clients`) || [];
                for (const clientKey of clients) {
                    await this.redis.del(`cluster:clients:${clientKey}`);
                }
                await this.redis.del(`cluster:servers:${serverId}:clients`);
            }
        }
    }

    async _getServerLoad() {
        // Simple load metric - can be enhanced
        const clientCount = await this.redis.scard(`cluster:servers:${this.serverId}:clients`) || 0;
        return { client_count: clientCount };
    }

    async _subscribeToClusterMessages() {
        // Already handled in onMessage method
        console.log(`Cluster message subscription setup for: cluster:${this.serverId}`);
    }

    async _unsubscribeFromClusterMessages() {
        // Clean up all message handlers
        for (const [handler, wrappedHandler] of this.messageHandlers) {
            this.redis.off('message', wrappedHandler);
        }
        this.messageHandlers.clear();
        console.log(`Cluster message subscription cleaned up for: cluster:${this.serverId}`);
    }
}

/**
 * WebSocket wrapper that makes Deno WebSocket API compatible with HyphaCore's Node.js expectations
 */
class DenoWebSocketWrapper extends MessageEmitter {
    constructor(nativeWebSocket, request) {
        super();
        this.nativeWebSocket = nativeWebSocket;
        this.request = request;
        this.readyState = nativeWebSocket.readyState;
        
        // Constants to match WebSocket API
        this.CONNECTING = 0;
        this.OPEN = 1;
        this.CLOSING = 2;
        this.CLOSED = 3;
        
        // Additional Node.js WebSocket properties for HyphaCore compatibility
        this.url = nativeWebSocket.url;
        this.protocol = nativeWebSocket.protocol;
        this.extensions = nativeWebSocket.extensions;
        
        this._setupEventHandlers();
    }
    
    _setupEventHandlers() {
        // Forward native WebSocket events to our event emitter with Node.js-style signatures
        this.nativeWebSocket.onopen = (event) => {
            this.readyState = this.nativeWebSocket.readyState;
            this._fire('open', event);
        };
        
        this.nativeWebSocket.onmessage = (event) => {
            let data = event.data;
            
            // Convert ArrayBuffer to Uint8Array for binary messages (what hypha-core expects)
            if (data instanceof ArrayBuffer) {
                data = new Uint8Array(data);
            }
            
            // Debug logging for troubleshooting
            if (typeof data === 'string') {
                try {
                    const parsed = JSON.parse(data);
                    if (parsed.type === 'hello') {
                        console.debug('🔌 Received WebSocket hello message');
                    }
                } catch (e) {
                    // Not JSON, that's fine
                }
            }
            
            // HyphaCore expects Node.js-style message events with just the data
            this._fire('message', data);
        };
        
        this.nativeWebSocket.onclose = (event) => {
            this.readyState = this.nativeWebSocket.readyState;
            // Don't log normal close events to reduce noise
            if (event.code !== 1000 && event.code !== 1001) {
                console.debug(`WebSocket closed with code ${event.code}: ${event.reason}`);
            }
            // HyphaCore expects Node.js-style close events with code and reason
            this._fire('close', event.code, event.reason);
        };
        
        this.nativeWebSocket.onerror = (event) => {
            // Suppress "Unexpected EOF" errors as they're normal disconnection behavior
            if (event.error && event.error.message === 'Unexpected EOF') {
                // Don't fire the error event for normal disconnections
                return;
            }
            
            // Only log and fire events for significant errors
            console.error('WebSocket error:', event.error || event);
            this._fire('error', event.error || event);
        };
    }
    
    send(data) {
        try {
            if (this.nativeWebSocket.readyState === this.OPEN) {
                this.nativeWebSocket.send(data);
            } else {
                throw new Error(`WebSocket is not open (state: ${this.readyState})`);
            }
        } catch (error) {
            console.error('Failed to send WebSocket message:', error);
            throw error;
        }
    }
    
    close(code = 1000, reason = '') {
        try {
            if (this.readyState === this.OPEN || this.readyState === this.CONNECTING) {
                this.nativeWebSocket.close(code, reason);
            }
        } catch (error) {
            console.debug('Error during WebSocket close:', error);
        }
    }
    
    // Additional Node.js WebSocket compatibility methods
    ping(data) {
        // Deno WebSocket doesn't have native ping support
        // This is a no-op for compatibility
        console.debug('WebSocket ping requested (no-op in Deno)');
    }
    
    pong(data) {
        // Deno WebSocket doesn't have native pong support
        // This is a no-op for compatibility
        console.debug('WebSocket pong requested (no-op in Deno)');
    }
    
    terminate() {
        // Forceful close for Node.js compatibility
        this.close(1006, 'Connection terminated');
    }
    
    // Additional properties for compatibility
    get bufferedAmount() {
        return this.nativeWebSocket.bufferedAmount || 0;
    }
    
    get binaryType() {
        return this.nativeWebSocket.binaryType || 'arraybuffer';
    }
    
    set binaryType(value) {
        if (this.nativeWebSocket.binaryType !== undefined) {
            this.nativeWebSocket.binaryType = value;
        }
    }
    
    // Mock-socket and Node.js compatible methods - use inherited methods from MessageEmitter
    // on(event, handler) is inherited
    // off(event, handler) is inherited
    // emit(...args) is available as _fire(...args)
}

/**
 * HTTP Service Proxy for hypha-core services
 */
class HyphaServiceProxy {
    constructor(hyphaCore) {
        this.hyphaCore = hyphaCore;
    }

    /**
     * Create user context for requests with proper JWT token parsing
     * When no auth token is provided, creates anonymous workspace and user context
     */
    createUserContext(authToken = null, overrides = {}) {
        let userInfo = this.createAnonymousUser();
        let tokenPayload = null;
        
        if (authToken) {
            try {
                tokenPayload = this.parseJwtPayload(authToken);
                if (tokenPayload) {
                    userInfo = {
                        id: tokenPayload.sub || "anonymous",
                        email: tokenPayload.email || "",
                        roles: tokenPayload.roles || [],
                        scopes: tokenPayload.scope ? tokenPayload.scope.split(' ') : []
                    };
                }
            } catch (error) {
                console.warn('Invalid auth token, falling back to anonymous context:', error.message);
                tokenPayload = null; // Ensure it's null on error
            }
        }
        
        // Use optional chaining and null-safe defaults
        const workspace = overrides.workspace || tokenPayload?.workspace || "default";
        const clientId = overrides.client_id || tokenPayload?.client_id || this.generateAnonymousClientId();
        
        const context = {
            ws: workspace,
            from: `${workspace}/${clientId}`,
            to: overrides.to || `${workspace}/http-server`,
            user: userInfo
        };
        
        // Only add token payload if it exists and is valid
        if (tokenPayload) {
            context.token = tokenPayload;
        }
        
        // Log context creation for debugging
        if (authToken) {
            console.debug(`🔐 Authenticated HTTP request: user=${userInfo.id}, workspace=${workspace}, from=${context.from}, to=${context.to}`);
        } else {
            console.debug(`👻 Anonymous HTTP request: workspace=${workspace}, from=${context.from}, to=${context.to}`);
        }
        
        return context;
    }

    /**
     * Generate a unique client ID for anonymous HTTP requests
     */
    generateAnonymousClientId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 6);
        return `anonymous-http-${timestamp}-${random}`;
    }

    /**
     * Create anonymous user object with default properties
     */
    createAnonymousUser() {
        return {
            id: "anonymous",
            is_anonymous: true,
            email: "anonymous@localhost",
            roles: ["anonymous"], // Add anonymous role for access control
            scopes: ["read"], // Default read-only access for anonymous users
            permissions: {
                read: true,
                write: false,
                admin: false
            }
        };
    }

    /**
     * Parse JWT payload without verification (for extracting user context info)
     */
    parseJwtPayload(token) {
        try {
            // Remove 'Bearer ' prefix if present
            const cleanToken = token.replace(/^Bearer\s+/, '');
            
            // Split the JWT into parts
            const parts = cleanToken.split('.');
            if (parts.length !== 3) {
                throw new Error('Invalid JWT format');
            }
            
            // Decode the payload (second part)
            const payload = parts[1];
            const decoded = this.base64UrlDecode(payload);
            return JSON.parse(decoded);
        } catch (error) {
            throw new Error(`Failed to parse JWT payload: ${error.message}`);
        }
    }

    base64UrlDecode(base64Url) {
        // Convert base64url to base64
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        
        // Add padding if needed
        const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
        
        // Decode base64
        const decoded = atob(padded);
        
        // Convert to UTF-8
        return decodeURIComponent(decoded.split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
    }

    /**
     * Extract authorization token from request headers
     */
    extractAuthToken(request) {
        const authHeader = request.headers.get('authorization');
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader;
        }
        return null;
    }

    /**
     * Convert snake_case to camelCase
     */
    snakeToCamel(str) {
        return str.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
    }

    /**
     * Get workspace interface by accessing workspace manager with proper context
     * @param {string} workspace - Target workspace 
     * @param {string} authToken - Authorization token (optional)
     * @param {object} contextOverrides - Override context fields (optional)
     */
    async getWorkspaceInterface(workspace, authToken, contextOverrides = {}) {
        if (!this.hyphaCore || !this.hyphaCore.workspaceManager) {
            throw new Error('Workspace manager not available');
        }
        
        // Create proper context based on authentication and extracted token info
        const tokenOverrides = { ...contextOverrides };
        if (workspace) {
            tokenOverrides.workspace = workspace;
        }
        
        const context = this.createUserContext(authToken, tokenOverrides);
        
        // Get default service functions
        const defaultService = this.hyphaCore.workspaceManager.getDefaultService();
        
        // Check if the service requires context injection
        const requiresContext = defaultService.config && defaultService.config.require_context;
        
        if (requiresContext) {
            // Use the context injection logic similar to workspace.js
            return this.wrapServiceWithContext(defaultService, context);
        } else {
            // Just add camelCase versions without context injection
            return this.addCamelCaseVersions(defaultService);
        }
    }

    /**
     * Wrap service methods with context injection (similar to _wrapLocalServiceMethods in workspace.js)
     */
    wrapServiceWithContext(service, context) {
        const getContextForCall = () => context;
        
        // Recursively wrap function properties
        const wrapFunctions = (obj, path = '') => {
            const wrapped = {};
            
            for (const [key, value] of Object.entries(obj)) {
                if (['id', 'name', 'description', 'config', 'app_id'].includes(key)) {
                    // Skip metadata fields but add camelCase versions
                    wrapped[key] = value;
                    const camelKey = this.snakeToCamel(key);
                    if (camelKey !== key) {
                        wrapped[camelKey] = value;
                    }
                } else if (typeof value === 'function') {
                    // Wrap function to inject context
                    const wrappedFunction = (...args) => {
                        // Check if the last argument looks like a context object
                        const lastArg = args[args.length - 1];
                        const hasContext = lastArg && 
                            typeof lastArg === 'object' && 
                            !Array.isArray(lastArg) &&
                            ('ws' in lastArg || 'user' in lastArg || 'from' in lastArg || 'to' in lastArg);
                        
                        if (!hasContext) {
                            // Inject context as the last argument
                            args.push(getContextForCall());
                        } else {
                            // Merge with existing context, ensuring all required fields are set
                            const baseContext = getContextForCall();
                            const mergedContext = {
                                ...lastArg,  // Preserve existing context properties
                                ws: lastArg.ws || baseContext.ws,
                                user: lastArg.user || baseContext.user,
                                from: lastArg.from || baseContext.from,
                                to: lastArg.to || baseContext.to
                            };
                            args[args.length - 1] = mergedContext;
                        }
                        
                        return value.apply(obj, args);
                    };
                    
                    // Add both snake_case and camelCase versions
                    wrapped[key] = wrappedFunction;
                    const camelKey = this.snakeToCamel(key);
                    if (camelKey !== key) {
                        wrapped[camelKey] = wrappedFunction;
                    }
                } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    // Don't wrap _rintf objects as they're RPC proxies
                    if (value._rintf) {
                        wrapped[key] = value;
                        const camelKey = this.snakeToCamel(key);
                        if (camelKey !== key) {
                            wrapped[camelKey] = value;
                        }
                    } else {
                        // Recursively wrap nested objects
                        wrapped[key] = wrapFunctions(value, `${path}.${key}`);
                    }
                } else {
                    // Copy other values as-is and add camelCase versions
                    wrapped[key] = value;
                    const camelKey = this.snakeToCamel(key);
                    if (camelKey !== key) {
                        wrapped[camelKey] = value;
                    }
                }
            }
            
            return wrapped;
        };
        
        return wrapFunctions(service);
    }

    /**
     * Add camelCase versions of methods without context injection
     */
    addCamelCaseVersions(service) {
        const enhanced = {};
        
        for (const [key, value] of Object.entries(service)) {
            // Add original key
            enhanced[key] = value;
            
            // Add camelCase version if different from original
            const camelKey = this.snakeToCamel(key);
            if (camelKey !== key) {
                enhanced[camelKey] = value;
            }
        }
        
        return enhanced;
    }

    /**
     * Extract cookies from request headers
     */
    extractCookies(request) {
        const cookieHeader = request.headers.get('cookie');
        if (!cookieHeader) return {};
        
        const cookies = {};
        cookieHeader.split(';').forEach(cookie => {
            const [name, value] = cookie.trim().split('=');
            if (name && value) {
                cookies[name] = value;
            }
        });
        return cookies;
    }

    /**
     * Serialize objects for HTTP response, similar to Python version
     */
    serialize(obj) {
        if (obj === null || obj === undefined) {
            return null;
        }
        if (typeof obj === 'number' || typeof obj === 'string' || typeof obj === 'boolean') {
            return obj;
        }
        if (Array.isArray(obj)) {
            return obj.map(item => this.serialize(item));
        }
        if (typeof obj === 'object') {
            if (obj instanceof Date) {
                return obj.toISOString();
            }
            const serialized = {};
            for (const [key, value] of Object.entries(obj)) {
                serialized[key] = this.serialize(value);
            }
            return serialized;
        }
        if (typeof obj === 'function') {
            if (obj.__schema__) {
                return { type: 'function', function: obj.__schema__ };
            } else {
                return { type: 'function', function: { name: obj.name } };
            }
        }
        return obj;
    }

    /**
     * Extract query parameters and normalize values
     */
    extractQueryParams(url) {
        const urlObj = new URL(url);
        const params = {};
        
        for (const [key, value] of urlObj.searchParams) {
            // Try to parse JSON if the value looks like JSON
            if (this.looksLikeJson(value)) {
                try {
                    params[key] = JSON.parse(value);
                } catch (error) {
                    // If JSON parsing fails, keep as string
                    params[key] = value;
                }
            } else {
                // Try to convert to appropriate type
                params[key] = this.convertUrlParamType(value);
            }
        }
        
        return params;
    }

    looksLikeJson(str) {
        if (typeof str !== 'string') return false;
        const trimmed = str.trim();
        return (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
               (trimmed.startsWith('[') && trimmed.endsWith(']'));
    }

    convertUrlParamType(value) {
        // Convert URL parameter strings to appropriate types
        if (value === 'true') return true;
        if (value === 'false') return false;
        if (value === 'null') return null;
        if (value === 'undefined') return undefined;
        
        // Try to convert to number if it looks like a number
        if (/^-?\d+$/.test(value)) {
            return parseInt(value, 10);
        }
        if (/^-?\d+\.\d+$/.test(value)) {
            return parseFloat(value);
        }
        
        return value; // Keep as string
    }

    /**
     * Extract request body based on content type
     */
    async extractRequestBody(request) {
        const contentType = request.headers.get('content-type') || '';
        
        if (request.method === 'GET') {
            return {};
        }
        
        if (request.method === 'POST') {
            const body = await request.text();
            if (!body || body.trim() === '') return {};
            
            // Try to parse as JSON if content-type suggests JSON or if no content-type specified
            if (contentType.includes('application/json') || contentType === '') {
                try {
                    return JSON.parse(body);
                } catch (error) {
                    console.warn('Failed to parse POST body as JSON:', error.message, 'Body:', body);
                    // If JSON parsing fails, treat as empty object for function calls
                    return {};
                }
            }
            
            // Handle form-encoded data
            if (contentType.includes('application/x-www-form-urlencoded')) {
                const params = new URLSearchParams(body);
                const result = {};
                for (const [key, value] of params) {
                    result[key] = this.convertUrlParamType(value);
                }
                return result;
            }
            
            // For other content types, return empty object for now
            console.warn(`Unsupported content-type: ${contentType}, treating as empty request body`);
            return {};
        }
        
        throw new Error(`Unsupported request method: ${request.method}`);
    }

    /**
     * Create error response
     */
    createErrorResponse(status, message, detail = null) {
        return new Response(JSON.stringify({
            success: false,
            detail: detail || message
        }), {
            status,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    /**
     * Create success response
     */
    createSuccessResponse(data, status = 200) {
        return new Response(JSON.stringify(data), {
            status,
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                'Access-Control-Allow-Headers': 'Authorization,Content-Type',
            }
        });
    }

    /**
     * Create streaming response for async generators and regular generators
     */
    createStreamingResponse(generator) {
        const self = this; // Capture 'this' context
        
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    // Check if it's an async generator
                    if (typeof generator[Symbol.asyncIterator] === 'function') {
                        // Handle async generator
                        for await (const value of generator) {
                            // Serialize each yielded value
                            const serializedValue = self.serialize(value);
                            
                            // Convert to JSON and add newline for JSONL format
                            const chunk = JSON.stringify(serializedValue) + '\n';
                            
                            // Enqueue the chunk
                            controller.enqueue(new TextEncoder().encode(chunk));
                        }
                    } else {
                        // Handle regular generator
                        for (const value of generator) {
                            // Serialize each yielded value
                            const serializedValue = self.serialize(value);
                            
                            // Convert to JSON and add newline for JSONL format
                            const chunk = JSON.stringify(serializedValue) + '\n';
                            
                            // Enqueue the chunk
                            controller.enqueue(new TextEncoder().encode(chunk));
                        }
                    }
                    
                    // Close the stream when generator is exhausted
                    controller.close();
                } catch (error) {
                    // Handle errors in the generator
                    console.error('Error in streaming response:', error);
                    const errorChunk = JSON.stringify({
                        error: error.message,
                        type: 'error'
                    }) + '\n';
                    controller.enqueue(new TextEncoder().encode(errorChunk));
                    controller.close();
                }
            }
        });

        return new Response(stream, {
            status: 200,
            headers: {
                'Content-Type': 'application/x-ndjson', // JSONL format
                'Transfer-Encoding': 'chunked',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                'Access-Control-Allow-Headers': 'Authorization,Content-Type',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            }
        });
    }

    /**
     * Handle OPTIONS requests for CORS
     */
    handleOptions(request) {
        return new Response(null, {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
                'Access-Control-Allow-Headers': 'Authorization,Content-Type',
                'Access-Control-Max-Age': '86400',
            }
        });
    }

    /**
     * Get workspace services - GET /{workspace}/services
     */
    async getWorkspaceServices(workspace, request, queryParams = {}) {
        try {
            const authToken = this.extractAuthToken(request);
            
            // Get workspace interface with proper context for the specified workspace
            const workspaceInterface = await this.getWorkspaceInterface(workspace, authToken);
            const services = await workspaceInterface.listServices({});
            
            // Serialize and remove workspace prefix from service IDs
            const serializedServices = this.serialize(services);
            if (Array.isArray(serializedServices)) {
                serializedServices.forEach(service => {
                    if (service.id && service.id.includes('/')) {
                        service.id = service.id.split('/').pop();
                    }
                });
            }
            
            return this.createSuccessResponse(serializedServices);
        } catch (error) {
            console.error('Error getting workspace services:', error);
            return this.createErrorResponse(404, 'Failed to get workspace services', error.message);
        }
    }

    /**
     * Get service info - GET /{workspace}/services/{service_id}
     */
    async getServiceInfo(workspace, serviceId, request, queryParams = {}) {
        try {
            const authToken = this.extractAuthToken(request);
            
            // Get workspace interface with proper context for the specified workspace
            const workspaceInterface = await this.getWorkspaceInterface(workspace, authToken);
            
            // Handle special case for 'ws' service
            if (serviceId === 'ws') {
                const service = workspaceInterface;
                const serviceInfo = {
                    id: 'ws',
                    name: 'Workspace Service',
                    description: 'Default workspace management service',
                    config: { require_context: true, visibility: 'public' },
                    type: 'functions'  // Keep as 'functions' for workspace service since it's explicitly a function service
                };
                
                // Add member functions for workspace service
                const members = this.extractServiceMembers(service);
                if (members.length > 0) {
                    serviceInfo.members = members;
                }
                
                return this.createSuccessResponse(serviceInfo);
            }
            
            // Use getServiceAsUser to get the service info for regular services
            const mode = queryParams._mode || null;
            
            // Create user context for the service call
            const userContext = this.createUserContext(authToken, { workspace });
            
            // Use getServiceAsUser which handles context injection internally based on require_context
            const service = await this.hyphaCore.workspaceManager.getServiceAsUser(
                serviceId, 
                { mode },
                userContext
            );
            
            if (!service) {
                return this.createErrorResponse(404, `Service ${serviceId} not found`);
            }
            
            // Create service info object similar to what getServiceInfo would return
            const serviceInfo = {
                id: serviceId,
                name: service.name || serviceId,
                description: service.description || `Service ${serviceId}`,
                config: service.config || {},
                type: service.type || 'generic'
            };
            
            // Add member functions/methods information
            const members = this.extractServiceMembers(service);
            if (members.length > 0) {
                serviceInfo.members = members;
            }
            
            return this.createSuccessResponse(this.serialize(serviceInfo));
        } catch (error) {
            console.error('Error getting service info:', error);
            return this.createErrorResponse(404, 'Service not found', error.message);
        }
    }

    /**
     * Call service function - GET/POST /{workspace}/services/{service_id}/{function_key}
     */
    async callServiceFunction(workspace, serviceId, functionKey, request) {
        try {
            const queryParams = this.extractQueryParams(request.url);
            const requestBody = await this.extractRequestBody(request);
            
            // Merge query params and body for function arguments
            const functionKwargs = { ...queryParams, ...requestBody };
            
            // Remove control parameters
            delete functionKwargs.workspace;
            delete functionKwargs.service_id;
            delete functionKwargs.function_key;
            delete functionKwargs._mode;
            
            const authToken = this.extractAuthToken(request);
            
            // Get workspace interface with proper context for the specified workspace
            const workspaceInterface = await this.getWorkspaceInterface(workspace, authToken);
            
            let service;
            if (serviceId === 'ws') {
                // For workspace service, also use getServiceAsUser for consistency
                const userContext = this.createUserContext(authToken, { workspace });
                service = await this.hyphaCore.workspaceManager.getServiceAsUser(
                    'ws', 
                    { mode: queryParams._mode || null },
                    userContext
                );
            } else {
                const mode = queryParams._mode || null;
                
                // Create user context for the service call
                const userContext = this.createUserContext(authToken, { workspace });
                
                // Use getServiceAsUser which handles context injection internally based on require_context
                service = await this.hyphaCore.workspaceManager.getServiceAsUser(
                    serviceId, 
                    { mode },
                    userContext
                );
            }
            
            if (!service) {
                return this.createErrorResponse(404, `Service ${serviceId} not found`);
            }
            
            // Get the function by key (support dot notation for nested objects)
            const func = this.getNestedValue(service, functionKey);
            
            if (!func) {
                return this.createErrorResponse(404, `Function ${functionKey} not found`);
            }
            
            // If it's not a function, just return the value
            if (typeof func !== 'function') {
                return this.createSuccessResponse(this.serialize(func));
            }
            
            // Call the function - context is already handled by getServiceAsUser if needed
            let result;
            
            // Simplified parameter handling - since getServiceAsUser already handles context injection,
            // we just need to pass the HTTP parameters appropriately
            const paramCount = Object.keys(functionKwargs).length;
            
            if (paramCount === 0) {
                // No parameters provided
                result = func();
            } else if (paramCount === 1) {
                // Single parameter - pass the value directly
                const singleValue = Object.values(functionKwargs)[0];
                result = func(singleValue);
            } else {
                // Multiple parameters - pass as a single object
                // This works for most service functions that expect a params object
                result = func(functionKwargs);
            }
            
            // Check if result is an async generator first (before awaiting)
            if (result && typeof result[Symbol.asyncIterator] === 'function') {
                return this.createStreamingResponse(result);
            }
            
            // Check if result is a regular generator
            if (result && typeof result[Symbol.iterator] === 'function' && 
                typeof result.next === 'function' && typeof result.return === 'function') {
                return this.createStreamingResponse(result);
            }
            
            // Handle async functions
            if (result && typeof result.then === 'function') {
                result = await result;
                
                // Check again if the awaited result is an async generator
                if (result && typeof result[Symbol.asyncIterator] === 'function') {
                    return this.createStreamingResponse(result);
                }
                
                // Check if the awaited result is a regular generator
                if (result && typeof result[Symbol.iterator] === 'function' && 
                    typeof result.next === 'function' && typeof result.return === 'function') {
                    return this.createStreamingResponse(result);
                }
            }
            
            return this.createSuccessResponse(this.serialize(result));
            
        } catch (error) {
            console.error('Error calling service function:', error);
            return this.createErrorResponse(400, 'Function call failed', error.message);
        }
    }

    /**
     * Handle ASGI app routing - /{workspace}/apps/{service_id}/{path}
     */
    async handleAsgiApp(workspace, serviceId, path, request) {
        try {
            const queryParams = this.extractQueryParams(request.url);
            const authToken = this.extractAuthToken(request);
            const cookies = this.extractCookies(request);
            
            // Get workspace interface with proper context for the specified workspace  
            const workspaceInterface = await this.getWorkspaceInterface(workspace, authToken);
            
            // Get service info to check if it's an ASGI service
            const mode = queryParams._mode || null;
            let service;
            if (serviceId === 'ws') {
                // For workspace service, use the workspace interface itself
                service = workspaceInterface;
            } else {
                service = await workspaceInterface.getService(serviceId, { mode });
                
                if (!service) {
                    return this.createErrorResponse(404, `Service ${serviceId} not found`);
                }
                
                // Only wrap with context if the service explicitly requires it
                const requiresContext = service.config && service.config.require_context;
                if (requiresContext) {
                    const context = this.createUserContext(authToken, { workspace });
                    service = this.wrapServiceWithContext(service, context);
                }
            }
            
            if (!service) {
                return this.createErrorResponse(404, 'Not Found');
            }
            
            // Get service info to check the type
            const serviceInfo = {
                id: serviceId,
                name: service.name || serviceId,
                description: service.description || `Service ${serviceId}`,
                config: service.config || {},
                type: service.type || 'generic'
            };
            
            if (serviceInfo.type === 'asgi' || serviceInfo.type === 'ASGI') {
                return await this.handleAsgiService(service, path, request, workspace, serviceId);
            } else if (serviceInfo.type === 'functions') {
                return await this.handleFunctionService(service, path, request, workspace, serviceId);
            } else {
                return this.createErrorResponse(404, 'Not Found');
            }
            
        } catch (error) {
            console.error('Error in ASGI app handling:', error);
            return this.createErrorResponse(500, 'Internal Server Error', error.message);
        }
    }

    /**
     * Handle ASGI service by implementing the ASGI protocol with streaming support
     */
    async handleAsgiService(service, path, request, workspace, serviceId) {
        try {
            // Ensure path starts with /
            if (!path.startsWith('/')) {
                path = '/' + path;
            }
            
            // Create ASGI scope similar to Python implementation
            const url = new URL(request.url);
            const scope = {
                type: 'http',
                method: request.method,
                path: path,
                raw_path: new TextEncoder().encode(path),
                query_string: new TextEncoder().encode(url.search.slice(1) || ''),
                headers: this.convertHeadersToAsgiFormat(request.headers),
                server: ['localhost', 80], // Could be extracted from request
                client: ['127.0.0.1', 0], // Could be extracted from request
            };
            
            // Create receive callable for ASGI
            let bodyConsumed = false;
            const receive = async () => {
                if (!bodyConsumed) {
                    bodyConsumed = true;
                    const body = request.body ? new Uint8Array(await request.arrayBuffer()) : new Uint8Array();
                    return {
                        type: 'http.request',
                        body: body,
                        more_body: false
                    };
                } else {
                    // If body already consumed, return empty body
                    return {
                        type: 'http.request',
                        body: new Uint8Array(),
                        more_body: false
                    };
                }
            };
            
            // Create streaming response handling
            let responseStarted = false;
            let responseStatus = 200;
            let responseHeaders = [];
            let streamController = null;
            let isStreamingResponse = false;
            
            // Create ReadableStream for streaming response
            const stream = new ReadableStream({
                start(controller) {
                    streamController = controller;
                },
                cancel() {
                    // Handle stream cancellation
                    if (streamController) {
                        streamController = null;
                    }
                }
            });
            
            const send = async (message) => {
                if (message.type === 'http.response.start') {
                    responseStarted = true;
                    responseStatus = message.status;
                    responseHeaders = message.headers || [];
                } else if (message.type === 'http.response.body') {
                    const body = message.body || new Uint8Array();
                    const moreBody = message.more_body !== false; // Default to true if not specified
                    
                    if (streamController) {
                        if (body.length > 0) {
                            // Enqueue the chunk for streaming
                            streamController.enqueue(body);
                            isStreamingResponse = true;
                        }
                        
                        // If this is the last chunk, close the stream
                        if (!moreBody) {
                            streamController.close();
                        }
                    }
                }
            };
            
            // Start the ASGI application in the background
            const asgiPromise = (async () => {
                try {
                    if (service.serve && typeof service.serve === 'function') {
                        await service.serve({
                            scope: scope,
                            receive: receive,
                            send: send
                        });
                    } else {
                        throw new Error('ASGI service missing serve function');
                    }
                } catch (error) {
                    console.error('Error in ASGI service execution:', error);
                    if (streamController) {
                        // Send error response if stream hasn't started
                        if (!isStreamingResponse) {
                            streamController.enqueue(new TextEncoder().encode(JSON.stringify({
                                detail: 'Internal Server Error',
                                error: error.message
                            })));
                        }
                        streamController.close();
                    }
                }
            })();
            
            // Wait a short time to see if we get response headers
            // This ensures we can set the status and headers properly
            await new Promise(resolve => setTimeout(resolve, 10));
            
            // Convert ASGI headers to Response headers
            const responseHeadersMap = new Headers();
            
            // Add CORS headers
            responseHeadersMap.set('Access-Control-Allow-Origin', '*');
            responseHeadersMap.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
            responseHeadersMap.set('Access-Control-Allow-Headers', 'Authorization,Content-Type');
            responseHeadersMap.set('Access-Control-Expose-Headers', 'Content-Disposition');
            
            // Add response headers from ASGI
            for (const [key, value] of responseHeaders) {
                const keyStr = typeof key === 'string' ? key : new TextDecoder().decode(key);
                const valueStr = typeof value === 'string' ? value : new TextDecoder().decode(value);
                responseHeadersMap.set(keyStr, valueStr);
            }
            
            // Return streaming response
            return new Response(stream, {
                status: responseStatus,
                headers: responseHeadersMap
            });
            
        } catch (error) {
            console.error('Error in ASGI service:', error);
            return this.createErrorResponse(500, 'Internal Server Error', error.message);
        }
    }

    /**
     * Handle function service for app routing
     */
    async handleFunctionService(service, path, request, workspace, serviceId) {
        try {
            // Extract function name from path
            let funcName = path.split('/').filter(p => p).pop() || 'index';
            funcName = funcName.replace(/\/$/, ''); // Remove trailing slash
            
            if (funcName in service && typeof service[funcName] === 'function') {
                // Convert request to scope-like object for function services
                const url = new URL(request.url);
                const scope = {
                    type: 'http',
                    method: request.method,
                    path: path,
                    query_string: url.search.slice(1) || '',
                    headers: Object.fromEntries(request.headers.entries()),
                    body: request.body ? await request.arrayBuffer() : null,
                    client: ['127.0.0.1', 0],
                };
                
                const func = service[funcName];
                const result = await func(scope);
                
                // Handle the result similar to Python implementation
                const headers = new Headers(result.headers || {});
                
                // Add CORS headers
                const origin = scope.headers.origin;
                headers.set('Access-Control-Allow-Credentials', 'true');
                headers.set('Access-Control-Allow-Origin', origin || '*');
                headers.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
                headers.set('Access-Control-Allow-Headers', 'Authorization,Content-Type');
                headers.set('Access-Control-Expose-Headers', 'Content-Disposition');
                
                let body = result.body || '';
                const status = result.status || 200;
                
                if (typeof body === 'string') {
                    body = new TextEncoder().encode(body);
                }
                
                return new Response(body, {
                    status: status,
                    headers: headers
                });
                
            } else {
                return this.createErrorResponse(404, `Function not found: ${funcName}`);
            }
            
        } catch (error) {
            console.error('Error in function service:', error);
            return this.createErrorResponse(500, 'Internal Server Error', error.message);
        }
    }

    /**
     * Convert Headers object to ASGI format (array of [key, value] byte arrays)
     */
    convertHeadersToAsgiFormat(headers) {
        const asgiHeaders = [];
        for (const [key, value] of headers.entries()) {
            asgiHeaders.push([
                new TextEncoder().encode(key.toLowerCase()),
                new TextEncoder().encode(value)
            ]);
        }
        return asgiHeaders;
    }

    /**
     * Extract service members (functions and properties) for service info
     */
    extractServiceMembers(service) {
        const members = [];
        const skipKeys = ['id', 'name', 'description', 'config', 'type', '_rintf'];
        
        for (const [key, value] of Object.entries(service)) {
            if (skipKeys.includes(key)) {
                continue;
            }
            
            if (typeof value === 'function') {
                members.push({
                    name: key,
                    type: 'function'
                });
            } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                // Check for nested functions (like math.add, math.multiply)
                const nestedFunctions = this.extractNestedFunctions(value, key);
                members.push(...nestedFunctions);
                
                // Also add the object itself if it has properties
                if (Object.keys(value).length > 0 && !value._rintf) {
                    members.push({
                        name: key,
                        type: 'object'
                    });
                }
            } else if (value !== undefined && value !== null) {
                members.push({
                    name: key,
                    type: typeof value
                });
            }
        }
        
        return members;
    }
    
    /**
     * Extract nested functions from an object (for things like math.add)
     */
    extractNestedFunctions(obj, prefix = '') {
        const members = [];
        
        for (const [key, value] of Object.entries(obj)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            
            if (typeof value === 'function') {
                members.push({
                    name: fullKey,
                    type: 'function'
                });
            } else if (typeof value === 'object' && value !== null && !Array.isArray(value) && !value._rintf) {
                // Recursively check nested objects (but don't go too deep)
                if (prefix.split('.').length < 2) {
                    const nestedMembers = this.extractNestedFunctions(value, fullKey);
                    members.push(...nestedMembers);
                }
            }
        }
        
        return members;
    }

    /**
     * Get nested value from object using dot notation
     */
    getNestedValue(obj, path) {
        const keys = path.split('.');
        let current = obj;
        
        for (const key of keys) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            } else {
                return null;
            }
        }
        
        return current;
    }

    /**
     * Route HTTP requests to appropriate handlers
     */
    async routeRequest(request) {
        const url = new URL(request.url);
        const pathParts = url.pathname.split('/').filter(part => part);
        
        // Handle CORS preflight
        if (request.method === 'OPTIONS') {
            return this.handleOptions(request);
        }
        
        // Route pattern for apps: /{workspace}/apps/{service_id}/{path}
        if (pathParts.length >= 3 && pathParts[1] === 'apps') {
            const workspace = pathParts[0];
            const serviceId = pathParts[2];
            const path = '/' + pathParts.slice(3).join('/');
            
            return await this.handleAsgiApp(workspace, serviceId, path, request);
        }
        
        // Route pattern: /{workspace}/services/{service_id}/{function_key}
        if (pathParts.length >= 2 && pathParts[1] === 'services') {
            const workspace = pathParts[0];
            
            if (pathParts.length === 2) {
                // GET /{workspace}/services
                if (request.method === 'GET') {
                    const queryParams = this.extractQueryParams(request.url);
                    return await this.getWorkspaceServices(workspace, request, queryParams);
                }
            } else if (pathParts.length === 3) {
                // GET /{workspace}/services/{service_id}
                const serviceId = pathParts[2];
                if (request.method === 'GET') {
                    const queryParams = this.extractQueryParams(request.url);
                    return await this.getServiceInfo(workspace, serviceId, request, queryParams);
                }
            } else if (pathParts.length >= 4) {
                // GET/POST /{workspace}/services/{service_id}/{function_key}
                const serviceId = pathParts[2];
                const functionKey = pathParts.slice(3).join('.');  // Support nested function calls
                
                if (request.method === 'GET' || request.method === 'POST') {
                    return await this.callServiceFunction(workspace, serviceId, functionKey, request);
                }
            }
        }
        
        // Route not found
        return this.createErrorResponse(404, 'Route not found');
    }
}

/**
 * Server wrapper that mimics mock-socket Server API
 */
class DenoWebSocketServer extends MessageEmitter {
    constructor(url, options = {}) {
        super();
        
        // Parse the WebSocket URL to get host and port
        const wsUrl = new URL(url);
        this.host = wsUrl.hostname;
        this.port = parseInt(wsUrl.port) || (wsUrl.protocol === 'wss:' ? 443 : 80);
        this.options = options;
        this.clients = new Set();
        this._server = null;
        this._abortController = null;
        this._hyphaCore = options.hyphaCore || null;
        this._serviceProxy = null;
        
        // Clustering support
        this._clustered = options.clustered || false;
        this._clusterManager = null;
        this._serverId = options.serverId || `deno-ws-${this.host}-${this.port}-${Math.random().toString(36).substr(2, 9)}`;
        
        // Initialize service proxy if hypha-core is provided
        if (this._hyphaCore) {
            this._serviceProxy = new HyphaServiceProxy(this._hyphaCore);
        }
        
        // Initialize clustering if enabled
        const redisClient = options.redis || this._hyphaCore?.redis;
        if (this._clustered && redisClient) {
            this._clusterManager = new RedisClusterManager(
                redisClient, 
                this._serverId,
                {
                    host: this.host,
                    port: this.port,
                    ...options.clusterOptions
                }
            );
            // Note: _setupClusterHandlers is async, but constructor can't be async
            // So we set it up when the server starts
        }
        
        this._startServer();
    }
    
    async _startServer() {
        this._abortController = new AbortController();
        
        try {
            // Start cluster manager first if clustering is enabled
            if (this._clusterManager) {
                await this._setupClusterHandlers();
                await this._clusterManager.start();
                console.log(`Server ${this._serverId} joined cluster`);
            }
            
            // Create Deno HTTP server
            this._server = Deno.serve({
                hostname: this.host,
                port: this.port,
                signal: this._abortController.signal,
            }, (request) => this._handleRequest(request));
            
            console.log(`Deno WebSocket server listening on ${this.host}:${this.port}${this._clustered ? ' (clustered)' : ''}`);
        } catch (error) {
            console.error('Failed to start Deno WebSocket server:', error);
            throw error;
        }
    }
    
    async _setupClusterHandlers() {
        if (!this._clusterManager) return;
        
        // Handle cluster messages
        await this._clusterManager.onMessage((clusterMessage) => {
            this._handleClusterMessage(clusterMessage);
        });
    }
    
    async _handleClusterMessage(clusterMessage) {
        try {
            switch (clusterMessage.type) {
                case 'forward_message':
                    await this._handleForwardedMessage(clusterMessage);
                    break;
                case 'message':
                    await this._handleBroadcastMessage(clusterMessage);
                    break;
                default:
                    console.debug('Unknown cluster message type:', clusterMessage.type);
            }
        } catch (error) {
            console.error('Error handling cluster message:', error);
        }
    }
    
    async _handleForwardedMessage(clusterMessage) {
        const { target_client, message } = clusterMessage;
        const [workspace, clientId] = target_client.split(':');
        
        // Find local client
        const targetClient = this._findLocalClient(workspace, clientId);
        if (targetClient && targetClient.readyState === targetClient.OPEN) {
            targetClient.send(message);
        } else {
            console.warn(`Target client ${target_client} not found locally for forwarded message`);
        }
    }
    
    async _handleBroadcastMessage(clusterMessage) {
        const { channel, message } = clusterMessage;
        
        // Broadcast to all local clients (implementation depends on your needs)
        for (const client of this.clients) {
            if (client.readyState === client.OPEN) {
                try {
                    client.send(message);
                } catch (error) {
                    console.error('Error broadcasting to local client:', error);
                }
            }
        }
    }
    
    _findLocalClient(workspace, clientId) {
        // This would need to be enhanced based on how you track client metadata
        // For now, this is a placeholder
        for (const client of this.clients) {
            if (client._workspace === workspace && client._clientId === clientId) {
                return client;
            }
        }
        return null;
    }
    
    async _handleRequest(request) {
        const url = new URL(request.url);
        
        // Check if this is a WebSocket upgrade request
        if (request.headers.get('upgrade') === 'websocket') {
            return this._handleWebSocketUpgrade(request);
        }
        
        // Handle service proxy requests if hypha-core is available
        if (this._serviceProxy) {
            // Check if this is a service-related request or app request
            const pathParts = url.pathname.split('/').filter(part => part);
            if ((pathParts.length >= 2 && pathParts[1] === 'services') || 
                (pathParts.length >= 3 && pathParts[1] === 'apps')) {
                return await this._serviceProxy.routeRequest(request);
            }
        }
        
        // Handle regular HTTP requests (could serve static files, health checks, etc.)
        if (url.pathname === '/health') {
            return new Response(JSON.stringify({ status: 'OK', timestamp: new Date().toISOString() }), { 
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        return new Response('Not Found', { status: 404 });
    }
    
    _handleWebSocketUpgrade(request) {
        try {
            const { socket, response } = Deno.upgradeWebSocket(request);
            
            // Create our wrapper WebSocket with HyphaCore compatibility
            const wrappedSocket = new DenoWebSocketWrapper(socket, request);
            
            // Track the client
            this.clients.add(wrappedSocket);
            
            // Enhanced cleanup for clustering
            const cleanup = async () => {
                this.clients.delete(wrappedSocket);
                
                // Unregister from cluster if clustering is enabled
                if (this._clusterManager && wrappedSocket._workspace && wrappedSocket._clientId) {
                    try {
                        await this._clusterManager.unregisterClient(wrappedSocket._clientId, wrappedSocket._workspace);
                    } catch (error) {
                        console.error('Error unregistering client from cluster:', error);
                    }
                }
            };
            
            wrappedSocket.on('close', cleanup);
            wrappedSocket.on('error', cleanup);
            
            // Add cluster registration hook for when client identity is established
            if (this._clusterManager) {
                wrappedSocket._registerWithCluster = async (workspace, clientId) => {
                    wrappedSocket._workspace = workspace;
                    wrappedSocket._clientId = clientId;
                    try {
                        await this._clusterManager.registerClient(clientId, workspace);
                        console.debug(`Client ${workspace}/${clientId} registered with cluster on server ${this._serverId}`);
                    } catch (error) {
                        console.error('Error registering client with cluster:', error);
                    }
                };
            }
            
            // Integrate with HyphaCore's WebSocket handler if available
            if (this._hyphaCore && this._hyphaCore._handleWebsocketConnection) {
                console.debug('🔗 Using HyphaCore WebSocket handler with Deno adapter');
                try {
                    // Extract connection info for HyphaCore
                    const url = new URL(request.url);
                    const connectionInfo = {
                        origin: request.headers.get('origin'),
                        secure: url.protocol === 'wss:',
                        req: {
                            url: request.url,
                            headers: Object.fromEntries(request.headers.entries()),
                        }
                    };
                    
                    // Use HyphaCore's WebSocket handler
                    this._hyphaCore._handleWebsocketConnection(wrappedSocket, connectionInfo);
                    console.debug('✅ HyphaCore WebSocket handler integrated successfully');
                } catch (error) {
                    console.error('❌ HyphaCore WebSocket integration error:', error.message);
                    // Fallback to default behavior
                    this._fire('connection', wrappedSocket);
                }
            } else {
                // Emit connection event (fallback for non-HyphaCore usage)
                this._fire('connection', wrappedSocket);
            }
            
            return response;
        } catch (error) {
            console.error('WebSocket upgrade failed:', error);
            return new Response('WebSocket upgrade failed', { status: 400 });
        }
    }
    
    // Mock-socket compatible methods - use inherited methods from MessageEmitter
    // on(event, handler) is inherited
    // off(event, handler) is inherited
    
    async close() {
        console.log('Closing Deno WebSocket server...');
        
        // Stop cluster manager first
        if (this._clusterManager) {
            await this._clusterManager.stop();
            console.log(`Server ${this._serverId} left cluster`);
        }
        
        // Close all client connections gracefully
        for (const client of this.clients) {
            try {
                client.close(1001, 'Server shutting down');
            } catch (error) {
                console.debug('Error closing client connection:', error);
            }
        }
        this.clients.clear();
        
        // Stop the HTTP server
        if (this._abortController) {
            this._abortController.abort();
        }
        
        console.log('Deno WebSocket server closed');
    }
    
    // Get information about connected clients
    getClients() {
        return Array.from(this.clients);
    }
    
    // Clustering methods
    
    /**
     * Send message to a specific client across the cluster
     */
    async sendToClient(workspace, clientId, message) {
        if (!this._clustered || !this._clusterManager) {
            // Non-clustered mode - only handle local clients
            const localClient = this._findLocalClient(workspace, clientId);
            if (localClient && localClient.readyState === localClient.OPEN) {
                localClient.send(message);
                return true;
            }
            return false;
        }
        
        // Clustered mode - try cluster forwarding
        try {
            const wasRemote = await this._clusterManager.forwardMessage(clientId, workspace, message);
            if (!wasRemote) {
                // Local delivery
                const localClient = this._findLocalClient(workspace, clientId);
                if (localClient && localClient.readyState === localClient.OPEN) {
                    localClient.send(message);
                    return true;
                }
            }
            return wasRemote;
        } catch (error) {
            console.error(`Failed to send message to client ${workspace}/${clientId}:`, error);
            return false;
        }
    }
    
    /**
     * Broadcast message to all clients across the cluster
     */
    async broadcastToCluster(channel, message) {
        if (!this._clustered || !this._clusterManager) {
            // Non-clustered mode - only broadcast locally
            for (const client of this.clients) {
                if (client.readyState === client.OPEN) {
                    try {
                        client.send(message);
                    } catch (error) {
                        console.error('Error broadcasting to local client:', error);
                    }
                }
            }
            return;
        }
        
        // Clustered mode - broadcast to cluster
        try {
            await this._clusterManager.broadcastMessage(channel, message);
        } catch (error) {
            console.error('Failed to broadcast to cluster:', error);
        }
    }
    
    /**
     * Get cluster status and information
     */
    async getClusterStatus() {
        if (!this._clustered || !this._clusterManager) {
            return {
                clustered: false,
                server_id: this._serverId,
                local_clients: this.clients.size
            };
        }
        
        try {
            const activeServers = await this._clusterManager.getActiveServers();
            return {
                clustered: true,
                server_id: this._serverId,
                active_servers: activeServers,
                local_clients: this.clients.size
            };
        } catch (error) {
            console.error('Error getting cluster status:', error);
            return {
                clustered: true,
                server_id: this._serverId,
                error: error.message,
                local_clients: this.clients.size
            };
        }
    }
    
    /**
     * Create a test WebSocket connection for debugging HyphaCore integration
     */
    async testWebSocketIntegration(workspace = 'public') {
        const url = `ws://${this.host}:${this.port}/ws`;
        console.log(`🧪 Testing WebSocket integration at ${url}`);
        
        return new Promise((resolve, reject) => {
            const ws = new WebSocket(url);
            let messageReceived = false;
            
            const timeout = setTimeout(() => {
                if (!messageReceived) {
                    ws.close();
                    reject(new Error('WebSocket integration test timeout - no response received'));
                }
            }, 5000);
            
            ws.onopen = () => {
                console.log('✅ WebSocket test connection opened');
                const helloMsg = {
                    type: 'hello',
                    client_id: 'integration-test',
                    workspace: workspace
                };
                console.log('📤 Sending test hello message:', JSON.stringify(helloMsg));
                ws.send(JSON.stringify(helloMsg));
            };
            
            ws.onmessage = (event) => {
                messageReceived = true;
                clearTimeout(timeout);
                console.log('📥 Received test response:', event.data);
                
                try {
                    const data = JSON.parse(event.data);
                    console.log('✅ WebSocket integration test successful!');
                    ws.close();
                    resolve(data);
                } catch (e) {
                    console.log('📥 Non-JSON response received');
                    ws.close();
                    resolve({ data: event.data });
                }
            };
            
            ws.onerror = (error) => {
                clearTimeout(timeout);
                console.error('❌ WebSocket test error:', error);
                ws.close();
                reject(error);
            };
            
            ws.onclose = (event) => {
                clearTimeout(timeout);
                if (!messageReceived) {
                    console.log('❌ WebSocket test closed without receiving response');
                }
            };
        });
    }
}

/**
 * WebSocket client wrapper for connecting to the server
 */
class DenoWebSocketClient {
    constructor(url) {
        const nativeWebSocket = new WebSocket(url);
        return new DenoWebSocketWrapper(nativeWebSocket);
    }
}

export { DenoWebSocketServer, DenoWebSocketClient, DenoWebSocketWrapper, HyphaServiceProxy, RedisClusterManager }; 