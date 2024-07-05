import { Server, WebSocket } from 'mock-socket';
import { hyphaWebsocketClient, imjoyRPC } from 'imjoy-rpc';
import { randId, assert, MessageEmitter, parsePluginCode } from './utils'
import { encode as msgpack_packb, Decoder } from "@msgpack/msgpack";

const connectToServer = hyphaWebsocketClient.connectToServer;
export { connectToServer, imjoyRPC, WebSocket };
class Workspace {
    static workspaces = {};
    static tokens = {};
    static clients = {};
    static async get(config) {
        if (!Workspace.workspaces[config.workspace]) {
            Workspace.workspaces[config.workspace] = new Workspace();
            await Workspace.workspaces[config.workspace].setup(config);
        }
        return Workspace.workspaces[config.workspace];
    }

    waitForClient(cid, timeout) {
        return new Promise((resolve, reject) => {
            const handler = (info) => {
                if (info.id === cid && info.error) {
                    clearTimeout(timeoutId); // clear the timeout
                    reject(new Error(info.error));
                }
                else if (info.id === cid && info.imjoyApi) {
                    clearTimeout(timeoutId); // clear the timeout
                    resolve(info.imjoyApi);
                    return;
                }
                else if (info.id === cid && info.services) {
                    // check if there is a service with id ends with ":default"
                    const defaultService = info.services.find(s => s.id.endsWith(":default"));
                    if (defaultService) {
                        clearTimeout(timeoutId); // clear the timeout
                        this.rpc.get_remote_service(defaultService.id).then(async (svc) => {
                            try {
                                await this.eventBus.emit("client_ready", svc);
                                resolve(svc);
                            }
                            catch (e) {
                                reject(e);
                            }
                        });
                    }
                    else {
                        console.error("No default service found in the iframe client: ", clientId);
                        reject("No default service found in the iframe client: " + clientId);
                    }
                }
            }
            let timeoutId = setTimeout(() => {
                this.eventBus.off("client_info_updated", handler);
                reject(new Error(`Timeout after ${timeout / 1000} s`));
            }, timeout);
            this.eventBus.on("client_info_updated", handler);
        });
    }

    get_default_service() {
        return this.rpc.get_local_service("default", { to: `${this.id}/workspace-manager` });
    }

    async setup(config) {
        assert(config.workspace, "workspace is required")
        this.eventBus = config.event_bus;
        this.id = config.workspace;
        this.connections = config.connections;
        this.serverUrl = config.server_url;
        this.baseUrl = config.base_url;
        this.messageHandler = config.message_handler;
        this.connection = new WebsocketRPCConnection(
            Workspace.clients,
            "workspace-manager",
            config.workspace,
            config.user_info,
            config.method_timeout || 60
        );
        const self = this;
        assert(config.workspace, "workspace is required")
        const rpc = new hyphaWebsocketClient.RPC(this.connection, {
            client_id: "workspace-manager",
            default_context: { connection_type: "websocket" },
            name: config.name,
            method_timeout: config.method_timeout,
            workspace: config.workspace,
        });
        const get_connection_info = (context) => {
            const info = {
                "workspace": config.workspace,
                // "client_id": clientId,
                "reconnection_token": "",
                "reconnection_expires_in": 36000,
            }
            return info;
        }

        this.plugins = {};
        this.eventBus.on("client_ready", async (svc) => {
            this.plugins[svc.id] = svc;
        });

        const get_plugin = async (config, context) => {
            if (typeof config === "string") {
                return await load_plugin({ src: config }, context);
            }
            else if (config.id) {
                return this.plugins[config.id];
            }
            else if (config.name) {
                for (const [key, value] of Object.entries(this.plugins)) {
                    if (value.name === config.name) {
                        return value;
                    }
                }
            }
            else {
                throw new Error("Please provide either id or name for the plugin");
            }
        }

        const register_service = async (service, context) => {
            const sv = await rpc.get_remote_service(context["from"] + ":built-in")
            service["config"] = service["config"] || {}
            service["config"]["workspace"] = config.workspace
            service = await sv.register_service(service) // **kwargs
            assert(!service["id"].includes("/"), "Service id must not contain '/'")
            service["id"] = config.workspace + "/" + service["id"]
            return service
        }

        function patchServiceConfig(workspace, serviceApi) {
            serviceApi.config = serviceApi.config || {};
            serviceApi.config.workspace = workspace.id;
            return serviceApi;
        }

        async function getServiceById(serviceId, clientId = "*", workspace = "*") {
            for (const client of Object.values(Workspace.clients)) {
                const ws = client.workspaceObj;
                for (const service of client.services) {
                    const [ci, si] = service.id.split(":");

                    // If both clientId and workspace are "*", return the first service
                    if (clientId === "*" && workspace === "*") {
                        const serviceApi = await ws.rpc.get_remote_service(`${client.id}:${serviceId}`);
                        return patchServiceConfig(ws, serviceApi);
                    }

                    // If only clientId is "*", match any client with the given serviceId
                    if (clientId === "*" && si === serviceId) {
                        const serviceApi = await ws.rpc.get_remote_service(`${client.id}:${serviceId}`);
                        return patchServiceConfig(ws, serviceApi);
                    }

                    // If only workspace is "*", match any workspace with the given clientId and serviceId
                    if (workspace === "*" && ci === clientId && si === serviceId) {
                        const serviceApi = await ws.rpc.get_remote_service(service.id);
                        return patchServiceConfig(ws, serviceApi);
                    }

                    // If neither are "*", match the exact clientId and serviceId
                    if (ci === clientId && si === serviceId) {
                        const serviceApi = await ws.rpc.get_remote_service(service.id);
                        return patchServiceConfig(ws, serviceApi);
                    }
                }
            }


            throw new Error(`Service with id ${serviceId} not found`);
        }

        async function get_service(query, context = null) {
            let serviceId;
            if (typeof query === 'object' && !Array.isArray(query)) {
                serviceId = "id" in query ? query["id"] : query["service_id"] || "*";
            } else if (typeof query === 'string') {
                serviceId = query;
                query = { "id": serviceId };
            } else {
                throw new Error("Query must be a string or an object");
            }

            if (serviceId.includes("/") && !serviceId.includes(":")) {
                serviceId += ":default";
                query["workspace"] = serviceId.split("/")[0];
                query["client_id"] = serviceId.split("/")[1];
            } else if (!serviceId.includes("/") && !serviceId.includes(":")) {
                let workspace = query["workspace"] || "*";
                serviceId = `${workspace}/*:${serviceId}`;
                query["workspace"] = workspace;
                query["client_id"] = "*";
            } else if (!serviceId.includes("/") && serviceId.includes(":")) {
                let workspace = query["workspace"] || config.workspace;
                query["client_id"] = serviceId.split(":")[0];
                serviceId = `${workspace}/${serviceId}`;
                query["workspace"] = workspace;
            } else {
                let [workspace, rest] = serviceId.split("/");
                query["client_id"] = rest.split(":")[0];
                query["workspace"] = workspace;
            }
            query["service_id"] = serviceId.split(":")[1];
            console.info("Getting service:", query);
            if (serviceId !== "*") {
                const serviceApi = await getServiceById(query.service_id, query.client_id, query.workspace);
                return serviceApi;
            } else {
                throw new Error("Wildcard service not supported yet");
                // Handle the "*" case or other logic as needed
            }
        }

        const generate_token = async (context) => {
            const token = randId();
            Workspace.tokens[token] = {
                "workspace": this,
            }
            return token;
        }

        const create_window = async (config, context) => {
            // set src
            if (config.src && config.src.startsWith('http') && config.src.split("?")[0].endsWith(".imjoy.html")) {
                // fetch the plugin code
                const resp = await fetch(config.src);
                const code = await resp.text();
                const pluginConfig = parsePluginCode(code, {});
                if (pluginConfig.type !== "window") {
                    throw new Error("Invalid window plugin type: " + pluginConfig.type);
                }
                config = Object.assign(config, pluginConfig);
                config.src = self.baseUrl + "hypha-app-iframe.html";
            }
            else if (config.id && config.type === "window" && config.script) {
                config.src = self.baseUrl + "hypha-app-iframe.html";
            }
            const workspace = this.id;
            const clientId = "client-" + Date.now();
            let elem;
            this.connections[this.id + "/" + clientId] = {
                workspace: workspace,
                websocket: null,
                postMessage: (data) => {
                    elem.contentWindow.postMessage(data);
                },
            }
            // create iframe; hidden by default
            if (config.type === "iframe") {
                elem = document.createElement("iframe");
                elem.src = config.src;
                elem.id = config.window_id || "window-" + Date.now();
                elem.style.width = config.width || "100%";
                elem.style.height = config.height || "100%";
                elem.style.display = "none"; // hidden
                document.body.appendChild(elem);
            }
            else if (config.window_id) {
                elem = document.getElementById(config.window_id);
                if (!elem) {
                    throw new Error("Window element not found: " + config.window_id);
                }
            }
            else {
                // window type need to be created by the add_window event
                config.window_id = "window-" + Date.now();
                config.workspace = workspace;
                await this.eventBus.emit("add_window", config);
                await new Promise((resolve) => setTimeout(resolve, 0));
                elem = document.getElementById(config.window_id);
                if (!elem) {
                    // throw new Error("Window element not found: " + config.window_id);
                    throw new Error(`iframe element not found ${config.window_id} in ${9 * 500 / 1000} s`)
                }
                // make sure elem is an iframe element
                if (elem.tagName !== "IFRAME") {
                    throw new Error("iframe element must be an iframe: " + config.window_id);
                }
            }
            // wait for the client to be ready
            this.connections[this.id + "/" + clientId].contentWindow = elem.contentWindow;
            
            let waitClientPromise;
            if (!config.passive) {
                waitClientPromise = this.waitForClient(this.id + "/" + clientId, 180000);
            }
            // wait for element ready
            await new Promise((resolve, reject) => {
                elem.onload = resolve;
                elem.onerror = reject;
            });
            console.log("Created window for workspace: ", workspace, " with client id: ", clientId, elem);
            if (config.passive) {
                delete this.connections[this.id + "/" + clientId];
                return;
            }
            // initialize the connection to the iframe
            elem.contentWindow.postMessage({
                type: "initializeHyphaClient",
                server_url: this.serverUrl,
                client_id: clientId,
                workspace,
                config,
            });
            const svc = await waitClientPromise;
            if (svc.setup) {
                await svc.setup();
            }
            if (svc.run && config) {
                await svc.run({
                    data: config.data,
                    config: config.config,
                });
            }
            console.log("Client ready: ", clientId, " in workspace: ", workspace, svc)
            return svc;
        }

        const load_plugin = async (config, context) => {
            let code;
            const src = config.src;
            if (src.startsWith("http") && !src.split("?")[0].endsWith(".imjoy.html")) {
                return await create_window(config, context);
            }
            // imjoy plugin file url
            if (src.startsWith("http")) {
                // fetch the plugin code
                const resp = await fetch(src);
                code = await resp.text();
            }
            // imjoy source code
            else if (src.includes("\n")) {
                code = src;
            }
            else {
                throw new Error("Only local plugins are supported in the workspace manager.");
            }
            config = parsePluginCode(code, {});
            switch (config.type) {
                case "web-worker":
                    // create an inline webworker from /hypha-app-webworker.js
                    const worker = new Worker(self.baseUrl + "hypha-app-webworker.js");
                    const clientId = "client-" + Date.now();
                    const workspace = this.id;
                    this.connections[this.id + "/" + clientId] = {
                        workspace: workspace,
                        websocket: null,
                        postMessage: (data) => {
                            worker.postMessage(data);
                        }
                    }
                    worker.postMessage({
                        type: "initializeHyphaClient",
                        server_url: this.serverUrl,
                        workspace,
                        client_id: clientId,
                        config,
                    });
                    worker.onmessage = this.messageHandler;
                    return await this.waitForClient(this.id + "/" + clientId, 20000);
                case "window":
                    return await create_window(config, context);
                case "iframe":
                    return await create_window(config, context);
                case "web-python":
                    // create an inline webworker from /hypha-app-webpython.js
                    const worker2 = new Worker(self.baseUrl + "hypha-app-webpython.js");
                    const clientId2 = "client-" + Date.now();
                    const workspace2 = this.id;
                    this.connections[this.id + "/" + clientId2] = {
                        workspace: workspace2,
                        websocket: null,
                        postMessage: (data) => {
                            worker2.postMessage(data);
                        }
                    }
                    return new Promise((resolve, reject) => {
                        // TODO: handle timeout
                        worker2.onmessage = (event) => {
                            // check if it's ready
                            if (event.data.type === "hyphaClientReady") {
                                setTimeout(() => {
                                    worker2.postMessage({
                                        type: "initializeHyphaClient",
                                        server_url: this.serverUrl,
                                        workspace: workspace2,
                                        client_id: clientId2,
                                        config,
                                    });
                                    worker2.onmessage = this.messageHandler;
                                    this.waitForClient(this.id + "/" + clientId2, 20000).then(resolve).catch(reject);
                                }, 10);
                            }
                        }
                    })

                default:
                    throw new Error("Unsupported plugin type: " + config.type);

            }

        }
        const default_services = {
            "id": "default",
            "name": "Default workspace management service",
            "description": "Services for managing workspace.",
            "config": {
                "require_context": true,
                "workspace": config.workspace,
                "visibility": "public",
            },
            "emit": async (type, data, context) => {
                await this.eventBus.emit(type, data);
            },
            "on": (event, handler, context) => {
                this.eventBus.on(event, handler);
            },
            "off": (event, handler, context) => {
                this.eventBus.off(event, handler);
            },
            "echo": (msg, context) => {
                return msg;
            },
            "alert": (msg, context) => {
                alert(msg);
            },
            "confirm": (msg, context) => {
                return confirm(msg);
            },
            "prompt": (msg, default_value, context) => {
                return prompt(msg, default_value);
            },
            "showProgress": (progress, context) => {
                console.log("showProgress", progress);
            },
            "showMessage": (msg, context) => {
                console.log(msg);
            },
            "log": (msg, context) => {
                console.log(msg);
            },
            "info": (msg, context) => {
                console.info(msg);
            },
            "error": (msg, context) => {
                console.error(msg);
            },
            "warning": (msg, context) => {
                console.warn(msg);
            },
            "critical": (msg, context) => {
                console.error(msg);
            },
            "update_client_info": async (info, context) => {
                const cid = this.id + "/" + info.id;
                info.id = cid;
                info.workspaceObj = this;
                Workspace.clients[cid] = Object.assign(Workspace.clients[cid] || {}, info);
                await this.eventBus.emit("client_info_updated", info);
            },
            "get_connection_info": get_connection_info,
            "getConnectionInfo": get_connection_info,
            "register_service": register_service,
            "registerService": register_service,
            "get_service": get_service,
            "getService": get_service,
            "generate_token": generate_token,
            "generateToken": generate_token,
            "loadPlugin": load_plugin,
            "createWindow": create_window,
            "getPlugin": get_plugin,
        }
        await rpc.register_service(Object.assign(default_services, config.default_services || {}))
        this.rpc = rpc;
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


class WebsocketRPCConnection {
    constructor(clients, clientId, workspace, userInfo, timeout = 60) {
        this._clients = clients;
        this._clientId = clientId;
        this._handle_message = null;
        this._reconnection_token = null;
        this._timeout = timeout * 1000; // converting to ms
        this.workspace = workspace;
        this.userInfo = userInfo;
    }

    register_socket(websocket) {
        websocket.on('message', data => {
            const decoder = new Decoder();
            const unpacker = decoder.decodeMulti(data);

            const { value: message, done } = unpacker.next(); // Only unpack the main message
            const targetId = message.to.includes('/') ? message.to.split('/')[1] : message.to;
            if (targetId === this._clientId) {
                this._handle_message(data.buffer);
            }
            else {
                this.emit_message(data);
            }

        });
    }

    set_reconnection_token(token) {
        this._reconnection_token = token;
    }

    on_message(handler) {
        assert(handler, "handler is required");
        this._handle_message = handler;
    }

    async emit_message(data) {
        assert(this._handle_message, "No handler for message");
        // Assuming `data` is an ArrayBuffer or Uint8Array containing your msgpack-encoded data
        const decoder = new Decoder();
        const unpacker = decoder.decodeMulti(data);

        const { value: message, done } = unpacker.next(); // Only unpack the main message
        // Assuming `this.workspace` and `this.clientId` are available in your context
        // and represent `_workspace` and `_client_id` from the Python code respectively
        let targetId = message.to;
        if (!targetId.includes("/")) {
            targetId = `${this.workspace}/${targetId}`;
        }
        if (!this._clients[targetId]) {
            console.error('No client found for targetId:', targetId);
            return
        }
        const websocket = this._clients[targetId].socket;
        if (!message.from.includes('/')) {
            message.from = `${this.workspace}/${message.from}`;
        }
        // Update the message with new fields
        const updatedMessage = {
            ...message,
            to: targetId,
            from: message.from,
            user: this.userInfo, // Assuming `this.userInfo` represents `_user_info` from Python
        };
        // Re-encode the updated message
        const encodedUpdatedMessage = msgpack_packb(updatedMessage);

        // Assuming `pos` is the position where the original main message ended
        // and there's additional data in `data` that should be appended after the updated message
        const pos = decoder.pos; // Equivalent to unpacker.tell() in Python
        const remainingData = data.slice(pos); // Get remaining data after the main message
        const finalData = new Uint8Array(encodedUpdatedMessage.length + remainingData.length);
        // Combine the updated message and any remaining data into `finalData`
        finalData.set(encodedUpdatedMessage, 0);
        finalData.set(new Uint8Array(remainingData), encodedUpdatedMessage.length);
        if (!websocket || !websocket.send) {
            console.error('No websocket found for targetId:', targetId);
            return
        }
        websocket.send(finalData.buffer);
    }

    disconnect(reason) {
        console.info(`Websocket connection disconnected (${reason})`);
    }
}

const AUTH0_NAMESPACE = "https://api.imjoy.io/"
export class HyphaServer extends MessageEmitter {
    static servers = {};

    constructor(config) {
        super();
        config = config || {};
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
        this.connections = {};
        this.defaultServices = config.default_services || {};
        this.imjoyPluginWindows = new Map();

        // register the default event
        this.on("add_window", (config) => {
            console.log("Creating window: ", config);
        });
        this._start();
    }

    async emit(event, data) {
        this._fire(event, data);
    }

    _handleImJoyPlugin(event) {
        const contentWindow = event.source;
        const data = event.data;
        // use event.source to find the client id using this.connections(an object)
        let cid = null;
        for (const [key, value] of Object.entries(this.connections)) {
            if (value.contentWindow === contentWindow) {
                cid = key;
                break;
            }
        }
        if (!cid) {
            console.error("Client id not found for the plugin: ", data);
            return;
        }
        const workspaceObj = Workspace.workspaces[this.connections[cid].workspace];
        const defaultService = workspaceObj.get_default_service()
        // TODO: For each core interface function, we need to bind to a fixed context
        // currently each coreInterface takes the last arguments as context
        // We need to fix it to {from: `${cid}`, to: `${this.connections[cid].workspace}/${workspace-manager}`} for each call
        const coreInterface = {};
        for (const key in defaultService) {
            if (typeof defaultService[key] === "function") {
                coreInterface[key] = async (...args) => {
                    return await defaultService[key](...args, { from: `${cid}`, to: `${this.connections[cid].workspace}/workspace-manager` });
                }
            }
            else {
                coreInterface[key] = defaultService[key];
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
        const core = new imjoyRPC.RPC(coreConnection, { name: "core" });
        core.setInterface(coreInterface);
        core.on("interfaceSetAsRemote", () => {
            core.on("remoteReady", async () => {
                const api = core.getRemote();
                api.id = `${cid}:default`;
                await workspaceObj.eventBus.emit("client_info_updated", {
                    id: cid,
                    imjoyApi: api,
                })
            });
            core.requestRemote();
        });
        core.sendInterface();
    }

    _handleClientMessage(event) {
        const workspace = event.data.workspace;
        if (!workspace) {
            // imjoy compatible
            if (event.data.type === "initialized") {
                this._handleImJoyPlugin(event);
            }
            else if (this.imjoyPluginWindows.has(event.source)) {
                const coreConnection = this.imjoyPluginWindows.get(event.source).coreConnection;
                coreConnection.fire(event.data);
            }
            else if (event.data.type === "hyphaClientReady") {
            }
            else {
                console.debug("Ignoring message without workspace info: ", event.data);
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

    _start() {
        if (HyphaServer.servers[this.url]) {
            throw new Error(`Server already running at ${this.url}`);
        }
        else {
            this.server = new Server(this.wsUrl, { mock: false });
            HyphaServer.servers[this.url] = this.server;
            this.messageHandler = this._handleClientMessage.bind(this);
            window.addEventListener("message", this.messageHandler);
        }
        this.server.on('connection', async socket => {
            const url = socket.url;
            // parse the url queries (? or #) from url and store it as a config object
            const config = {};
            const queries = url.split("?").length > 1 ? url.split("?")[1].split("&") : [];
            queries.forEach(query => {
                const [key, value] = query.split("=");
                config[key] = value;
            });
            let userInfo;
            if (config.token) {
                if (Workspace.tokens[config.token]) {
                    const ws = Workspace.tokens[config.token].workspace;
                    config.workspace = ws.id;
                    // TODO: fix user info
                    userInfo = {
                        id: ws.id,
                        is_anonymous: true,
                        email: "",
                    }
                }
                else {
                    const info = parseJwt(config.token)
                    const expiresAt = info["exp"]
                    userInfo = {
                        id: info["sub"],
                        is_anonymous: !info[AUTH0_NAMESPACE + "email"],
                        email: info[AUTH0_NAMESPACE + "email"],
                        parent: info["parent"],
                        roles: info[AUTH0_NAMESPACE + "roles"],
                        scopes: info["scopes"],
                        expires_at: expiresAt,
                    }
                }
            }
            else {
                userInfo = {
                    id: "anonymous",
                    is_anonymous: true,
                    email: "anonymous@imjoy.io",
                }
            }
            if (!config.workspace) {
                config.workspace = "workspace-" + randId();
            }

            const ws = await Workspace.get({
                "default_services": this.defaultServices,
                "base_url": this.baseUrl,
                "server_url": this.url,
                "message_handler": this.messageHandler,
                "connections": this.connections,
                "event_bus": this,
                "workspace": config.workspace,
                "token": config.token,
                "name": "workspace-manager",
                "user_info": userInfo,
                "client_id": "workspace-manager",
                "method_timeout": 60,
            });

            ws.connection.register_socket(socket);
            // register clients
            Workspace.clients[ws.id + "/" + config.client_id] = {
                id: ws.id + "/" + config.client_id,
                socket: socket,
                parent: userInfo.parent_client,
                workspace: config.workspace,
                user_info: userInfo,
                workspaceObj: ws,
            };

        });
    }

    reset() {
        this.close();
        this._start();
    }

    close() {
        for (const ws of Object.values(Workspace.workspaces)) {
            ws.eventBus.off("client_info_updated");
        }
        window.removeEventListener("message", this.messageHandler);
        this.server.stop();
        delete HyphaServer.servers[this.server.url];
    }
}
