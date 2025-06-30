import { encode as msgpack_packb, Decoder } from "@msgpack/msgpack";
import { parseComponent } from "./pluginParser.js";

export function toCamelCase(str) {
    // Check if the string is already in camelCase
    if (!str.includes("_")) {
      return str;
    }
    // Convert from snake_case to camelCase
    return str.replace(/_./g, (match) => match[1].toUpperCase());
}

export function toSnakeCase(str) {
    // Only convert if the string contains camelCase (has uppercase letters but no underscores)
    if (!str.includes('_') && /[A-Z]/.test(str)) {
        return str.replace(/([A-Z])/g, '_$1').toLowerCase();
    }
    return str; // Return unchanged if already snake_case or no camelCase detected
}

/**
 * Convert camelCase method names to snake_case in a service object
 * This ensures compatibility with both Python and JavaScript/TypeScript clients
 * since hypha-rpc clients automatically convert camelCase to snake_case
 */
export function convertToSnakeCase(service) {
    const convertedService = {};
    
    // Helper function to process nested objects
    function processObject(obj) {
        const result = {};
        
        for (const [key, value] of Object.entries(obj)) {
            // Skip metadata fields - keep them as-is
            if (['id', 'name', 'description', 'config', 'app_id'].includes(key)) {
                result[key] = value;
                continue;
            }
            
            // Convert the key to snake_case
            const snakeKey = toSnakeCase(key);
            
            if (typeof value === 'function') {
                // Use snake_case key for function
                result[snakeKey] = value;
        
            } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                // Skip RPC proxy objects
                if (value._rintf) {
                    result[snakeKey] = value;
                    continue;
                }
                // Recursively process nested objects
                result[snakeKey] = processObject(value);
            } else {
                // For other properties, use snake_case key
                result[snakeKey] = value;
            }
        }
        
        return result;
    }
    
    return processObject(service);
}

/**
 * Convert snake_case method names back to camelCase in a service object
 * This is used when returning services to JavaScript clients that expect camelCase method names
 */
export function convertToCamelCase(service) {

    // Helper function to process nested objects
    function processObject(obj) {
        const result = {};
        
        for (const [key, value] of Object.entries(obj)) {
            // Skip metadata fields - keep them as-is
            if (['id', 'name', 'description', 'config', 'app_id'].includes(key)) {
                result[key] = value;
                continue;
            }
            
            // Convert the key to camelCase
            const camelKey = toCamelCase(key);
            
            if (typeof value === 'function') {
                // Use camelCase key for function
                result[camelKey] = value;
            } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                // Skip RPC proxy objects
                if (value._rintf) {
                    result[camelKey] = value;
                    continue;
                }
                // Recursively process nested objects
                result[camelKey] = processObject(value);
            } else {
                // For other properties, use camelCase key
                result[camelKey] = value;
            }
        }
        
        return result;
    }
    
    return processObject(service);
}

export class MessageEmitter {
    constructor(debug) {
      this._event_handlers = {};
      this._once_handlers = {};
      this._debug = debug;
    }
    emit() {
      throw new Error("emit is not implemented");
    }
    on(event, handler) {
      if (!this._event_handlers[event]) {
        this._event_handlers[event] = [];
      }
      this._event_handlers[event].push(handler);
    }
    once(event, handler) {
      handler.___event_run_once = true;
      this.on(event, handler);
    }
    off(event, handler) {
      if (!event && !handler) {
        // remove all events handlers
        this._event_handlers = {};
      } else if (event && !handler) {
        // remove all hanlders for the event
        if (this._event_handlers[event]) this._event_handlers[event] = [];
      } else {
        // remove a specific handler
        if (this._event_handlers[event]) {
          const idx = this._event_handlers[event].indexOf(handler);
          if (idx >= 0) {
            this._event_handlers[event].splice(idx, 1);
          }
        }
      }
    }
    _fire(event, data) {
      if (this._event_handlers[event]) {
        var i = this._event_handlers[event].length;
        while (i--) {
          const handler = this._event_handlers[event][i];
          try {
            handler(data);
          } catch (e) {
            console.error(e);
          } finally {
            if (handler.___event_run_once) {
              this._event_handlers[event].splice(i, 1);
            }
          }
        }
      } else {
        if (this._debug) {
          console.warn("unhandled event", event, data);
        }
      }
    }
  
    waitFor(event, timeout) {
      return new Promise((resolve, reject) => {
        const handler = (data) => {
          clearTimeout(timer);
          resolve(data);
        };
        this.once(event, handler);
        const timer = setTimeout(() => {
          this.off(event, handler);
          reject(new Error("Timeout"));
        }, timeout);
      });
    }
  }
  

export function randId() {
    return (
        Math.random()
            .toString(36)
            .substr(2, 10) + new Date().getTime()
    );
}

export function assert(condition, message) {
    if (!condition) {
        throw new Error(message || "Assertion failed");
    }
}


export class WebsocketRPCConnection {
    constructor(eventBus, clients, clientId, workspace, managerId, timeout = 60) {
        this._clients = clients;
        this._clientId = clientId;
        this._handle_message = null;
        this._handle_connected = null;
        this._handle_disconnected = null;
        this._reconnection_token = null;
        this._timeout = timeout * 1000;
        this.workspace = workspace;
        this.connection_info = null;
        this.manager_id = managerId;
        this.eventBus = eventBus;
    }

    mount(config) {
        assert(config.id && config.workspace && config.websocket && config.user_info, "Invalid client config");
        config.websocket.on("message", (data)=>{
            const decoder = new Decoder();
            const unpacker = decoder.decodeMulti(data);
    
            const { value: message } = unpacker.next();
            const targetId = message.to.includes('/') ? message.to.split('/')[1] : message.to;
            if (targetId === this._clientId) {
                this._handle_message(data.buffer);
            } else {
                this.emit_message(data);
            }
        });
    }

    on_connected(handler) {
        this._handle_connected = handler;
    }

    on_disconnected(handler) {
        this._handle_disconnected = handler;
    }


    on_message(handler) {
        assert(handler, "handler is required");
        this._handle_message = handler;
    }

    async emit_message(data) {
        assert(this._handle_message, "No handler for message");
        const decoder = new Decoder();
        const unpacker = decoder.decodeMulti(data);

        const { value: message } = unpacker.next();
        let targetId = message.to;
        if (!targetId.includes("/")) {
            targetId = `${this.workspace}/${targetId}`;
        }
        if (!this._clients[targetId]) {
            console.error('No client found for targetId:', targetId);
            return;
        }
        const client = this._clients[targetId];
        const websocket = client.websocket;
        if (!message.from.includes('/')) {
            message.from = `${this.workspace}/${message.from}`;
        }
        const updatedMessage = {
            ...message,
            ws: this.workspace,
            to: targetId,
            from: message.from,
            user: client.userInfo,
        };
        const encodedUpdatedMessage = msgpack_packb(updatedMessage);

        const pos = decoder.pos;
        const remainingData = data.slice(pos);
        const finalData = new Uint8Array(encodedUpdatedMessage.length + remainingData.length);
        finalData.set(encodedUpdatedMessage, 0);
        finalData.set(new Uint8Array(remainingData), encodedUpdatedMessage.length);

        if (!websocket || !websocket.send) {
            console.error('No websocket found for targetId:', targetId);
            return;
        }
        websocket.send(finalData.buffer);
    }

    disconnect(reason) {
        console.info(`Websocket connection disconnected (${reason})`);
    }
}

export class RedisRPCConnection {
    /**
     * Represent a Redis connection for handling RPC-like messaging.
     * @param {EventBus} eventBus - Event bus for messaging.
     * @param {string} workspace - Workspace identifier.
     * @param {string} clientId - Client identifier.
     * @param {UserInfo} userInfo - User information.
     * @param {string} managerId - Manager identifier.
     */
    constructor(eventBus, workspace, clientId, userInfo, managerId) {
        if (!workspace || clientId.includes("/")) {
            throw new Error("Invalid workspace or client ID");
        }
        this._workspace = workspace;
        this._clientId = clientId;
        this._userInfo = userInfo;
        this._stop = false;
        this._eventBus = eventBus;
        this._handleConnected = null;
        this._handleDisconnected = null;
        this._handleMessage = null;
        this.manager_id = managerId;
    }

    /**
     * Register a disconnection event handler.
     * @param {function} handler - Disconnection handler.
     */
    on_disconnected(handler) {
        this._handleDisconnected = handler;
    }

    /**
     * Register a connection open event handler.
     * @param {function} handler - Connection handler.
     */
    on_connected(handler) {
        this._handleConnected = handler;
    }

    /**
     * Set message handler.
     * @param {function} handler - Message handler.
     */
    on_message(handler) {
        this._handleMessage = handler;
        this._eventBus.on(`${this._workspace}/${this._clientId}:msg`, handler);
        this._eventBus.on(`${this._workspace}/*:msg`, handler);
        if (this._handleConnected) {
            this._handleConnected(this);
        }
    }

    /**
     * Send message after packing additional info.
     * @param {Object|Uint8Array} data - Data to send.
     */
    async emit_message(data) {
        if (this._stop) {
            throw new Error(`Connection has already been closed (client: ${this._workspace}/${this._clientId})`);
        }
        if (!(data instanceof Uint8Array)) {
          console.log("Skipping text message", data)
          return;
        }
        const decoder = new Decoder();
        const unpacker = decoder.decodeMulti(data);
        const { value: message } = unpacker.next();

        const pos = decoder.pos;
        
        let targetId = message.to;

        // Handle dynamic service IDs (e.g. workspace-manager:g6ycaf1d2u1751144287428)
        if (!targetId.includes("/")) {
            // If we're in the * workspace and the target is a dynamic service
            if (this._workspace === "*" && targetId.includes(":")) {
                // Extract the actual workspace from the message if available
                const actualWorkspace = message.ws || message.workspace || this._workspace;
                targetId = `${actualWorkspace}/${targetId}`;
            } else {
                if (targetId.includes("/workspace-manager-")) {
                    throw new Error(`Invalid target ID: ${targetId}, it appears that the target is a workspace manager (target_id should starts with */)`);
                }
                targetId = `${this._workspace}/${targetId}`;
            }
        }

        const sourceId = `${this._workspace}/${this._clientId}`;

        // For * workspace, use the target's workspace
        const effectiveWorkspace = this._workspace === "*" ? targetId.split("/")[0] : this._workspace;

        message.ws = effectiveWorkspace;
        message.to = targetId;
        message.from = sourceId;
        message.user = this._userInfo;
        const encodedUpdatedMessage = msgpack_packb(message);

        const remainingData = data.slice(pos);
        const finalData = new Uint8Array(encodedUpdatedMessage.length + remainingData.length);
        finalData.set(encodedUpdatedMessage, 0);
        finalData.set(new Uint8Array(remainingData), encodedUpdatedMessage.length);

        await this._eventBus.emit(`${targetId}:msg`, finalData.buffer);
    }

    /**
     * Handle disconnection.
     * @param {string} [reason] - Reason for disconnection.
     */
    async disconnect(reason) {
        this._stop = true;
        if (this._handleMessage) {
            this._eventBus.off(`${this._workspace}/${this._clientId}:msg`, this._handleMessage);
            this._eventBus.off(`${this._workspace}/*:msg`, this._handleMessage);
        }
        this._handleMessage = null;
        console.info(`Redis Connection Disconnected: ${reason}`);
        if (this._handleDisconnected) {
            await this._handleDisconnected(reason);
        }
    }
}


const CONFIGURABLE_FIELDS = [
    "env",
    "requirements",
    "dependencies",
    "icon",
    "ui",
    "type",
    "flags",
    "labels",
    "cover",
    "base_frame",
    "base_worker",
    "passive",
];

export function parsePluginCode(code, overwrite_config) {
    overwrite_config = overwrite_config || {};
    try {
        const pluginComp = parseComponent(code);
        let config;
        if (pluginComp.config[0].attrs.lang === "yaml") {
            throw new Error("YAML not supported")
            // config = yaml.load(pluginComp.config[0].content);
        } else if (pluginComp.config[0].attrs.lang === "json") {
            config = JSON.parse(pluginComp.config[0].content);
        } else {
            config = JSON.parse(pluginComp.config[0].content);
            if (compareVersions(config.api_version, ">", "0.1.5")) {
            throw `Unsupported config language ${
                pluginComp.config[0].attrs.lang
            }, please set lang="json" or lang="yaml"`;
            }
        }

        config.tag = overwrite_config.tag || (config.tags && config.tags[0]);
        (config.hot_reloading = overwrite_config.hot_reloading),
            (config.scripts = []);
        // try to match the script with current tag
        for (let i = 0; i < pluginComp.script.length; i++) {
            if (pluginComp.script[i].attrs.tag === config.tag) {
            config.script = pluginComp.script[i].content;
            }

            // exclude script with mismatched tag
            if (
            !pluginComp.script[i].attrs.tag ||
            pluginComp.script[i].attrs.tag === config.tag
            ) {
            config.scripts.push(pluginComp.script[i]);
            }
        }
        if (!config.script && pluginComp.script.length > 0) {
            config.script = pluginComp.script[0].content;
            config.lang = pluginComp.script[0].attrs.lang;
        }
        config.links = pluginComp.link || null;
        config.windows = pluginComp.window || null;
        config.styles = pluginComp.style || null;
        config.docs = (pluginComp.docs && pluginComp.docs[0]) || config.docs;
        config.attachments = pluginComp.attachment || null;

        config._id = overwrite_config._id || config.name.replace(/ /g, "_");
        config.uri = overwrite_config.uri;
        config.origin = overwrite_config.origin;
        config.namespace = overwrite_config.namespace;
        config.code = code;
        config.id = config.name.trim().replace(/ /g, "_") + "_" + randId();
        config.runnable = config.runnable === false ? false : true;
        config.requirements = config.requirements || [];

        for (let i = 0; i < CONFIGURABLE_FIELDS.length; i++) {
            const obj = config[CONFIGURABLE_FIELDS[i]];
            if (obj && typeof obj === "object" && !(obj instanceof Array)) {
            if (config.tag) {
                config[CONFIGURABLE_FIELDS[i]] = obj[config.tag];
                if (!Object.prototype.hasOwnProperty.call(obj, config.tag)) {
                console.log(
                    "WARNING: " +
                    CONFIGURABLE_FIELDS[i] +
                    " do not contain a tag named: " +
                    config.tag
                );
                }
            } else {
                throw "You must use 'tags' with configurable fields.";
            }
            }
        }
        config.lang = config.lang || "javascript";
        
        return config;
    } catch (e) {
        console.error(e);
        throw `Failed to parse the plugin file, error: ${e}`;
    }
}

/**
 * Environment detection utilities for cross-platform compatibility
 */
export const Environment = {
    /**
     * Check if we're running in a browser environment
     */
    isBrowser() {
        return typeof window !== 'undefined' && 
               typeof document !== 'undefined' && 
               typeof navigator !== 'undefined';
    },

    /**
     * Check if we're running in Node.js
     */
    isNode() {
        return typeof process !== 'undefined' && 
               process.versions && 
               process.versions.node;
    },

    /**
     * Check if we're running in Deno
     */
    isDeno() {
        return typeof Deno !== 'undefined';
    },

    /**
     * Check if we're running in a server environment (Node.js or Deno)
     */
    isServer() {
        return this.isNode() || this.isDeno();
    },

    /**
     * Get environment name for debugging
     */
    getEnvironment() {
        if (this.isBrowser()) return 'browser';
        if (this.isDeno()) return 'deno';
        if (this.isNode()) return 'node';
        return 'unknown';
    },

    /**
     * Require browser environment or throw error
     */
    requireBrowser(feature) {
        if (!this.isBrowser()) {
            throw new Error(`${feature} requires browser environment. Currently running in: ${this.getEnvironment()}`);
        }
    },

    /**
     * Get safe base URL for different environments
     */
    getSafeBaseUrl() {
        if (this.isBrowser() && typeof document !== 'undefined' && document.location) {
            return new URL('./', document.location.href).href;
        }
        // Default fallback for server environments
        return 'http://localhost:8080/';
    },

    /**
     * Safe postMessage wrapper
     */
    safePostMessage(target, message, origin = '*') {
        // PostMessage is available in browsers and Deno (Web API compatibility)
        if ((this.isBrowser() || this.isDeno()) && target && typeof target.postMessage === 'function') {
            target.postMessage(message, origin);
        } else {
            console.warn('postMessage not available in current environment:', this.getEnvironment());
        }
    },

    /**
     * Safe event listener management
     */
    safeAddEventListener(target, event, handler) {
        // Event listeners are available in browsers and Deno (Web API compatibility)
        if ((this.isBrowser() || this.isDeno()) && target && typeof target.addEventListener === 'function') {
            target.addEventListener(event, handler);
            return true;
        }
        return false;
    },

    safeRemoveEventListener(target, event, handler) {
        // Event listeners are available in browsers and Deno (Web API compatibility)
        if ((this.isBrowser() || this.isDeno()) && target && typeof target.removeEventListener === 'function') {
            target.removeEventListener(event, handler);
            return true;
        }
        return false;
    }
};
