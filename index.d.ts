// index.d.ts - HyphaCore TypeScript Definitions for Deno/Node.js/Browser

// Environment Detection Types
export interface Environment {
  isBrowser(): boolean;
  isDeno(): boolean;
  isNode(): boolean;
  isServer(): boolean;
  getEnvironment(): string;
  getSafeBaseUrl(): string;
  requireBrowser(feature: string): void;
  safePostMessage(target: any, message: any, origin?: string): void;
  safeAddEventListener(target: any, event: string, handler: Function): void;
  safeRemoveEventListener(target: any, event: string, handler: Function): void;
}

export const Environment: Environment;

// JWT Token Types
export interface JWTPayload {
  sub: string;
  workspace: string;
  client_id?: string;
  email?: string;
  roles?: string[];
  scope?: string;
  scopes?: string[];
  iat: number;
  exp: number;
  iss: string;
  aud: string;
  user_id?: string;
  expires_in?: number;
}

export interface TokenConfig {
  user_id?: string;
  workspace?: string;
  client_id?: string;
  email?: string;
  roles?: string[];
  scopes?: string[];
  scope?: string;
  expires_in?: number;
}

// User Information Types
export interface UserInfo {
  id: string;
  is_anonymous: boolean;
  email: string;
  roles: string[];
  scopes: string[];
  expires_at?: number;
}

// Service Types
export interface ServiceConfig {
  id: string;
  name?: string;
  description?: string;
  app_id?: string;
  config?: {
    workspace?: string;
    visibility?: "public" | "protected";
    require_context?: boolean;
    [key: string]: any;
  };
  overwrite?: boolean;
  [methodName: string]: any; // For service methods
}

export interface ServiceQuery {
  id?: string;
  visibility?: string;
  workspace?: string;
  client_id?: string;
  service_id?: string;
  app_id?: string;
  type?: string;
}

export interface ServiceOptions {
  mode?: "default" | "random";
  skipTimeout?: boolean;
  timeout?: number;
}

// Window and App Configuration Types
export interface WindowConfig {
  type: "iframe" | "window" | "web-worker" | "web-python";
  src: string;
  window_id?: string;
  width?: string;
  height?: string;
  passive?: boolean;
  name?: string;
  data?: any;
  config?: any;
}

export interface Plugin {
  id: string;
  name: string;
  description?: string;
  type?: string;
  config?: any;
  run?: (params: { data?: any; config?: any }) => Promise<void>;
  setup?: () => Promise<void>;
  [key: string]: any;
}

// HyphaCore API Interface
export interface HyphaAPI {
  // Core service methods
  registerService(service: ServiceConfig): Promise<ServiceConfig>;
  unregisterService(serviceId: string): Promise<void>;
  getService(query: string | ServiceQuery, options?: ServiceOptions): Promise<Plugin | null>;
  listServices(query?: string | ServiceQuery): Promise<Plugin[]>;
  
  // JWT Authentication
  generateToken(tokenConfig?: TokenConfig): Promise<string>;
  
  // App and Window Management (Browser only)
  loadApp?(config: { src: string } | WindowConfig, extraConfig?: any): Promise<Plugin>;
  getApp?(config: { id?: string; name?: string } | string, extraConfig?: any): Promise<Plugin | void>;
  createWindow?(config: WindowConfig, extraConfig?: any): Promise<Plugin | void>;
  
  // Event system
  emit?(event: string, data: any): Promise<void>;
  on?(event: string, handler: (...args: any[]) => void): void;
  off?(event: string, handler: (...args: any[]) => void): void;
  
  // Core info
  id: string;
  name: string;
  description: string;
  config: any;
  type?: string;
  
  // Utility methods
  echo?(message: any): any;
  log?(message: any): void;
  info?(message: any): void;
  error?(message: any): void;
  warning?(message: any): void;
  
  // Connection management
  disconnect?(): Promise<void>;
  
  // Additional properties
  [key: string]: any;
}

// Server Configuration Types
export interface ServerConfig {
  server?: HyphaCore;
  WebSocketClass?: any;
  workspace?: string;
  client_id?: string;
  token?: string;
  user_info?: UserInfo;
  timeout?: number;
  silent?: boolean;
  [key: string]: any;
}

// HyphaCore Configuration
export interface HyphaCoreConfig {
  port?: number;
  base_url?: string;
  url?: string;
  jwtSecret?: string;
  default_service?: { [key: string]: any };
  ServerClass?: any;
  WebSocketClass?: any;
}

// Event Bus Interface
export interface EventBus {
  emit(event: string, data: any): Promise<void>;
  on(event: string, handler: (...args: any[]) => void): void;
  off(event: string, handler: (...args: any[]) => void): void;
}

// Connection Types
export interface Connection {
  id: string;
  workspace: string;
  websocket: any;
  source?: any;
  postMessage(data: any): void;
}

// Workspace Class
export class Workspace {
  constructor(server: HyphaCore);

  setup(config: {
    client_id: string;
    method_timeout: number;
    default_service: any;
  }): Promise<void>;

  static workspaces: { [workspace: string]: Workspace };
  static clients: { [clientId: string]: any };

  getDefaultService(): any;
  registerService(service: ServiceConfig, context: any): Promise<void>;
  unregisterService(serviceId: string, context: any): Promise<void>;
  getService(query: string | ServiceQuery, options: ServiceOptions, context: any): Promise<Plugin | null>;
  listServices(query: string | ServiceQuery, context: any): Promise<Plugin[]>;
  
  // Browser-only methods
  createWindow?(config: WindowConfig, extraConfig: any, context: any): Promise<Plugin>;
  loadApp?(config: WindowConfig, extraConfig: any, context: any): Promise<Plugin>;
  createWorker?(config: any, workspace: string, workerUrl: string): Promise<Plugin>;

  eventBus: EventBus;
}

// Utility Classes
export class MessageEmitter {
  on(event: string, listener: (...args: any[]) => void): this;
  off(event: string, listener: (...args: any[]) => void): this;
  emit(event: string, ...args: any[]): boolean;
}

export class WebsocketRPCConnection {
  constructor(
    server: HyphaCore,
    workspace: string,
    client_id: string,
    userInfo: UserInfo | null,
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
    userInfo: UserInfo | null,
    manager_id: string | null
  );
  on_message(data: any): void;
  emit_message(data: any): void;
}

// Main HyphaCore Class
export class HyphaCore extends MessageEmitter {
  static servers: { [url: string]: any };
  
  redis: any;
  port: number;
  baseUrl: string;
  WebSocketClass: any;
  url: string;
  wsUrl: string;
  server: any;
  workspaceManagerId: string;
  connections: { [key: string]: Connection };
  defaultServices: { [key: string]: any };
  imjoyPluginWindows: Map<any, any>;
  jwtSecret: string;
  environment: string;
  api?: HyphaAPI;

  constructor(config?: HyphaCoreConfig);
  
  start(config?: ServerConfig): Promise<HyphaAPI>;
  connect(config?: ServerConfig): Promise<HyphaAPI>;
  reset(): Promise<void>;
  close(): void;
  
  // Event handling
  emit(event: string, data: any): Promise<void>;
}

// Utility Functions
export function randId(): string;
export function toCamelCase(str: string): string;
export function parseJwt(token: string): any;
export function assert(condition: any, message?: string): asserts condition;

// External Dependencies Re-exports
export interface MockSocket {
  Server: any;
  WebSocket: any;
}

export interface HyphaRPC {
  connectToServer: (config: ServerConfig) => Promise<HyphaAPI>;
}

export interface ImjoyRPC {
  RPC: any;
}

// Main export
export const connectToServer: (config: ServerConfig) => Promise<HyphaAPI>;

// Re-exports from dependencies
export const hyphaWebsocketClient: HyphaRPC;
export const imjoyRPC: ImjoyRPC;
export const WebSocket: any;

// Default export
export default HyphaCore;
