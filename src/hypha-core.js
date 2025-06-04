import { Server, WebSocket } from 'mock-socket';
import { hyphaWebsocketClient } from 'hypha-rpc';
import { imjoyRPC } from 'imjoy-rpc';
import { randId, MessageEmitter, WebsocketRPCConnection, RedisRPCConnection, assert } from './utils/index.js';
import { Workspace } from './workspace.js';
import { toCamelCase } from './utils/index.js';
import * as redisClient from './utils/redis-mock.js';

const connectToServer = hyphaWebsocketClient.connectToServer;
const AUTH0_NAMESPACE = "https://api.imjoy.io/";

// JWT HS256 Implementation (for verification only)
function base64UrlDecode(base64Url) {
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
        base64 += '=';
    }
    return atob(base64);
}

async function hmacSha256(key, data) {
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

class HyphaCore extends MessageEmitter {
    static servers = {};

    constructor(config) {
        super();
        config = config || {};
        this.redis = redisClient;
        this.port = config.port || 8080;
        this.baseUrl = config.base_url || new URL('./', document.location.href).href;
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
            this.url = config.url || "https://local-hypha-server:" + this.port;
            this.wsUrl = this.url.replace("https://", "wss://").replace("http://", "ws://") + "/ws";
        }
        this.api = null;
        this.server = null;
        this.workspaceManagerId = "workspace-manager";
        this.connections = {};
        this.defaultServices = config.default_service || {};
        this.imjoyPluginWindows = new Map();
        this.jwtSecret = config.jwtSecret || "hypha-core-default-secret-" + randId();

        this.on("add_window", (config) => {
            console.log("Creating window: ", config);
        });
    }

    async emit(event, data) {
        this._fire(event, data);
    }

    _handleImJoyPlugin(event) {
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
                    // add more info to the last argument
                    return await defaultService[key](...args, {ws: this.connections[cid].workspace,  from: `${cid}`, to: `${this.connections[cid].workspace}/${this.workspaceManagerId}` });
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
                contentWindow.postMessage(msg, "*")
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
            // fix the following code to find an connection
            for(const key in this.connections){
                if(this.connections[key].source === event.currentTarget){
                    const conn = this.connections[key];
                    this.emit("connection_ready", conn)
                    break;
                }
            }
        }
        const workspace = event.data.workspace;
        if (!workspace) {
            if (event.data.type === "initialized") {
                this._handleImJoyPlugin(event);
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
            this.server = new this.ServerClass(this.wsUrl, { mock: false });
            HyphaCore.servers[this.url] = this.server;
            this.messageHandler = this._handleClientMessage.bind(this);
            window.addEventListener("message", this.messageHandler);
            this.workspaceManager = new Workspace(this);
            await this.workspaceManager.setup({
                client_id: this.workspaceManagerId,
                method_timeout: 60,
                default_service: this.defaultServices,
            })
        }
        this.server.on('connection', async websocket => {
            let authConfig = {};
            try{
                const data = await new Promise((resolve, reject) => {
                    websocket.on('message', resolve);
                    websocket.on('error', reject);
                });
                const authInfo = JSON.parse(data);
                Object.assign(authConfig, authInfo);
            }
            catch(e){
                console.error(e);
                websocket.close();
                return;
            }
            
            let userInfo;
            let workspace;
            
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
                    
                    workspace = payload.workspace || authConfig.workspace || payload.sub || "default";
                    
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
                        workspace = userInfo.id;
                    } catch (parseError) {
                        console.error("Token verification failed:", jwtError.message);
                        websocket.close();
                        return;
                    }
                }
            } else {
                userInfo = { id: "anonymous", is_anonymous: true, email: "anonymous@imjoy.io" };
                workspace = authConfig.workspace || "default";
            }
            
            if (!workspace) {
                workspace = "workspace-" + randId();
            }
            
            const baseUrl = this.url.endsWith("/") ? this.url.slice(0, -1) : this.url;
            // send connection info
            websocket.send(JSON.stringify({
                "type": "connection_info",
                "hypha_version": "0.1.0",
                "public_base_url": baseUrl,
                "local_base_url": baseUrl,
                "manager_id": this.workspaceManagerId,
                "workspace": workspace,
                "client_id": authConfig.client_id,
                "user": userInfo,
                "reconnection_token": null
            }));
            const conn = new RedisRPCConnection(this, workspace, authConfig.client_id, userInfo, this.workspaceManagerId)
            conn.on_message(data=> {
                websocket.send(data)
            });
            websocket.on('message', data => {
                conn.emit_message(data);
            });
        });
        config = config || {};
        config.server = this;
        config.WebSocketClass = this.WebSocketClass;
        assert(config.workspace === undefined, "workspace is not allowed to be set in the config");
        assert(config.client_id === undefined, "client_id is not allowed to be set in the config");

        // create root api
        config.workspace = "default";
        config.client_id = "root";
        const rawApi = await connectToServer(config);
        
        // Create camelCase wrapper for the API
        const api = this._createCamelCaseWrapper(rawApi);
        
        // expose root api
        this.api = api;
        return api;
    }

    async connect(config){
        config = config || {};
        config.server = this;
        config.WebSocketClass = this.WebSocketClass;
        config.workspace = config.workspace || "default";
        assert(config.client_id !== "root", "client_id cannot be 'root'");
        config.client_id = config.client_id || randId();
        const rawApi = await connectToServer(config);
        
        // Create camelCase wrapper for the API
        return this._createCamelCaseWrapper(rawApi);
    }

    _createCamelCaseWrapper(rawApi) {
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
        
        return wrappedApi;
    }

    async reset() {
        this.close();
        await this.start();
    }

    close() {
        for (const ws of Object.values(Workspace.workspaces)) {
            ws.eventBus.off("service_added");
        }
        window.removeEventListener("message", this.messageHandler);
        this.server.stop();
        delete HyphaCore.servers[this.server.url];
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

export { HyphaCore, connectToServer, imjoyRPC, hyphaWebsocketClient, WebSocket, Workspace, WebsocketRPCConnection };
