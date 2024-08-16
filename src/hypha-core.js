import { Server, WebSocket } from 'mock-socket';
import { hyphaWebsocketClient } from 'hypha-rpc';
import { imjoyRPC } from 'imjoy-rpc';
import { randId, MessageEmitter, WebsocketRPCConnection, RedisRPCConnection } from './utils';
import { Workspace } from './workspace';
import { toCamelCase } from './utils';
import * as redisClient from './utils/redis-mock';

const connectToServer = hyphaWebsocketClient.connectToServer;
const AUTH0_NAMESPACE = "https://api.imjoy.io/";
class HyphaServer extends MessageEmitter {
    static servers = {};

    constructor(config) {
        super();
        config = config || {};
        this.redis = redisClient;
        this.port = config.port || 8080;
        this.baseUrl = config.base_url || "./";
        if (config.url && config.port) {
            throw new Error("Please provide either url or port, not both.");
        }
        this.WebSocketClass = WebSocket;
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
        this.server = null;
        this.workspaceManagerId = "workspace-manager";
        this.connections = {};
        this.defaultServices = config.default_services || {};
        this.imjoyPluginWindows = new Map();

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
        const defaultService = this.workspaceManager.getDefaultServices();
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
        console.log("plugin initialized:", pluginConfig, event.source);
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
            const ws = new WebSocket(event.data.url);
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

    async start() {
        if (HyphaServer.servers[this.url]) {
            throw new Error(`Server already running at ${this.url}`);
        }
        else {
            this.server = new Server(this.wsUrl, { mock: false });
            HyphaServer.servers[this.url] = this.server;
            this.messageHandler = this._handleClientMessage.bind(this);
            window.addEventListener("message", this.messageHandler);
            this.workspaceManager = new Workspace(this);
            await this.workspaceManager.setup({
                client_id: this.workspaceManagerId,
                method_timeout: 60,
                default_services: this.defaultServices,
            })
        }
        this.server.on('connection', async websocket => {
            let config = {};
            try{
                const data = await new Promise((resolve, reject) => {
                    websocket.on('message', resolve);
                    websocket.on('error', reject);
                });
                const authInfo = JSON.parse(data);
                Object.assign(config, authInfo);
            }
            catch(e){
                console.error(e);
                websocket.close();
                return;
            }
            
            let userInfo;
            if (config.token) {
                if (Workspace.tokens[config.token]) {
                    const ws = Workspace.tokens[config.token].workspace;
                    if (config.workspace && config.workspace !== ws.id) {
                        throw new Error("Invalid workspace token");
                    }
                    config.workspace = ws.id;
                    userInfo = { id: ws.id, is_anonymous: true, email: "" };
                } else {
                    const info = parseJwt(config.token);
                    const expiresAt = info["exp"];
                    userInfo = {
                        id: info["sub"],
                        is_anonymous: !info[AUTH0_NAMESPACE + "email"],
                        email: info[AUTH0_NAMESPACE + "email"],
                        roles: info[AUTH0_NAMESPACE + "roles"],
                        scopes: info["scope"],
                        expires_at: expiresAt,
                    };
                    config.workspace = userInfo.id;

                }
            } else {
                userInfo = { id: "anonymous", is_anonymous: true, email: "anonymous@imjoy.io" };
            }
            if (!config.workspace) {
                config.workspace = "workspace-" + randId();
            }
            websocket.send(JSON.stringify({
                "type": "connection_info",
                "hypha_version": "0.1.0",
                "manager_id": this.workspaceManagerId,
                "workspace": config.workspace,
                "client_id": config.client_id,
                "user": userInfo,
                "reconnection_token": null
            }));
            const conn = new RedisRPCConnection(this, config.workspace, config.client_id, userInfo, this.workspaceManagerId)
            conn.on_message(data=> {
                websocket.send(data)
            });
            websocket.on('message', data => {
                conn.emit_message(data);
            });
        });
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
        delete HyphaServer.servers[this.server.url];
    }
}

function parseJwt(token) {
    var base64Url = token.split('.')[1];
    var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    var jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
}

export { HyphaServer, connectToServer, imjoyRPC, hyphaWebsocketClient, WebSocket, Workspace, WebsocketRPCConnection };
