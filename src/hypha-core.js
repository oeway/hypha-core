import { Server, WebSocket } from 'mock-socket';
import { hyphaWebsocketClient, imjoyRPC } from 'imjoy-rpc';
import { randId, assert, MessageEmitter, parsePluginCode, WebsocketRPCConnection } from './utils';

const connectToServer = hyphaWebsocketClient.connectToServer;
const AUTH0_NAMESPACE = "https://api.imjoy.io/";

const defaultServices = {
    "id": "default",
    "name": "Default workspace management service",
    "description": "Services for managing workspace.",
    "config": {
        "require_context": true,
        "visibility": "public",
    },
    "emit": async (type, data, context) => {
        const workspaceId = context.to.split('/')[0];
        const workspaceObj = Workspace.workspaces[workspaceId];
        await workspaceObj.eventBus.emit(type, data);
    },
    "on": (event, handler, context) => {
        const workspaceId = context.to.split('/')[0];
        const workspaceObj = Workspace.workspaces[workspaceId];
        workspaceObj.eventBus.on(event, handler);
    },
    "off": (event, handler, context) => {
        const workspaceId = context.to.split('/')[0];
        const workspaceObj = Workspace.workspaces[workspaceId];
        workspaceObj.eventBus.off(event, handler);
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
    "show_progress": (progress, context) => {
        console.log("showProgress", progress);
    },
    "showMessage": (msg, context) => {
        console.log(msg);
    },
    "show_message": (msg, context) => {
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
        const workspaceId = context.to.split('/')[0];
        const workspaceObj = Workspace.workspaces[workspaceId];
        const cid = workspaceObj.id + "/" + info.id;
        info.id = cid;
        info.workspaceObj = workspaceObj;
        Workspace.clients[cid] = Object.assign(Workspace.clients[cid] || {}, info);
        await workspaceObj.eventBus.emit("client_info_updated", info);
    },
    "get_connection_info": async (context) => {
        const workspaceId = context.to.split('/')[0];
        const workspaceObj = Workspace.workspaces[workspaceId];
        return {
            "workspace": workspaceObj.id,
            "reconnection_token": "",
            "reconnection_expires_in": 36000,
        };
    },
    "register_service": async (service, context) => {
        const workspaceId = context.to.split('/')[0];
        const workspaceObj = Workspace.workspaces[workspaceId];
        const sv = await workspaceObj.rpc.get_remote_service(context["from"] + ":built-in");
        service["config"] = service["config"] || {};
        service["config"]["workspace"] = workspaceObj.id;
        service = await sv.register_service(service);
        assert(!service["id"].includes("/"), "Service id must not contain '/'");
        service["id"] = workspaceObj.id + "/" + service["id"];
        return service;
    },
    "get_service": async (query, context) => {
        const workspaceId = context.to.split('/')[0];
        const workspaceObj = Workspace.workspaces[workspaceId];
        return workspaceObj.getService(query, context);
    },
    "generate_token": async (context) => {
        const workspaceId = context.to.split('/')[0];
        const workspaceObj = Workspace.workspaces[workspaceId];
        const token = randId();
        Workspace.tokens[token] = {
            "workspace": workspaceObj,
        };
        return token;
    },
    "loadPlugin": async (config, context) => {
        const workspaceId = context.to.split('/')[0];
        const workspaceObj = Workspace.workspaces[workspaceId];
        return workspaceObj.loadPlugin(config, context);
    },
    "load_plugin": async (config, context) => {
        const workspaceId = context.to.split('/')[0];
        const workspaceObj = Workspace.workspaces[workspaceId];
        return workspaceObj.loadPlugin(config, context);
    },
    "createWindow": async (config, context) => {
        const workspaceId = context.to.split('/')[0];
        const workspaceObj = Workspace.workspaces[workspaceId];
        return workspaceObj.createWindow(config, context);
    },
    "create_window": async (config, context) => {
        const workspaceId = context.to.split('/')[0];
        const workspaceObj = Workspace.workspaces[workspaceId];
        return workspaceObj.createWindow(config, context);
    },
    "getPlugin": async (config, context) => {
        const workspaceId = context.to.split('/')[0];
        const workspaceObj = Workspace.workspaces[workspaceId];
        return workspaceObj.getPlugin(config, context);
    },
    "get_plugin": async (config, context) => {
        const workspaceId = context.to.split('/')[0];
        const workspaceObj = Workspace.workspaces[workspaceId];
        return workspaceObj.getPlugin(config, context);
    },
};

class Workspace {
    static workspaces = {};
    static tokens = {};
    static clients = {};

    constructor(hyphaServer) {
        this.eventBus = hyphaServer;
        this.connections = hyphaServer.connections;
        this.serverUrl = hyphaServer.url;
        this.baseUrl = hyphaServer.baseUrl;
        this.messageHandler = hyphaServer.messageHandler;
    }

    static async get(hyphaServer, config) {
        if (!Workspace.workspaces[config.workspace]) {
            Workspace.workspaces[config.workspace] = new Workspace(hyphaServer);
            await Workspace.workspaces[config.workspace].setup(config);
        }
        return Workspace.workspaces[config.workspace];
    }

    waitForClient(cid, timeout) {
        return new Promise((resolve, reject) => {
            const handler = (info) => {
                if (info.id === cid && info.error) {
                    clearTimeout(timeoutId);
                    reject(new Error(info.error));
                } else if (info.id === cid && info.imjoyApi) {
                    clearTimeout(timeoutId);
                    resolve(info.imjoyApi);
                    return;
                } else if (info.id === cid && info.services) {
                    const defaultService = info.services.find(s => s.id.endsWith(":default"));
                    if (defaultService) {
                        clearTimeout(timeoutId);
                        this.rpc.get_remote_service(defaultService.id).then(async (svc) => {
                            try {
                                await this.eventBus.emit("client_ready", svc);
                                resolve(svc);
                            } catch (e) {
                                reject(e);
                            }
                        });
                    } else {
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
        assert(config.workspace, "workspace is required");
        this.id = config.workspace;
        this.connection = new WebsocketRPCConnection(
            Workspace.clients,
            "workspace-manager",
            config.workspace,
            config.user_info,
            config.method_timeout || 60
        );
        this.plugins = {};
        this.eventBus.on("client_ready", async (svc) => {
            this.plugins[svc.id] = svc;
        });

        const rpc = new hyphaWebsocketClient.RPC(this.connection, {
            client_id: "workspace-manager",
            default_context: { connection_type: "websocket" },
            name: config.name,
            method_timeout: config.method_timeout,
            workspace: config.workspace,
        });

        await rpc.register_service(Object.assign(defaultServices, config.default_services || {}));
        this.rpc = rpc;
    }

    async getService(query, context = null) {
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
            let workspace = query["workspace"] || this.id;
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
            const serviceApi = await this.getServiceById(query.service_id, query.client_id, query.workspace);
            return serviceApi;
        } else {
            throw new Error("Wildcard service not supported yet");
        }
    }

    async getServiceById(serviceId, clientId = "*", workspace = "*") {
        for (const client of Object.values(Workspace.clients)) {
            const ws = client.workspaceObj;
            for (const service of client.services) {
                const [ci, si] = service.id.split(":");

                if (clientId === "*" && workspace === "*") {
                    const serviceApi = await ws.rpc.get_remote_service(`${client.id}:${serviceId}`);
                    return this.patchServiceConfig(ws, serviceApi);
                }

                if (clientId === "*" && si === serviceId) {
                    const serviceApi = await ws.rpc.get_remote_service(`${client.id}:${serviceId}`);
                    return this.patchServiceConfig(ws, serviceApi);
                }

                if (workspace === "*" && ci === clientId && si === serviceId) {
                    const serviceApi = await ws.rpc.get_remote_service(service.id);
                    return this.patchServiceConfig(ws, serviceApi);
                }

                if (ci === clientId && si === serviceId) {
                    const serviceApi = await ws.rpc.get_remote_service(service.id);
                    return this.patchServiceConfig(ws, serviceApi);
                }
            }
        }

        throw new Error(`Service with id ${serviceId} not found`);
    }

    patchServiceConfig(workspace, serviceApi) {
        serviceApi.config = serviceApi.config || {};
        serviceApi.config.workspace = workspace.id;
        return serviceApi;
    }

    async createWindow(config, context) {
        let elem;
        const clientId = "client-" + Date.now();
        this.connections[this.id + "/" + clientId] = {
            workspace: this.id,
            websocket: null,
            postMessage: (data) => {
                elem.contentWindow.postMessage(data);
            },
        };

        if (config.type === "iframe") {
            elem = document.createElement("iframe");
            elem.src = config.src;
            elem.id = config.window_id || "window-" + Date.now();
            elem.style.width = config.width || "100%";
            elem.style.height = config.height || "100%";
            elem.style.display = "none";
            document.body.appendChild(elem);
        } else if (config.window_id) {
            elem = document.getElementById(config.window_id);
            if (!elem) {
                throw new Error("Window element not found: " + config.window_id);
            }
        } else {
            config.window_id = "window-" + Date.now();
            config.workspace = this.id;
            await this.eventBus.emit("add_window", config);
            await new Promise((resolve) => setTimeout(resolve, 0));
            elem = document.getElementById(config.window_id);
            if (!elem) {
                throw new Error(`iframe element not found ${config.window_id} in ${9 * 500 / 1000} s`);
            }
            if (elem.tagName !== "IFRAME") {
                throw new Error("iframe element must be an iframe: " + config.window_id);
            }
        }

        this.connections[this.id + "/" + clientId].contentWindow = elem.contentWindow;
        let waitClientPromise;

        if (!config.passive) {
            waitClientPromise = this.waitForClient(this.id + "/" + clientId, 180000);
        }

        await new Promise((resolve, reject) => {
            elem.onload = resolve;
            elem.onerror = reject;
        });

        if (config.passive) {
            delete this.connections[this.id + "/" + clientId];
            return;
        }

        elem.contentWindow.postMessage({
            type: "initializeHyphaClient",
            server_url: this.serverUrl,
            client_id: clientId,
            workspace: this.id,
            config,
        });

        const svc = await waitClientPromise;
        if (svc.setup) {
            await svc.setup();
        }
        if (svc.run && config) {
            await svc.run({ data: config.data, config: config.config });
        }
        return svc;
    }

    async loadPlugin(config, context) {
        let code;
        const src = config.src;
        if (src.startsWith("http") && !src.split("?")[0].endsWith(".imjoy.html")) {
            return await this.createWindow(config, context);
        }

        if (src.startsWith("http")) {
            const resp = await fetch(src);
            code = await resp.text();
        } else if (src.includes("\n")) {
            code = src;
        } else {
            throw new Error("Only local plugins are supported in the workspace manager.");
        }
        config = parsePluginCode(code, {});

        switch (config.type) {
            case "web-worker":
                return this.createWorker(config, this.baseUrl + "hypha-app-webworker.js");
            case "window":
            case "iframe":
                return await this.createWindow(config, context);
            case "web-python":
                return this.createWorker(config, this.baseUrl + "hypha-app-webpython.js");
            default:
                throw new Error("Unsupported plugin type: " + config.type);
        }
    }

    createWorker(config, workerUrl) {
        const worker = new Worker(workerUrl);
        const clientId = "client-" + Date.now();
        this.connections[this.id + "/" + clientId] = {
            workspace: this.id,
            websocket: null,
            postMessage: (data) => {
                worker.postMessage(data);
            },
        };
        worker.postMessage({
            type: "initializeHyphaClient",
            server_url: this.serverUrl,
            workspace: this.id,
            client_id: clientId,
            config,
        });
        worker.onmessage = this.messageHandler;
        return this.waitForClient(this.id + "/" + clientId, 20000);
    }

    async getPlugin(config, context) {
        if (typeof config === "string") {
            return await this.loadPlugin({ src: config }, context);
        } else if (config.id) {
            return this.plugins[config.id];
        } else if (config.name) {
            for (const [key, value] of Object.entries(this.plugins)) {
                if (value.name === config.name) {
                    return value;
                }
            }
        } else {
            throw new Error("Please provide either id or name for the plugin");
        }
    }
}

class HyphaServer extends MessageEmitter {
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
        const defaultService = workspaceObj.get_default_service();
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
                });
            });
            core.requestRemote();
        });
        core.sendInterface();
    }

    _handleClientMessage(event) {
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
                    userInfo = { id: ws.id, is_anonymous: true, email: "" };
                } else {
                    const info = parseJwt(config.token);
                    const expiresAt = info["exp"];
                    userInfo = {
                        id: info["sub"],
                        is_anonymous: !info[AUTH0_NAMESPACE + "email"],
                        email: info[AUTH0_NAMESPACE + "email"],
                        parent: info["parent"],
                        roles: info[AUTH0_NAMESPACE + "roles"],
                        scopes: info["scopes"],
                        expires_at: expiresAt,
                    };
                }
            } else {
                userInfo = { id: "anonymous", is_anonymous: true, email: "anonymous@imjoy.io" };
            }
            if (!config.workspace) {
                config.workspace = "workspace-" + randId();
            }

            const ws = await Workspace.get(this, {
                "workspace": config.workspace,
                "token": config.token,
                "name": "workspace-manager",
                "user_info": userInfo,
                "client_id": "workspace-manager",
                "method_timeout": 60,
            });

            ws.connection.register_socket(socket);
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

function parseJwt(token) {
    var base64Url = token.split('.')[1];
    var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    var jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function (c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
}

export { HyphaServer, connectToServer, imjoyRPC, WebSocket, Workspace, WebsocketRPCConnection };
