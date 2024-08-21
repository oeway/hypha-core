import { randId, assert, parsePluginCode, RedisRPCConnection } from './utils';
import { hyphaWebsocketClient } from 'hypha-rpc';

// Ensure the client_id is safe
const _allowedCharacters = /^[a-zA-Z0-9-_/*]*$/;

function validateKeyPart(keyPart) {
    if (!_allowedCharacters.test(keyPart)) {
        throw new Error(`Invalid characters in query part: ${keyPart}`);
    }
}

export class Workspace {
    static workspaces = {};
    static tokens = {};
    static clients = {};

    constructor(hyphaServer) {
        this._server = hyphaServer;
        this._redis = hyphaServer.redis;
        this.connections = hyphaServer.connections;
        this.eventBus = hyphaServer;
        this.serverUrl = hyphaServer.url;
        this.baseUrl = hyphaServer.baseUrl;
    }

    waitForClient(cid, timeout) {
        return new Promise((resolve, reject) => {
            const handler = (info) => {
                const ccid = info.id.split(":")[0];
                if(ccid !== cid){
                    return;
                }
                this.eventBus.off("service_added", handler);
                if (info.type === "imjoy") {
                    clearTimeout(timeoutId);
                    resolve(info);
                    return;
                } else {
                    if(!info.id.endsWith(":default")){
                        logger.error("Unexpected service added:", info);
                        return;
                    }
                    const defaultService = info
                    clearTimeout(timeoutId);
                    this._rpc.get_remote_service(defaultService.id).then(async (svc) => {
                        try {
                            await this.eventBus.emit("client_ready", svc);
                            resolve(svc);
                        } catch (e) {
                            reject(e);
                        }
                    });
                
                }
            }
            let timeoutId = setTimeout(() => {
                this.eventBus.off("service_added", handler);
                reject(new Error(`Timeout after ${timeout / 1000} s`));
            }, timeout);
            this.eventBus.on("service_added", handler);
        });
    }

    async setup(config) {
        if(!config.client_id) {
            throw new Error("client_id is required in the config");
        }
        const workspace = "*";
        const connection = new RedisRPCConnection(
            this.eventBus, workspace, config.client_id, null, null
        )
        this.windows = [];
        this.services = {};
        this.plugins = {};
        this.eventBus.on("client_ready", async (svc) => {
            this.plugins[svc.id] = svc;
        });
        const rpc = new hyphaWebsocketClient.RPC(connection, {
            client_id: config.client_id,
            default_context: { connection_type: "websocket" },
            workspace,
            server_base_url: this.serverUrl,
            silent: false,
        });
        this._rpc = rpc;
        await rpc.register_service(Object.assign(this.getDefaultServices(), config.default_services || {}), {notify: false});

    }

    async registerService(service, context) {
        const ws = context.ws;
        const clientId = context.from;
        service.config = service.config || {};
        service.config.workspace = ws;
        if (!service.id.includes("/")) {
            service.id = `${ws}/${service.id}`;
        }
        if (!service.id.includes(":")) {
            throw new Error("Service id info must contain ':'");
        }
        service.app_id = service.app_id || "*";
        service.config.visibility = service.config.visibility || "protected";
        // Check if the service already exists
        const serviceExists = this._redis.exists(`services:*:${service.id}@${service.app_id}`);
        const key = `services:${service.config.visibility}:${service.id}@${service.app_id}`;
        for(const [k, v] of Object.entries(service)) {
            this._redis.hset(key, k, v);
        }
        if (serviceExists) {
            if (key.includes(":built-in@")) {
                this.eventBus.emit("client_updated", { id: clientId, workspace: ws });
                console.info(`Updating built-in service: ${service.id}`);
            } else {
                this.eventBus.emit("service_updated", service);
                console.info(`Updating service: ${service.id}`);
            }
        } else {
            // Default service created by api.export({}), typically used for hypha apps
            if (key.includes(":default@")) {
                try {
                    const svc = await this._rpc.get_remote_service(`${clientId}:default`);
                    if (svc.setup) {
                        await svc.setup();
                    }
                } catch (e) {
                    console.error(`Failed to run setup for default service \`${clientId}\`: ${e}`);
                }
            }
            if (key.includes(":built-in@")) {
                this.eventBus.emit("client_connected", { id: clientId, workspace: ws });
                console.info(`Adding built-in service: ${service.id}, key: ${key}`);
            } else {
                this.eventBus.emit("service_added", service);
                console.info(`Adding service ${service.id}, key: ${key}`);
            }
        }
    }
    
    async unregisterService(service, context) {
        const ws = context.ws;
        const clientId = context.from;
        service.config.workspace = ws;
        if (!service.id.includes("/")) {
            service.id = `${ws}/${service.id}`;
        }
        if (!service.id.includes(":")) {
            throw new Error("Service id info must contain ':'");
        }
        service.app_id = service.app_id || "*";
        const key = `services:${service.config.visibility}:${service.id}@${service.app_id}`;
        console.info(`Removing service: ${key}`);
    
        // Check if the service exists before removal
        const serviceExists = this._redis.exists(key);
    
        if (serviceExists) {
            this._redis.delete(key);
            if (key.includes(":built-in@")) {
                this.eventBus.emit("client_disconnected", { id: clientId, workspace: ws });
            } else {
                this.eventBus.emit("service_removed", service);
            }
        } else {
            console.warning(`Service ${key} does not exist and cannot be removed.`);
        }
    }
    

    async getService(query, {mode = "default", skipTimeout = false, timeout = 5}, context) {
        // no need to validate the context
        const ws = context.ws;
        const userInfo = context.user; // Skipping UserInfo.model_validate
    
        // Convert string query into a dictionary
        let serviceId;
        if (typeof query === 'string') {
            serviceId = query;
            query = { id: serviceId };
        } else {
            if (!query.id) {
                serviceId = query.service_id || "*";
            } else {
                serviceId = query.id;
            }
        }
    
        if (typeof serviceId !== 'string') {
            throw new Error("Service ID must be a string");
        }
    
        if ((serviceId.match(/\//g) || []).length > 1) {
            throw new Error("Service id must contain at most one '/'");
        }
        if ((serviceId.match(/:/g) || []).length > 1) {
            throw new Error("Service id must contain at most one ':'");
        }
        if ((serviceId.match(/@/g) || []).length > 1) {
            throw new Error("Service id must contain at most one '@'");
        }
    
        if (serviceId.includes("/") && !serviceId.includes(":")) {
            serviceId += ":default";
            query.workspace = serviceId.split("/")[0];
            if (query.client_id && query.client_id !== serviceId.split("/")[1]) {
                throw new Error(`client_id (${query.client_id}) does not match service_id (${serviceId})`);
            }
            query.client_id = serviceId.split("/")[1];
        } else if (!serviceId.includes("/") && !serviceId.includes(":")) {
            const workspace = query.workspace || "*";
            serviceId = `${workspace}/*:${serviceId}`;
            query.workspace = workspace;
            query.client_id = "*";
        } else if (!serviceId.includes("/") && serviceId.includes(":")) {
            const workspace = query.workspace || ws;
            query.client_id = serviceId.split(":")[0];
            serviceId = `${workspace}/${serviceId}`;
            query.workspace = workspace;
        } else {
            const workspace = serviceId.split("/")[0];
            query.client_id = serviceId.split("/")[1].split(":")[0];
            query.workspace = workspace;
            if (!serviceId.includes("*")) {
                const serviceApi = await this._rpc.get_remote_service(serviceId, timeout);
                if (serviceApi) {
                    return this.patchServiceConfig(workspace, serviceApi);
                } else {
                    return null;
                }
            }
        }
    
        let appId = "*";
        if (serviceId.includes("@")) {
            [serviceId, appId] = serviceId.split("@");
            if (query.app_id && query.app_id !== appId) {
                throw new Error(`App id mismatch: ${query.app_id} != ${appId}`);
            }
        }
        query.app_id = query.app_id || appId;
        query.service_id = serviceId.split("/")[1].split(":")[1];
    
        console.info("Getting service:", query);
    
        const originalVisibility = query.visibility || "*";
        let visibility;
        if (query.workspace === "*") {
            visibility = "public";
        } else {
            // if (!userInfo.check_permission(query.workspace, "read")) {
            //     visibility = "public";
            // } else {
                visibility = "*";
            // }
        }
    
        const pattern = `services:${visibility}:${query.workspace}/${query.client_id}:${query.service_id}@${query.app_id}`;
        if (!pattern.startsWith("services:")) {
            throw new Error("Query pattern does not start with 'services:'.");
        }
        if (pattern.includes("{") || pattern.includes("}")) {
            throw new Error("Query pattern contains invalid characters.");
        }
    
        console.debug("Query services using pattern:", pattern);
        const keys = this._redis.keys(pattern);
    
        if (query.workspace === "*") {
            const wsPattern = `services:${originalVisibility}:${ws}/${query.client_id}:${query.service_id}@${query.app_id}`;
            keys.push(...this._redis.keys(wsPattern));
        }
    
        console.debug("Found service keys:", keys);
        const withinWorkspaceKeys = [];
        const outsideWorkspaceKeys = [];
    
        keys.forEach(key => {
            const keyWorkspace = key.split("/")[1];
            if (keyWorkspace === ws) {
                withinWorkspaceKeys.push(key);
            } else {
                outsideWorkspaceKeys.push(key);
            }
        });
    
        if (mode === "random") {
            withinWorkspaceKeys.sort(() => Math.random() - 0.5);
            outsideWorkspaceKeys.sort(() => Math.random() - 0.5);
        } else {
            withinWorkspaceKeys.sort();
            outsideWorkspaceKeys.sort();
        }
    
        const sortedKeys = [...withinWorkspaceKeys, ...outsideWorkspaceKeys];
    
        for (const key of sortedKeys) {
            try {
                const parts = key.split(":");
                serviceId = parts[2] + ":" + parts[3];
                [serviceId, appId] = serviceId.split("@");
                const workspace = serviceId.split("/")[0];
                const serviceApi = await this._rpc.get_remote_service(serviceId, timeout);
                if (serviceApi) {
                    return this.patchServiceConfig(workspace, serviceApi);
                }
            } catch (e) {
                if (skipTimeout && e instanceof TimeoutError) {
                    console.warning(`Timeout while getting service ${serviceId}, skipping to the next one.`);
                    continue;
                } else {
                    throw new Error(`Timeout while getting service ${serviceId}`);
                }
            }
        }
    
        if (query.app_id && query.app_id !== "*") {
            const serviceApi = await this._launch_application_for_service(query, context);
            return serviceApi;
        }
    
        return null;
    }
    
    patchServiceConfig(workspace, serviceApi) {
        serviceApi.config = serviceApi.config || {};
        serviceApi.config.workspace = workspace;
        return serviceApi;
    }

    async listServices(query, context) {
        if (!context) {
            throw new Error("context is required");
        }

        const cws = context.ws;
        const userInfo = context.user; // Skipping UserInfo.model_validate
    
        if (!query) {
            query = {
                visibility: "*",
                workspace: cws,
                client_id: "*",
                service_id: "*",
            };
        } else if (typeof query === 'string') {
            let visibility = "*";
            let workspace = "*";
            let clientId = "*";
            let serviceId = "*";
    
            if (query.includes("/") && query.includes(":")) {
                const [workspacePart, remaining] = query.split("/");
                const [clientPart, servicePart] = remaining.split(":");
                workspace = workspacePart === "*" ? "public" : workspacePart;
                clientId = clientPart;
                serviceId = servicePart || "*";
                query = { visibility, workspace, client_id: clientId, service_id: serviceId };
            } else if (query.includes(":")) {
                const [clientPart, servicePart] = query.split(":");
                clientId = clientPart;
                serviceId = servicePart || "*";
                query = { visibility, workspace, client_id: clientId, service_id: serviceId };
            } else if (query.includes("/")) {
                const [workspacePart, servicePart] = query.split("/");
                workspace = workspacePart === "*" ? "public" : workspacePart;
                serviceId = servicePart || "*";
                query = { visibility, workspace, client_id: clientId, service_id: serviceId };
            } else {
                workspace = query;
                query = { visibility, workspace, client_id: clientId, service_id: serviceId };
            }
        } else {
            if (query.id) {
                if (query.service_id) {
                    throw new Error("Cannot specify both 'id' and 'service_id' in the query.");
                }
                query.service_id = query.id;
                delete query.id;
            }
        }
    
        const originalVisibility = query.visibility || "*";
        const workspace = query.workspace || "*";
        if (workspace === "*") {
            if (originalVisibility === "protected") {
                throw new Error("Cannot list protected services in all workspaces.");
            }
            query.visibility = "public";
        } else if (workspace !== "public" && workspace !== cws) {
            // if (!userInfo.check_permission(workspace, "read")) {
            //     throw new Error(`Permission denied for workspace ${workspace}`);
            // }
        }
    
        const visibility = query.visibility || "*";
        const clientId = query.client_id || "*";
        const serviceId = query.service_id || "*";
        const typeFilter = query.type || null;
        let appId = "*";
        if (serviceId.includes("@")) {
            [serviceId, appId] = serviceId.split("@");
            if (query.app_id && query.app_id !== appId) {
                throw new Error(`App id mismatch: ${query.app_id} != ${appId}`);
            }
        }
        appId = query.app_id || appId;
    
        const allowedKeys = ["visibility", "workspace", "client_id", "service_id", "type", "app_id"];
        if (Object.keys(query).some(key => !allowedKeys.includes(key))) {
            console.error(`Invalid query keys: ${Object.keys(query).filter(key => !allowedKeys.includes(key))}`);
            throw new Error(`Invalid query keys: ${Object.keys(query).filter(key => !allowedKeys.includes(key))}`);
        }
    
        validateKeyPart(visibility);
        validateKeyPart(workspace);
        validateKeyPart(clientId);
        validateKeyPart(serviceId);
        validateKeyPart(appId);
    
        const pattern = `services:${visibility}:${workspace}/${clientId}:${serviceId}@${appId}`;
        if (!pattern.startsWith("services:")) {
            throw new Error("Query pattern does not start with 'services:'.");
        }
        console.log("Listing services using pattern:", pattern);
        const keys = this._redis.keys(pattern);
    
        if (workspace === "*") {
            const wsPattern = `services:${originalVisibility}:${cws}/${clientId}:${serviceId}@${appId}`;
            keys.push(...this._redis.keys(wsPattern));
            console.log("Listing more services using pattern:", wsPattern);
        }
    
        const services = [];
        for (const key of new Set(keys)) {
            const serviceData = this._redis.hgetall(key);
            const convertedServiceData = {};
    
            for (const [k, v] of Object.entries(serviceData)) {
                const keyStr = k;
                let valueStr = v;
                if (typeof valueStr === "string" && ((valueStr.startsWith("{") && valueStr.endsWith("}")) || (valueStr.startsWith("[") && valueStr.endsWith("]")))) {
                    valueStr = JSON.parse(valueStr);
                }
                convertedServiceData[keyStr] = valueStr;
            }
    
            if (typeFilter) {
                if (convertedServiceData.type === typeFilter) {
                    services.push(convertedServiceData);
                }
            } else {
                services.push(convertedServiceData);
            }
        }
    
        return services;
    }

    patchServiceConfig(workspace, serviceApi) {
        serviceApi.config = serviceApi.config || {};
        serviceApi.config.workspace = workspace;
        return serviceApi;
    }

    async createWindow(config, extra_config, context) {
        let elem;
        const ws = context.ws;
        const clientId = "client-" + Date.now();
        this.connections[ws + "/" + clientId] = {
            id: ws + "/" + clientId,
            workspace: ws,
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
            // do a while loop to wait for the element to be available
            // the timeout should be 9 * 500 ms
            let count = 0;
            while (!document.getElementById(config.window_id) && count < 9) {
                await new Promise((resolve) => setTimeout(resolve, 500));
                count++;
            }
            elem = document.getElementById(config.window_id);
            if (!elem) {
                throw new Error("Window element not found: " + config.window_id);
            }
        } else {
            config.window_id = "window-" + Date.now();
            config.workspace = ws;
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

        this.connections[ws + "/" + clientId].source = elem.contentWindow;
        let waitClientPromise;

        if (!config.passive) {
            waitClientPromise = this.waitForClient(ws + "/" + clientId, 180000);
        }

        await new Promise((resolve, reject) => {
            elem.onload = resolve;
            elem.onerror = reject;
        });

        if (config.passive) {
            delete this.connections[ws + "/" + clientId];
            return;
        }

        elem.contentWindow.postMessage({
            type: "initializeHyphaClient",
            server_url: this.serverUrl,
            client_id: clientId,
            workspace: ws,
            config,
        });

        const svc = await waitClientPromise;
        if (svc.setup) {
            await svc.setup();
        }
        if (svc.run && config) {
            await svc.run({ data: config.data, config: config.config });
        }
        this.windows.push({ id: config.window_id, name: config.name || config.src, service: svc });
        return svc;
    }

    async getWindow(config, context) {
        if (typeof config === "string") {
            return this.windows.find(w => w.name === config);
        } else if (config.id) {
            return this.windows.find(w => w.id === config.id);
        } else if (config.name) {
            return this.windows.find(w => w.name === config.name);
        }
    }

    async loadPlugin(config, extra_config, context) {
        let code;
        const ws = context.ws;
        const src = config.src;
        if (src.startsWith("http") && !src.split("?")[0].endsWith(".imjoy.html")) {
            return await this.createWindow(config, extra_config, context);
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
                return await this.createWorker(config, ws, this.baseUrl + "hypha-app-webworker.js");
            case "window":
            case "iframe":
                if(!config.src){
                    config.src = this.baseUrl + "hypha-app-iframe.html";
                }
                return await this.createWindow(config, extra_config, context);
            case "web-python":
                return await this.createWorker(config, ws, this.baseUrl + "hypha-app-webpython.js");
            default:
                throw new Error("Unsupported plugin type: " + config.type);
        }
    }

    _waitForConnection(conn_id, timeout){
        return new Promise((resolve, reject) => {
            const handler = (info) => {
                if(info.id === conn_id){
                    this.eventBus.off("connection_ready", handler);
                    clearTimeout(timeoutId);
                    resolve(info);
                }
            }
            const timeoutId = setTimeout(() => {
                this.eventBus.off("connection_ready", handler);
                reject(new Error(`Timeout after ${timeout / 1000} s`));
            }, timeout);
            this.eventBus.on("connection_ready", handler);
        })
    }

    async createWorker(config, workspace, workerUrl) {
        const worker = new Worker(workerUrl);
        const clientId = "client-" + Date.now();
        this.connections[workspace + "/" + clientId] = {
            id: workspace + "/" + clientId,
            source: worker,
            workspace: workspace,
            websocket: null,
            postMessage: (data) => {
                worker.postMessage(data);
            },
        };
        worker.onmessage = this._server.messageHandler;
        await this._waitForConnection(workspace + "/" + clientId, 60000);
        worker.postMessage({
            type: "initializeHyphaClient",
            server_url: this.serverUrl,
            workspace: workspace,
            client_id: clientId,
            config,
        });
        return await this.waitForClient(workspace + "/" + clientId, 60000);
    }

    async getPlugin(config, extra_config, context) {
        if (typeof config === "string") {
            return await this.loadPlugin({ src: config }, {}, context);
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

    getDefaultServices() {
        return {
            "id": "default",
            "name": "Default workspace management service",
            "description": "Services for managing workspace.",
            "config": {
                "require_context": true,
                "visibility": "public",
            },
            "emit": async (type, data, context) => {
                const workspaceId = context.ws;
                
                await this.eventBus.emit(type, data);
            },
            "on": (event, handler, context) => {
                const workspaceId = context.ws;
                
                this.eventBus.on(event, handler);
            },
            "off": (event, handler, context) => {
                const workspaceId = context.ws;
                
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
            "show_progress": (progress, context) => {
                console.log("showProgress", progress);
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
            "register_service": async (service, context) => {
                const workspaceId = context.ws;
                
                const sv = await this._rpc.get_remote_service(context["from"] + ":built-in");
                service["config"] = service["config"] || {};
                service["config"]["workspace"] = workspaceId;
                service = await sv.register_service(service);
                assert(!service["id"].includes("/"), "Service id must not contain '/'");
                service["id"] = workspaceId + "/" + service["id"];
                return service;
            },
            "get_service": this.getService.bind(this),

            "list_services": this.listServices.bind(this),

            "generate_token": async (context) => {
                const workspaceId = context.ws;
                const token = randId();
                Workspace.tokens[token] = {
                    "workspace": workspaceId,
                };
                return token;
            },
            "load_plugin": async (config, extra_config, context) => {
                return this.loadPlugin(config, extra_config, context);
            },
            "create_window": async (config, extra_config, context) => {
                return this.createWindow(config, extra_config, context);
            },
            "get_plugin": async (config, extra_config, context) => {
                return this.getPlugin(config, extra_config, context);
            },
            "register_service": async (service, context) => {
                return await this.registerService(service, context);
            },
        };
    }
}
