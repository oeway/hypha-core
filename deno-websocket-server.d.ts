/**
 * TypeScript definitions for Deno WebSocket Server functionality
 * 
 * These classes are designed to work in Deno runtime environments
 * and provide WebSocket server capabilities with clustering support.
 */

import { MessageEmitter } from './src/utils/index.js';

export interface RedisClusterOptions {
    heartbeatInterval?: number;
    cleanupInterval?: number;
    serverTTL?: number;
    host?: string;
    port?: number;
}

export interface ClusterMessage {
    type: 'message' | 'forward_message';
    channel?: string;
    message?: any;
    target_client?: string;
    from_server: string;
}

export interface ServerLoad {
    client_count: number;
}

export interface ClusterStatus {
    clustered: boolean;
    server_id: string;
    active_servers?: string[];
    local_clients: number;
    error?: string;
}

/**
 * Redis Cluster Manager for horizontal scalability
 */
export declare class RedisClusterManager {
    redis: any;
    serverId: string;
    options: RedisClusterOptions;
    heartbeatInterval: number;
    cleanupInterval: number;
    serverTTL: number;
    isActive: boolean;
    messageHandlers: Map<Function, Function>;

    constructor(redis: any, serverId: string, options?: RedisClusterOptions);
    
    start(): Promise<void>;
    stop(): Promise<void>;
    registerClient(clientId: string, workspace: string): Promise<void>;
    unregisterClient(clientId: string, workspace: string): Promise<void>;
    findClientServer(clientId: string, workspace: string): Promise<string | null>;
    getActiveServers(): Promise<string[]>;
    broadcastMessage(channel: string, message: any, excludeServer?: string): Promise<void>;
    forwardMessage(targetClientId: string, workspace: string, message: any): Promise<boolean>;
    onMessage(handler: (message: ClusterMessage) => void): Promise<void>;
    offMessage(handler: Function): Promise<void>;
}

/**
 * WebSocket wrapper that mimics mock-socket WebSocket API
 */
export declare class DenoWebSocketWrapper extends MessageEmitter {
    nativeWebSocket: WebSocket;
    request: Request;
    readyState: number;
    
    readonly CONNECTING: 0;
    readonly OPEN: 1;
    readonly CLOSING: 2;
    readonly CLOSED: 3;

    constructor(nativeWebSocket: WebSocket, request: Request);
    
    send(data: string | ArrayBuffer | Uint8Array): void;
    close(code?: number, reason?: string): void;
}

export interface HyphaServiceProxyOptions {
    hyphaCore: any;
}

export interface UserContext {
    ws: string;
    from: string;
    user: {
        id: string;
        is_anonymous?: boolean;
        email: string;
        roles: string[];
    };
}

export interface ServiceInfo {
    id: string;
    name: string;
    description: string;
    config: any;
    type: string;
    members?: Array<{
        name: string;
        type: string;
    }>;
}

/**
 * HTTP Service Proxy for hypha-core services
 */
export declare class HyphaServiceProxy {
    hyphaCore: any;

    constructor(hyphaCore: any);
    
    createUserContext(authToken?: string | null): UserContext;
    extractAuthToken(request: Request): string | null;
    getWorkspaceInterface(workspace: string, authToken: string | null): Promise<any>;
    extractCookies(request: Request): Record<string, string>;
    serialize(obj: any): any;
    extractQueryParams(url: string): Record<string, any>;
    extractRequestBody(request: Request): Promise<any>;
    createErrorResponse(status: number, message: string, detail?: string): Response;
    createSuccessResponse(data: any, status?: number): Response;
    handleOptions(request: Request): Response;
    getWorkspaceServices(workspace: string, request: Request, queryParams?: Record<string, any>): Promise<Response>;
    getServiceInfo(workspace: string, serviceId: string, request: Request, queryParams?: Record<string, any>): Promise<Response>;
    callServiceFunction(workspace: string, serviceId: string, functionKey: string, request: Request): Promise<Response>;
    handleAsgiApp(workspace: string, serviceId: string, path: string, request: Request): Promise<Response>;
    routeRequest(request: Request): Promise<Response>;
}

export interface DenoWebSocketServerOptions {
    hyphaCore?: any;
    ServerClass?: any;
    WebSocketClass?: any;
    clustered?: boolean;
    serverId?: string;
    redis?: any;
    clusterOptions?: RedisClusterOptions;
    host?: string;
    port?: number;
    base_url?: string;
    url?: string;
    jwtSecret?: string;
    default_service?: any;
}

/**
 * Server wrapper that mimics mock-socket Server API for Deno environments
 */
export declare class DenoWebSocketServer extends MessageEmitter {
    host: string;
    port: number;
    options: DenoWebSocketServerOptions;
    clients: Set<DenoWebSocketWrapper>;

    constructor(url: string, options?: DenoWebSocketServerOptions);
    
    close(): Promise<void>;
    getClients(): DenoWebSocketWrapper[];
    sendToClient(workspace: string, clientId: string, message: any): Promise<boolean>;
    broadcastToCluster(channel: string, message: any): Promise<void>;
    getClusterStatus(): Promise<ClusterStatus>;
}

/**
 * WebSocket client wrapper for connecting to the server
 */
export declare class DenoWebSocketClient {
    constructor(url: string);
}