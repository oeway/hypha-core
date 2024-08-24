// index.d.ts

declare module "hypha-core" {
  import { Server, WebSocket } from "mock-socket";
  import { hyphaWebsocketClient, type ServerConfig } from "hypha-rpc";
  import { imjoyRPC } from "imjoy-rpc";

  export class Workspace {
    constructor(server: HyphaCore);

    setup(config: {
      client_id: string;
      method_timeout: number;
      default_service: any;
    }): Promise<void>;

    static tokens: { [token: string]: { workspace: Workspace } };

    getDefaultService(): any;

    eventBus: {
      emit(event: string, data: any): void;
      off(event: string, handler: Function): void;
    };
  }

  export let connectToServer: (config: ServerConfig) => Promise<HyphaAPI> =
    hyphaWebsocketClient.connectToServer;

  // Utils
  export function randId(): string;
  export class MessageEmitter {
    on(event: string, listener: (...args: any[]) => void): this;
    emit(event: string, ...args: any[]): boolean;
  }

  export class WebsocketRPCConnection {
    constructor(
      server: HyphaCore,
      workspace: string,
      client_id: string,
      userInfo: any,
      manager_id: string
    );
    on_message(data: any): void;
    emit_message(data: any): void;
  }

  export class RedisRPCConnection {
    constructor(
      server: HyphaCore,
      workspace: string,
      client_id: string,
      userInfo: any,
      manager_id: string
    );
    on_message(data: any): void;
    emit_message(data: any): void;
  }

  interface Plugin {
    id: string;
    name: string;
    description?: string;
    config?: any;
    run?: (params: { data?: any; config?: any }) => Promise<void>;
    setup?: () => Promise<void>;
  }

  interface HyphaAPI {
    loadApp: (params: { src: string }) => Promise<Plugin>;
    getApp: (
      config: { id?: string; name?: string },
      extraConfig?: any
    ) => Promise<Plugin | void>;
    createWindow: (
      config: WindowConfig,
      extraConfig?: any
    ) => Promise<Plugin | void>;
    registerService: (service: any) => Promise<ServiceConfig>;
    unregisterService: (serviceId: string) => Promise<void>;
    getService: (
      query: ServiceQuery,
      options?: { mode?: string; skipTimeout?: boolean; timeout?: number }
    ) => Promise<Plugin | null>;
    listServices: (query: ServiceQuery) => Promise<Plugin[]>;
  }

  interface WindowConfig {
    type: "iframe" | "window" | "web-worker" | "web-python";
    src: string;
    window_id?: string;
    width?: string;
    height?: string;
    passive?: boolean;
    name?: string;
  }

  interface ServiceConfig {
    id: string;
    name?: string;
    description?: string;
    app_id?: string;
    config?: {
      workspace: string;
      visibility: "public" | "protected";
      [key: string]: any;
    };
  }

  interface ServiceQuery {
    visibility?: string;
    workspace?: string;
    client_id?: string;
    service_id?: string;
    app_id?: string;
    id?: string;
  }

  interface EventBus {
    emit: (type: string, data: any) => Promise<void>;
    on: (event: string, handler: (...args: any[]) => void) => void;
    off: (event: string, handler: (...args: any[]) => void) => void;
  }

  // HyphaCore
  export class HyphaCore extends MessageEmitter {
    static servers: { [url: string]: Server };
    redis: any;
    port: number;
    baseUrl: string;
    WebSocketClass: any;
    url: string;
    wsUrl: string;
    server: Server | null;
    workspaceManagerId: string;
    connections: { [key: string]: any };
    defaultServices: { [key: string]: any };
    imjoyPluginWindows: Map<Window, { coreConnection: any; cid: string }>;

    constructor(config?: {
      port?: number;
      base_url?: string;
      url?: string;
      default_service?: { [key: string]: any };
    });
    api?: HyphaAPI;
    start(config?:ServerConfig ): Promise<HyphaAPI>;
    connect(config?: ServerConfig): Promise<HyphaAPI>;
    reset(): Promise<void>;
    close(): void;
  }

  // Utils
  export function toCamelCase(str: string): string;

  // JWT Parsing
  export function parseJwt(token: string): any;

  // Exports
  export { hyphaWebsocketClient, imjoyRPC, WebSocket };
}
