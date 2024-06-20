import { Server, WebSocket as MockWebSocket } from 'mock-socket';
import { hyphaWebsocketClient } from 'imjoy-rpc';

import { WebsocketRPCConnection, randId, assert } from './utils'

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
            // Placeholder for patching service configuration with workspace info
            serviceApi.config = serviceApi.config || {};
            serviceApi.config.workspace = workspace.id;
            serviceApi.hello.__rpc_object__._rtarget = workspace.id + "/" + serviceApi.hello.__rpc_object__._rtarget
            return serviceApi;
        }

        async function getServiceById(serviceId, clientId, workspace) {
            const workspaces = Object.values(Workspace.workspaces);
            if(!workspace || workspace === "*"){
                for(const key in Workspace.clients){
                    for(const svc of Workspace.clients[key].services){
                        const [ci, si] = svc.id.split(":");
                        if((clientId==="*" && si === serviceId) || (clientId !== "*" && ci === clientId && si === serviceId)){
                            const rpc = ws.rpc;
                            const serviceApi = await rpc.get_remote_service(svc.id);
                            return patchServiceConfig(ws, serviceApi);
                        }
                    }
                }
            }
            else{
                const ws = workspaces.find(w => w.id === workspace);
                const serviceApi = await ws.rpc.get_remote_service(`${workspace}/${clientId}:${serviceId}`);
                return patchServiceConfig(ws, serviceApi);
                // for(const key in ws.clients){
                //     for(const svc of ws.clients[key].services){
                //         const [ci, si] = svc.id.split(":");
                //         if((clientId==="*" && si === serviceId) || (clientId !== "*" && ci === clientId && si === serviceId)){
                //             const rpc = ws.rpc;
                //             const serviceApi = await rpc.get_remote_service(svc.id);
                //             return patchServiceConfig(ws, serviceApi);
                //         }
                //     }
                // }
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
                const cid = this.id + "/" + info.id;
                info.id = cid;
                Workspace.clients[cid] = Object.assign(Workspace.clients[cid] || {}, info);
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

function parseJwt (token) {
    var base64Url = token.split('.')[1];
    var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    var jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
}

const AUTH0_NAMESPACE = "https://api.imjoy.io/"
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
            };

        });
    }
    
    async initialize(){
        const userToken = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Im5VVnFFeWx4WEp2bV9hSjE4YlBHbCJ9.eyJodHRwczovL2FwaS5pbWpveS5pby9yb2xlcyI6WyJhZG1pbiJdLCJodHRwczovL2FwaS5pbWpveS5pby9lbWFpbCI6Im9ld2F5MDA3QGdtYWlsLmNvbSIsImlzcyI6Imh0dHBzOi8vaW1qb3kuZXUuYXV0aDAuY29tLyIsInN1YiI6ImdpdGh1Ynw0Nzg2NjciLCJhdWQiOlsiaHR0cHM6Ly9pbWpveS5ldS5hdXRoMC5jb20vYXBpL3YyLyIsImh0dHBzOi8vaW1qb3kuZXUuYXV0aDAuY29tL3VzZXJpbmZvIl0sImlhdCI6MTcxODg3MzQzMywiZXhwIjoxNzE4OTU5ODMzLCJzY29wZSI6Im9wZW5pZCBwcm9maWxlIGVtYWlsIG9mZmxpbmVfYWNjZXNzIiwiYXpwIjoib2Zzdng2QTdMZE1oRzBoa2xyNUpDQUVhd0x2NFB5c2UifQ.U1X5DWIrQ8H0o9lBFzP9dydnGE9Ma-vCSi_H0hLviUU3ZH_327hKjI58a6XzY1OMD7Y3GxBtAKtaYolETTC3ZMD_iWqmYsGOYBU9nd9s69GqQw0GNeuzeknLZMnfUByK8LHCD96bpuPBBGlQ8T4nhdstqj-zaJ8dJcT6zvhBiMJbp7_G5HOHlXKi7M85terGSbqpV9KANsyknnj2b-QySCbS_4zXlmBtqqpX1ZE90cn8QYaIxwPkkWt6ijGFY1wwCInGR-HNbB6C_5RRljWUnbeVbj81ciZsGmmneIRy-3RuAKWIGi0I9ccCRQVfm-byLKSPVC78amzUZCkLdyPd4g";
        const server1 = await hyphaWebsocketClient.connectToServer({"server_url": "http://localhost:8080", "token": userToken, "workspace": "ws-1", "client_id": "client-1"})
        
        await server1.log("hi-server1")
        const token = await server1.generateToken();
        const server2 = await hyphaWebsocketClient.connectToServer({"server_url": "http://localhost:8080", "workspace": "ws-2", "client_id": "client-2"})
        await server2.log("hi-server2")
        
        assert(await server1.echo("hello") === "hello", "echo failed")

        const svc = await server1.registerService({
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
        const svc2 = await server2.getService(svc.id)
        const ret = await svc2.hello("John")
        assert(ret === "Hello John!", "hello failed")
        console.log("hello-world service successfully tested:", svc);
    }
}