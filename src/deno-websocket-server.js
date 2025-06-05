/**
 * Deno WebSocket Server Wrapper
 * 
 * This module provides a wrapper around Deno's native HTTP server and WebSocket
 * to mimic the mock-socket Server API, allowing hypha-core to work with real
 * WebSocket connections in Deno.
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

export { DenoWebSocketServer, DenoWebSocketClient }; 