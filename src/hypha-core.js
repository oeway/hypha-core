import { Server, WebSocket } from 'mock-socket';
import { hyphaWebsocketClient } from 'imjoy-rpc';
import { WebsocketRPCConnection, randId, assert } from './utils'

const connections = {};

window.addEventListener("message", event => {
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
    else if(event.data.type === "error"){
        ws.error();
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

});
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
        this.id = config.workspace;
        let clientId = config.client_id;
        if (!clientId) {
            clientId = randId();
        }
        this.connection = new WebsocketRPCConnection(
            Workspace.clients,
            "workspace-manager",
            config.workspace,
            config.userInfo,
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
                "client_id": clientId,
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

            function patchRtarget(obj) {
                if (Array.isArray(obj)) {
                    obj.forEach(patchRtarget);
                } else if (typeof obj === 'object' && obj !== null) {
                    for (let key in obj) {
                        if (typeof obj[key] === 'function' && obj[key].__rpc_object__) {
                            obj[key].__rpc_object__._rtarget = workspace.id + "/" + obj[key].__rpc_object__._rtarget;
                        }
                        if (typeof obj[key] === 'object' && obj[key] !== null) {
                            patchRtarget(obj[key]);
                        }
                    }
                }
            }

            patchRtarget(serviceApi);

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
                console.log('======Client info updated=======>', info);
            },
            "get_connection_info": get_connection_info,
            "getConnectionInfo": get_connection_info,
            "register_service": register_service,
            "registerService": register_service,
            "get_service": get_service,
            "getService": get_service,
            "generate_token": generate_token,
            "generateToken": generate_token,
            "createWindow": async (config, context) => {
                const elem = document.createElement("iframe");
                elem.src = config.src;
                elem.style.width = "100%";
                elem.style.height = "100%";
                elem.style.border = "none";
                const container = document.getElementById("window-container");
                const workspace = context.to.split(":")[0].split("/")[0];
                const clientId = "client-" + Date.now();
                container.appendChild(elem);
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
                });
                // return await rpc.get_remote_service(`${workspace}/${clientId}:default`);
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
export default class HyphaServer {
    static servers = {};
    constructor(port) {
        this.uri = "ws://localhost:" + port + "/ws";
        this.server = null;
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
                "workspace": config.workspace,
                "token": config.token,
                "name": "workspace-manager",
                "userInfo": userInfo,
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