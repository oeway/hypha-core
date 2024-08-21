// index.d.ts

declare module 'hypha-core' {
    import { Server, WebSocket } from 'mock-socket';
    import { hyphaWebsocketClient } from 'hypha-rpc';
    import { imjoyRPC } from 'imjoy-rpc';

    // Utils
    export function randId(): string;
    export class MessageEmitter {
        on(event: string, listener: (...args: any[]) => void): this;
        emit(event: string, ...args: any[]): boolean;
    }

    export class WebsocketRPCConnection {
        constructor(server: HyphaServer, workspace: string, client_id: string, userInfo: any, manager_id: string);
        on_message(data: any): void;
        emit_message(data: any): void;
    }

    export class RedisRPCConnection {
        constructor(server: HyphaServer, workspace: string, client_id: string, userInfo: any, manager_id: string);
        on_message(data: any): void;
        emit_message(data: any): void;
    }

    // Workspace
    export class Workspace {
        constructor(server: HyphaServer);
        setup(config: { client_id: string; method_timeout: number; default_services: any }): Promise<void>;
        static tokens: { [token: string]: { workspace: Workspace } };
        getDefaultServices(): any;
        eventBus: {
            emit(event: string, data: any): void;
            off(event: string, handler: Function): void;
        };
    }

    // HyphaServer
    export class HyphaServer extends MessageEmitter {
        static servers: { [url: string]: Server };
        redis: any;
        port: number;
        baseUrl: string;
        url: string;
        wsUrl: string;
        server: Server | null;
        workspaceManagerId: string;
        connections: { [key: string]: any };
        defaultServices: { [key: string]: any };
        imjoyPluginWindows: Map<Window, { coreConnection: any, cid: string }>;

        constructor(config?: {
            port?: number;
            base_url?: string;
            url?: string;
            default_services?: { [key: string]: any };
        });

        start(): Promise<void>;
        reset(): Promise<void>;
        close(): void;
    }

    // Utils
    export function toCamelCase(str: string): string;

    // JWT Parsing
    export function parseJwt(token: string): any;

    // Exports
    export { hyphaWebsocketClient, imjoyRPC, WebSocket, Workspace, WebsocketRPCConnection };
}
