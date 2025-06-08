/**
 * Deno WebSocket Server Wrapper
 * 
 * This module provides a wrapper around Deno's native HTTP server and WebSocket
 * to mimic the mock-socket Server API, allowing hypha-core to work with real
 * WebSocket connections in Deno. It also provides HTTP service proxy functionality
 * similar to the Python hypha server.
 */

import { MessageEmitter } from './utils/index.js';

/**
 * WebSocket wrapper that mimics mock-socket WebSocket API
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
        
        this._setupEventHandlers();
    }
    
    _setupEventHandlers() {
        // Forward native WebSocket events to our event emitter
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
            
            this._fire('message', data);
        };
        
        this.nativeWebSocket.onclose = (event) => {
            this.readyState = this.nativeWebSocket.readyState;
            // Don't log normal close events to reduce noise
            if (event.code !== 1000 && event.code !== 1001) {
                console.debug(`WebSocket closed with code ${event.code}: ${event.reason}`);
            }
            this._fire('close', event);
        };
        
        this.nativeWebSocket.onerror = (event) => {
            // Suppress "Unexpected EOF" errors as they're normal disconnection behavior
            if (event.error && event.error.message === 'Unexpected EOF') {
                // Don't fire the error event for normal disconnections
                return;
            }
            
            // Only log and fire events for significant errors
            console.error('WebSocket error:', event.error || event);
            this._fire('error', event);
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
    
    // Mock-socket compatible methods - use inherited methods from MessageEmitter
    // on(event, handler) is inherited
    // off(event, handler) is inherited
}

/**
 * HTTP Service Proxy for hypha-core services
 */
class HyphaServiceProxy {
    constructor(hyphaCore) {
        this.hyphaCore = hyphaCore;
    }

    /**
     * Create user context for requests
     */
    createUserContext(authToken = null) {
        if (authToken) {
            try {
                // Remove 'Bearer ' prefix if present
                const token = authToken.replace(/^Bearer\s+/, '');
                
                // Parse the token to get user info
                const userInfo = this.hyphaCore.parseToken(token);
                
                return {
                    ws: "default",
                    from: `default/http-client-${userInfo.id}`,
                    user: userInfo
                };
            } catch (error) {
                console.warn('Invalid auth token, using anonymous context:', error.message);
            }
        }
        
        // Return anonymous context
        return {
            ws: "default",
            from: "default/anonymous-http-client",
            user: {
                id: "anonymous",
                is_anonymous: true,
                email: "anonymous@localhost",
                roles: []
            }
        };
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
     * Get workspace interface by accessing workspace manager with proper context
     */
    async getWorkspaceInterface(workspace, authToken) {
        if (!this.hyphaCore || !this.hyphaCore.workspaceManager) {
            throw new Error('Workspace manager not available');
        }
        
        // Create proper context based on authentication
        const context = this.createUserContext(authToken);
        
        // Get default service functions
        const defaultService = this.hyphaCore.workspaceManager.getDefaultService();
        
        // Create a version where ALL default service functions have context bound consistently
        const boundDefaultService = {};
        
        // Bind context to all default service functions for consistency
        for (const [key, value] of Object.entries(defaultService)) {
            if (typeof value === 'function') {
                // we should ensure context is always the last argument
                // we should make sure the function takes at least one argument
                // Bind context to all function properties
                boundDefaultService[key] = (...args) => value(...args, context);
            } else {
                // Keep non-function properties as-is
                boundDefaultService[key] = value;
            }
        }
        
        return boundDefaultService;
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
        const urlObj = new URL(url, 'http://localhost');
        const params = {};
        for (const [key, value] of urlObj.searchParams.entries()) {
            // Normalize numbers similar to Python version
            if (/^\d+$/.test(value)) {
                params[key] = parseInt(value);
            } else if (/^\d+\.\d+$/.test(value)) {
                params[key] = parseFloat(value);
            } else {
                params[key] = value;
            }
        }
        return params;
    }

    /**
     * Extract request body based on content type
     */
    async extractRequestBody(request) {
        const contentType = request.headers.get('content-type') || 'application/json';
        
        if (request.method === 'GET') {
            return {};
        }
        
        if (request.method === 'POST') {
            const body = await request.text();
            if (!body) return {};
            
            if (contentType.includes('application/json')) {
                return JSON.parse(body);
            }
            // Note: MessagePack support would need additional library
            // For now, only support JSON
            throw new Error(`Unsupported content-type: ${contentType}`);
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
            
            // Get workspace interface with proper context
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
            
            // Get workspace interface with proper context
            const workspaceInterface = await this.getWorkspaceInterface(workspace, authToken);
            
            // Handle special case for 'ws' service
            if (serviceId === 'ws') {
                const serviceInfo = {
                    id: 'ws',
                    name: 'Workspace Service',
                    description: 'Default workspace management service',
                    config: { require_context: true, visibility: 'public' },
                    type: 'functions'
                };
                return this.createSuccessResponse(serviceInfo);
            }
            
            // Use getService to get the service info
            const mode = queryParams._mode || null;
            const service = await workspaceInterface.getService(serviceId, { mode });
            
            if (!service) {
                return this.createErrorResponse(404, `Service ${serviceId} not found`);
            }
            
            // Create service info object similar to what getServiceInfo would return
            const serviceInfo = {
                id: serviceId,
                name: service.name || serviceId,
                description: service.description || `Service ${serviceId}`,
                config: service.config || {},
                type: service.type || 'functions'
            };
            
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
            const context = this.createUserContext(authToken);
            
            // Get workspace interface with proper context
            const workspaceInterface = await this.getWorkspaceInterface(workspace, authToken);
            
            let service;
            if (serviceId === 'ws') {
                // For workspace service, use the workspace interface itself
                service = workspaceInterface;
            } else {
                const mode = queryParams._mode || null;
                service = await workspaceInterface.getService(serviceId, { mode });
                
                if (!service) {
                    return this.createErrorResponse(404, `Service ${serviceId} not found`);
                }
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
            
            // Call the function - context is already bound in getWorkspaceInterface
            let result;
            
            // For workspace service functions, we need to handle them differently
            // since they're already bound with context
            if (serviceId === 'ws') {
                // For workspace services, the functions are already bound with context
                // We need to call them with just the named parameters (not using parameter parsing)
                // since the bound function signature is (...args) => original(...args, context)
                
                // For now, handle common parameter patterns manually
                if (functionKey === 'echo' && functionKwargs.msg !== undefined) {
                    result = func(functionKwargs.msg);
                } else if (functionKey === 'log' && functionKwargs.msg !== undefined) {
                    result = func(functionKwargs.msg);
                } else if (functionKey === 'listServices') {
                    result = func(functionKwargs);
                } else if (functionKey === 'getService') {
                    result = func(functionKwargs.serviceId || functionKwargs.service_id, functionKwargs);
                } else {
                    // Fallback: call with all values as arguments
                    const args = Object.values(functionKwargs);
                    result = func(...args);
                }
            } else {
                // For regular services, try to extract parameter names from function signature
                const funcStr = func.toString();
                const paramMatch = funcStr.match(/\(([^)]*)\)/);
                
                if (paramMatch && paramMatch[1].trim()) {
                    // Extract parameter names
                    const params = paramMatch[1].split(',').map(p => p.trim().split('=')[0].trim());
                    
                    // Build argument array based on parameter names
                    const args = [];
                    for (const paramName of params) {
                        args.push(functionKwargs[paramName]);
                    }
                    
                    result = func(...args);
                } else {
                    // Function has no parameters
                    result = func();
                }
            }
            
            // Handle async functions
            if (result && typeof result.then === 'function') {
                result = await result;
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
            
            // Get workspace interface with proper context  
            const workspaceInterface = await this.getWorkspaceInterface(workspace, authToken);
            
            // Get service info to check if it's an ASGI service
            const mode = queryParams._mode || null;
            const service = await workspaceInterface.getService(serviceId, { mode });
            
            if (!service) {
                return this.createErrorResponse(404, `Service ${serviceId} not found`);
            }
            
            // Get service info to check the type
            const serviceInfo = {
                id: serviceId,
                name: service.name || serviceId,
                description: service.description || `Service ${serviceId}`,
                config: service.config || {},
                type: service.type || 'functions'
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
        // Fix hostname resolution - use 'localhost' instead of hostname for local binding
        this.host = wsUrl.hostname === 'local-hypha-server' ? 'localhost' : wsUrl.hostname;
        this.port = parseInt(wsUrl.port) || (wsUrl.protocol === 'wss:' ? 443 : 80);
        this.options = options;
        this.clients = new Set();
        this._server = null;
        this._abortController = null;
        this._hyphaCore = options.hyphaCore || null;
        this._serviceProxy = null;
        
        // Initialize service proxy if hypha-core is provided
        if (this._hyphaCore) {
            this._serviceProxy = new HyphaServiceProxy(this._hyphaCore);
        }
        
        this._startServer();
    }
    
    async _startServer() {
        this._abortController = new AbortController();
        
        try {
            // Create Deno HTTP server
            this._server = Deno.serve({
                hostname: this.host,
                port: this.port,
                signal: this._abortController.signal,
            }, (request) => this._handleRequest(request));
            
            console.log(`Deno WebSocket server listening on ${this.host}:${this.port}`);
        } catch (error) {
            console.error('Failed to start Deno WebSocket server:', error);
            throw error;
        }
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
            return new Response('OK', { status: 200 });
        }
        
        return new Response('Not Found', { status: 404 });
    }
    
    _handleWebSocketUpgrade(request) {
        try {
            const { socket, response } = Deno.upgradeWebSocket(request);
            
            // Create our wrapper WebSocket
            const wrappedSocket = new DenoWebSocketWrapper(socket, request);
            
            // Track the client
            this.clients.add(wrappedSocket);
            
            // Clean up when the connection closes or errors
            const cleanup = () => {
                this.clients.delete(wrappedSocket);
            };
            
            wrappedSocket.on('close', cleanup);
            wrappedSocket.on('error', cleanup);
            
            // Emit connection event (this is what hypha-core listens for)
            this._fire('connection', wrappedSocket);
            
            return response;
        } catch (error) {
            console.error('WebSocket upgrade failed:', error);
            return new Response('WebSocket upgrade failed', { status: 400 });
        }
    }
    
    // Mock-socket compatible methods - use inherited methods from MessageEmitter
    // on(event, handler) is inherited
    // off(event, handler) is inherited
    
    close() {
        console.log('Closing Deno WebSocket server...');
        
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

export { DenoWebSocketServer, DenoWebSocketClient, HyphaServiceProxy }; 