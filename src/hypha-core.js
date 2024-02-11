import { Server, WebSocket as MockWebSocket } from 'mock-socket';
import { hyphaWebsocketClient } from 'imjoy-rpc';

import { WebsocketRPCConnection, randId, assert } from './utils'

class Workspace {
    static workspaces = {};
    static tokens = {};
    static async get(config) {
        if(!Workspace.workspaces[config.workspace]){
            Workspace.workspaces[config.workspace] = new Workspace();
            await Workspace.workspaces[config.workspace].setup(config);
        }
        return Workspace.workspaces[config.workspace];
    }

    async setup(config) {
        this.clients = {};
        assert(config.websocket, "websocket is required")
        assert(config.workspace, "workspace is required")
        this.id = config.workspace;
        let clientId = config.client_id;
        if (!clientId) {
            clientId = randId();
        }
        let connection = new WebsocketRPCConnection(
            config.websocket,
            config.workspace,
            "workspace-manager",
            config.userInfo,
            config.method_timeout || 60
        );
        const rpc = new hyphaWebsocketClient.RPC(connection, {
            client_id: "workspace-manager",
            // manager_id: "workspace-manager",
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
            // Placeholder for patching service configuration with workspace info
            serviceApi.config = serviceApi.config || {};
            serviceApi.config.workspace = workspace.id;
            return serviceApi;
        }

        async function getServiceById(serviceId, clientId, workspace) {
            const workspaces = Object.values(Workspace.workspaces);
            if(!workspace || workspace === "*"){
                for (let i = 0; i < workspaces.length; i++) {
                    const ws = workspaces[i];
                    for(const key in ws.clients){
                        for(const svc of ws.clients[key].services){
                            const [ci, si] = svc.id.split(":");
                            if((clientId==="*" && si === serviceId) || (clientId !== "*" && ci === clientId && si === serviceId)){
                                const rpc = ws.rpc;
                                const serviceApi = await rpc.get_remote_service(svc.id);
                                return patchServiceConfig(ws, serviceApi);
                            }
                        }
                    }
                }
            }
            else{
                const ws = workspaces[i];
                for(const key in ws.clients){
                    for(const svc of ws.clients[key].services){
                        const [ci, si] = svc.id.split(":");
                        if((clientId==="*" && si === serviceId) || (clientId !== "*" && ci === clientId && si === serviceId)){
                            const rpc = ws.rpc;
                            const serviceApi = await rpc.get_remote_service(svc.id);
                            return patchServiceConfig(ws, serviceApi);
                        }
                    }
                }
            }
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
                this.clients[info.id] = info;
                console.log("update_client_info:", info);
            },
            "get_connection_info": get_connection_info,
            "getConnectionInfo": get_connection_info,
            "register_service": register_service,
            "registerService": register_service,
            "get_service": get_service,
            "getService": get_service,
            "generate_token": generate_token,
            "generateToken": generate_token,
        })
        this.rpc = rpc;
    }

}

export default class HyphaCore {
    constructor() {
        this.server = new Server('ws://localhost:8080/ws', {mock: true});
        this.server.on('connection', async socket => {
            const url = socket.url;
            // parse the url queries (? or #) from url and store it as a config object
            const config = {};
            const queries = url.split("?")[1].split("&");
            queries.forEach(query => {
                const [key, value] = query.split("=");
                config[key] = value;
            });
            if(config.token){
                assert(Workspace.tokens[config.token], "Invalid token")
                config.workspace = Workspace.tokens[config.token].workspace.id;
            }
            if(!config.workspace){
                config.workspace = "workspace-" + randId();
            }
            const ws = await Workspace.get({
                "websocket": socket,
                "workspace": config.workspace,
                "token": config.token,
                "name": "workspace-manager",
                "userInfo": {},
            });

            console.log(`new connection from ${config.workspace} with token ${config.token}`)
            console.log(ws);

        });
    }
    
    async initialize(){
        const server1 = await hyphaWebsocketClient.connectToServer({"server_url": "http://localhost:8080"})
        
        await server1.log("hi-server1")
        const token = await server1.generateToken();
        const server2 = await hyphaWebsocketClient.connectToServer({"server_url": "http://localhost:8080"})
        await server2.log("hi-server2")
        
        assert(await server1.echo("hello") === "hello", "echo failed")

        await server1.registerService({
            "id": "hello-world",
            "name": "Hello World",
            "description": "A simple hello world service",
            "config": {
                "visibility": "public",
                "require_context": false,
            },
            "hello": (name) => {
                return `Hello ${name}!`;
            },
        })

        const svc = await server2.getService("hello-world")
        const ret = await svc.hello("John")
        assert(ret === "Hello John!", "hello failed")
        console.log("hello-world service successfully tested:", svc);
    }
}