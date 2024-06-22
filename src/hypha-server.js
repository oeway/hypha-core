import { Server, WebSocket } from 'mock-socket';
import { hyphaWebsocketClient } from 'imjoy-rpc';
import { WebsocketRPCConnection, randId, assert, MessageEmitter, parsePluginCode } from './utils'

const connections = {};

function handleClientMessage(event){
    const clientId = event.data.from;
    if(!clientId || !connections[clientId]){
        console.warn("Connection not found for client: ", clientId);
        return;
    }
    const connection = connections[clientId];
    const ws = connection.websocket;
    if(event.data.type === "message"){
        ws.send(event.data.data);
    }
    else if(event.data.type === "close"){
        ws.close();
    }
    else if(event.data.type === "executeSuccess"){
        if(connection.onExecuteSuccess){
            connection.onExecuteSuccess();
        }
        else{
            console.log(`Script executed successfully for client: ${clientId}`);
        }
    }
    else if(event.data.type === "executeError"){
        if(connection.onExecuteError){
            connection.onExecuteError(event.data.error);
        }
        else{
            console.error(`Script execution failed for client: ${clientId}, error message: ${event.data.error}`);
        }
    }
    else if(event.data.type === "connect"){
        const ws = new WebSocket(event.data.url);
        ws.onmessage = (evt) => {
            connection.postMessage({type: "message", data: evt.data, to: clientId});
        }
        ws.onopen = () => {
            connection.postMessage({type: "connected", to: clientId});
        }
        ws.onclose = () => {
            connection.postMessage({type: "closed", to: clientId});
        }
        connection.websocket = ws;
    }
}
window.addEventListener("message", handleClientMessage);

function waitForClient(workspace, clientId){
    return new Promise((resolve, reject) => {
        const handler = (info) => {
            if(info.id === (workspace.id + "/" + clientId) && info.services){
                // check if there is a service with id ends with ":default"
                const defaultService = info.services.find(s => s.id.endsWith(":default"));
                if(defaultService){
                    clearTimeout(timeoutId); // clear the timeout
                    workspace.rpc.get_remote_service(defaultService.id).then(async (svc)=>{
                        try{
                            resolve(svc);
                        }
                        catch(e){
                            reject(e);
                        } 
                    });
                }
                else{
                    console.error("No default service found in the iframe client: ", clientId);
                    reject("No default service found in the iframe client: " + clientId);
                }
            }
        }
        let timeoutId = setTimeout(() => {
            workspace.eventBus.off("client_info_updated", handler);
            reject(new Error("Timeout after 20 seconds"));
        }, 20000);
        
        connections[clientId].onExecuteError = (error) => {
            clearTimeout(timeoutId); // clear the timeout
            reject(new Error("Error while executing the script: " + error));
        }
        workspace.eventBus.on("client_info_updated", handler);
    });
}

class Workspace {
    static workspaces = {};
    static tokens = {};
    static clients = {};
    static async get(config) {
        if(!Workspace.workspaces[config.workspace]){
            Workspace.workspaces[config.workspace] = new Workspace();
            await Workspace.workspaces[config.workspace].setup(config);
        }
        return Workspace.workspaces[config.workspace];
    }

    async setup(config) {
        assert(config.workspace, "workspace is required")
        this.eventBus = config.event_bus;
        this.id = config.workspace;
        // let clientId = config.client_id;
        // if (!clientId) {
        //     clientId = randId();
        // }
        this.connection = new WebsocketRPCConnection(
            Workspace.clients,
            "workspace-manager",
            config.workspace,
            config.user_info,
            config.method_timeout || 60
        );
        
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
                        debugger
                        const serviceApi = await ws.rpc.get_remote_service(`${client.id}:${serviceId}`);
                        return patchServiceConfig(ws, serviceApi);
                    }

                    // If only clientId is "*", match any client with the given serviceId
                    if (clientId === "*" && si === serviceId) {
                        debugger
                        const serviceApi = await ws.rpc.get_remote_service(`${client.id}:${serviceId}`);
                        return patchServiceConfig(ws, serviceApi);
                    }

                    // If only workspace is "*", match any workspace with the given clientId and serviceId
                    if (workspace === "*" && ci === clientId && si === serviceId) {
                        debugger
                        const serviceApi = await ws.rpc.get_remote_service(service.id);
                        return patchServiceConfig(ws, serviceApi);
                    }

                    // If neither are "*", match the exact clientId and serviceId
                    if (ci === clientId && si === serviceId) {
                        debugger
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
        
        await rpc.register_service({
            "id": "default",
            "name": "Default workspace management service",
            "description": "Services for managing workspace.",
            "config": {
                "require_context": true,
                "workspace": config.workspace,
                "visibility": "public",
            },
            "echo": (msg, context) => {
                return msg;
            },
            "alert": (msg, context) => {
                alert(msg);
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
            "update_client_info": (info, context) => {
                const cid = this.id + "/" + info.id;
                info.id = cid;
                info.workspaceObj = this;
                Workspace.clients[cid] = Object.assign(Workspace.clients[cid] || {}, info);
                this.eventBus.emit("client_info_updated", info);
            },
            "get_connection_info": get_connection_info,
            "getConnectionInfo": get_connection_info,
            "register_service": register_service,
            "registerService": register_service,
            "get_service": get_service,
            "getService": get_service,
            "generate_token": generate_token,
            "generateToken": generate_token,
            "loadPlugin": async (src, context) => {
                let code;
                if(src.startsWith("http")){
                    // fetch the plugin code
                    const resp = await fetch(src);
                    code = await resp.text();
                }
                else if(src.includes("\n")){
                    code = src;
                }
                else{
                    throw new Error("Only local plugins are supported in the workspace manager.");
                }
                config = parsePluginCode(code, {});
                switch(config.type){
                    case "web-worker":
                        // create an inline webworker from /hypha-webworker.js
                        const worker = new Worker("/hypha-webworker.js");
                        const clientId = "client-" + Date.now();
                        const workspace = context.to.split(":")[0].split("/")[0];
                        connections[clientId] = {
                            websocket: null,
                            postMessage: (data) => {
                                worker.postMessage(data);
                            }
                        }
                        worker.postMessage({
                            type: "initializeHyphaClient",
                            server_url: "http://localhost:8080",
                            workspace,
                            client_id: clientId,
                            config,
                        });
                        worker.onmessage = handleClientMessage;
                        return await waitForClient(this, clientId);
                    case "window":
                        return await this.createWindow(config, context);
                }

            },
            "createWindow": async (config, context) => {
                if(!config.src && !config.src.startsWith('http') && !config.src.includes("\n")){
                    throw new Error("Invalid window source.");
                }
                if(config.src.startsWith('http') && config.src.split("?")[0].endsWith(".imjoy.html")){
                    // fetch the plugin code
                    const resp = await fetch(config.src);
                    const code = await resp.text();
                    const pluginConfig = parsePluginCode(code, {});
                    if(pluginConfig.type !== "window"){
                        throw new Error("Invalid window plugin type: " + pluginConfig.type);
                    }
                    config = Object.assign(config, pluginConfig);
                    config.src = "/hypha-iframe.html";
                }
                let elem;
                if(config.window_id){
                    elem = document.getElementById(config.window_id);
                    if(!elem){
                        throw new Error("Window element not found: " + config.window_id);
                    }
                }
                else{
                    config.window_id = "window-" + Date.now();
                    await this.eventBus.emit("add_window", config);
                    elem = document.getElementById(config.window_id);
                }
                const workspace = context.to.split(":")[0].split("/")[0];
                const clientId = "client-" + Date.now();
                console.log("Creating window for workspace: ", workspace, " with client id: ", clientId);
                // wait until the iframe is loaded
                await new Promise((resolve) => {
                    elem.onload = resolve;
                });
                
                connections[clientId] = {
                    websocket: null,
                    postMessage: (data) => {
                        elem.contentWindow.postMessage(data);
                    },
                }
                elem.contentWindow.postMessage({
                    type: "initializeHyphaClient",
                    server_url: "http://localhost:8080",
                    client_id: clientId,
                    workspace,
                    config,
                });
                if(config.passive)
                    return;
                const svc = await waitForClient(this, clientId);
                if(svc.setup){
                    await svc.setup();
                }
                if(svc.run && config){
                    await svc.run({
                        data: config.data,
                        config: config.config,
                    });
                }
                return svc;
            }
        })
        this.rpc = rpc;
    }

}

function parseJwt (token) {
    var base64Url = token.split('.')[1];
    var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    var jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
}

const AUTH0_NAMESPACE = "https://api.imjoy.io/"
export default class HyphaServer extends MessageEmitter {
    static servers = {};
    constructor(port) {
        super();
        this.uri = "ws://localhost:" + port + "/ws";
        this.server = null;

        // register the default event
        this.on("add_window", (config)=> {
            console.log("Adding window: ", config);
        });
    }

    async emit(event, data) {
        this._fire(event, data);
    }

    start(){
        if(HyphaServer.servers[this.uri]){
            throw new Error(`Server already running at ${this.uri}`);
        }
        else{
            this.server = new Server(this.uri, {mock: false});
            HyphaServer.servers[this.uri] = this.server;
        }
        this.server.on('connection', async socket => {
            const url = socket.url;
            // parse the url queries (? or #) from url and store it as a config object
            const config = {};
            const queries = url.split("?")[1].split("&");
            queries.forEach(query => {
                const [key, value] = query.split("=");
                config[key] = value;
            });
            let userInfo;
            if(config.token){
                if(Workspace.tokens[config.token]){
                    const ws = Workspace.tokens[config.token].workspace;
                    config.workspace = ws.id;
                    // TODO: fix user info
                    userInfo = {
                        id: ws.id,
                        is_anonymous: true,
                        email: "",
                    }
                }
                else{
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
            else{
                userInfo = {
                    id: "anonymous",
                    is_anonymous: true,
                    email: "anonymous@imjoy.io",
                }
            }
            if(!config.workspace){
                config.workspace = "workspace-" + randId();
            }
            
            const ws = await Workspace.get({
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

    reset(){
        this.close();
        this.start();
    }
    
    close(){
        this.server.stop();
        delete HyphaServer.servers[this.server.uri];
    }
}