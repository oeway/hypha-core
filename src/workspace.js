import { RedisRPCConnection, Environment, parsePluginCode, convertToSnakeCase, convertToCamelCase } from './utils/index.js';
import { hyphaWebsocketClient } from 'hypha-rpc';

// Ensure the client_id is safe
const _allowedCharacters = /^[a-zA-Z0-9-_/*]*$/;

function validateKeyPart(keyPart) {
    if (!_allowedCharacters.test(keyPart)) {
        throw new Error(`Invalid characters in query part: ${keyPart}`);
    }
}

// JWT HS256 Implementation
function base64UrlEncode(data) {
    const base64 = btoa(
        typeof data === 'string' 
            ? data 
            : String.fromCharCode(...new Uint8Array(data))
    );
    return base64.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

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

async function generateJWT(payload, secret) {
    const header = {
        alg: 'HS256',
        typ: 'JWT'
    };
    
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(payload));
    const unsigned = `${encodedHeader}.${encodedPayload}`;
    
    const signature = await hmacSha256(secret, unsigned);
    const encodedSignature = base64UrlEncode(signature);
    return `${unsigned}.${encodedSignature}`;
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

export class Workspace {
    static workspaces = {};
    static clients = {};

    constructor(hyphaCore) {
        this._server = hyphaCore;
        this._redis = hyphaCore.redis;
        this.connections = hyphaCore.connections;
        this.eventBus = hyphaCore;
        this.serverUrl = hyphaCore.url;
        this.baseUrl = hyphaCore.baseUrl;
        this._rpc = null;
        // Add local service storage for services registered directly
        this._localServices = new Map();
    }

    waitForClient(cid, timeout) {
        return new Promise((resolve, reject) => {
            const handler = (info) => {
                const ccid = info.id.split(":")[0];
                if(ccid !== cid){
                    console.log(`🚫 [DEBUG] ccid mismatch, ignoring service: ${info.id}`);
                    return;
                }
                this.eventBus.off("service_added", handler);
                if (info.type === "imjoy") {
                    clearTimeout(timeoutId);
                    resolve(info);
                    return;
                } else {
                    if(!info.id.endsWith(":default")){
                        console.error(`❌ [DEBUG] Unexpected service added (not :default):`, info);
                        return;
                    }
                    const defaultService = info;
                    clearTimeout(timeoutId);
                    this._rpc.get_remote_service(defaultService.id).then(async (svc) => {
                        try {
                            await this.eventBus.emit("client_ready", svc);
                            resolve(svc);
                        } catch (e) {
                            reject(e);
                        }
                    }).catch(error => {
                        console.error(`❌ [DEBUG] Failed to get remote service:`, error);
                        reject(error);
                    });
                }
            };
            
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
        const defaultServices = this.getDefaultService();
        await rpc.register_service(Object.assign(defaultServices, config.default_service || {}), {notify: false});
    }

    async registerService(service, context) {
        const ws = context.ws;
        const clientId = context.from;
        const userInfo = context.user;
        
        service.config = service.config || {};
        service.config.workspace = ws;
        
        // Store the original service ID before modification for security checks
        const originalServiceId = service.id;
        
        // Handle service IDs that are already fully constructed (e.g., "default/root:built-in")
        // vs simple service IDs (e.g., "built-in")
        let simpleServiceId = originalServiceId;
        let isAlreadyConstructed = false;
        
        if (originalServiceId.includes("/") && originalServiceId.includes(":")) {
            // Service ID is already constructed like "workspace/client:service"
            // Must have both slash and colon to be considered fully constructed
            const parts = originalServiceId.split("/");
            if (parts.length === 2 && parts[1].includes(":")) {
                isAlreadyConstructed = true;
                simpleServiceId = parts[1]; // Extract "client:service" part
            }
        }
        
        // Security check: only root user can register regular services in default workspace
        // Exception: built-in services can be registered by users in any workspace
        const isBuiltInService = simpleServiceId.includes(":built-in") || simpleServiceId === "built-in";
        // A legitimate default service has pattern "clientId:default" where clientId matches the actual client
        // This prevents arbitrary named services ending with ":default" from bypassing security
        const isLegitimateDefaultService = simpleServiceId === "default" || 
            (simpleServiceId.endsWith(":default") && 
             clientId.endsWith("/" + simpleServiceId.split(":")[0]));
        

        
        if (ws === "default" && !clientId.endsWith("/root") && !isBuiltInService && !isLegitimateDefaultService) {
            throw new Error(`Access denied: Only root user can register services in '${ws}' workspace. Current client: ${clientId}`);
        }
        
        // If service ID is not already constructed, validate and construct it
        if (!isAlreadyConstructed) {
            if(!service.id.includes(":")){
                // add a colon to the service id with the client id (without the workspace)
                service.id = `${clientId.split("/")[1]}:${service.id}`;
            }
            // Service ID should not contain '/' if not already fully constructed
            if (service.id.includes("/")) { 
                throw new Error("Service id must not contain '/'");
            }
            
            service.id = `${ws}/${service.id}`;
        }
        service.app_id = service.app_id || "*";
        service.config.visibility = service.config.visibility || "protected";
        
        // Check if this is a local service (has function properties)
        const isLocalService = this._hasServiceFunctions(service);
        if (isLocalService) {
            // Convert camelCase methods to snake_case for Python/JavaScript compatibility
            service = convertToSnakeCase(service);
            
            // Store the complete service object locally for direct access
            const localServiceKey = `${service.id}@${service.app_id}`;
            this._localServices.set(localServiceKey, service);
            console.info(`Storing local service with snake_case methods: ${localServiceKey}`);
        }
        
        // Check if the service already exists
        const serviceExists = this._redis.exists(`services:*:${service.id}@${service.app_id}`);
        const key = `services:${service.config.visibility}:${service.id}@${service.app_id}`;
        
        // Store service metadata in Redis (but not the function implementations for local services)
        const serviceMetadata = {};
        for(const [k, v] of Object.entries(service)) {
            // For local services, don't store function implementations in Redis
            if (isLocalService && typeof v === 'function') {
                serviceMetadata[k] = { type: 'function', name: v.name || k };
            } else if (isLocalService && typeof v === 'object' && v !== null && !Array.isArray(v)) {
                // Handle nested function objects like math.add
                const objMetadata = {};
                for (const [subK, subV] of Object.entries(v)) {
                    if (typeof subV === 'function') {
                        objMetadata[subK] = { type: 'function', name: subV.name || subK };
                    } else {
                        objMetadata[subK] = subV;
                    }
                }
                serviceMetadata[k] = objMetadata;
            } else {
                serviceMetadata[k] = v;
            }
        }
        
        for(const [k, v] of Object.entries(serviceMetadata)) {
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
                // Check if this is a local service first
                if (isLocalService && service.setup) {
                    // For local services, call setup directly without RPC
                    setTimeout(async () => {
                        try {
                            await service.setup();
                            console.debug(`✅ Local setup completed for service \`${clientId}\``);
                        } catch (e) {
                            console.error(`Failed to run setup for local default service \`${clientId}\`: ${e}`);
                        }
                    }, 10);
                } else if (!isLocalService && this._shouldAttemptRpcSetup(clientId, service)) {
                    // Only try RPC setup for services that likely have remote setup methods
                    this._setupServiceWithRetry(clientId, 3); // 3 retry attempts
                }
                // For local services without setup method, or services that don't need RPC setup, no action needed
            }
            if (key.includes(":built-in@")) {
                this.eventBus.emit("client_connected", { id: clientId, workspace: ws });
                console.info(`Adding built-in service: ${service.id}, key: ${key}`);
            } else {
                this.eventBus.emit("service_added", service);
                console.info(`Adding service ${service.id}, key: ${key}`);
            }
        }
        
        // Return the service object with the processed ID and configuration
        return service;
    }

    /**
     * Determine if we should attempt RPC setup for a service
     */
    _shouldAttemptRpcSetup(clientId, service) {
        // Skip RPC setup for web-worker and web-python plugins - they register services
        // but typically don't expose setup() methods via RPC
        const clientPart = clientId.includes('/') ? clientId.split('/')[1] : clientId;
        
        // Web-worker and web-python clients typically have client IDs that start with "client-"
        // and don't need RPC setup calls
        if (clientPart.startsWith('client-')) {
            return false;
        }
        
        // Skip if the service explicitly indicates it doesn't need setup
        if (service.config && service.config.no_setup) {
            return false;
        }
        
        // For iframe-based apps and other traditional RPC services, attempt setup
        return true;
    }

    /**
     * Check if a service object contains function properties (indicating it's a local service)
     */
    _hasServiceFunctions(service) {
        for (const [key, value] of Object.entries(service)) {
            // Skip metadata fields
            if (['id', 'name', 'description', 'config', 'app_id'].includes(key)) {
                continue;
            }
            // Check for functions or objects containing functions
            if (typeof value === 'function') {
                return true;
            }
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                // Don't check _rintf objects as they're RPC proxies
                if (value._rintf) {
                    continue;
                }
                for (const subValue of Object.values(value)) {
                    if (typeof subValue === 'function') {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    /**
     * Setup service with retry mechanism to handle timing issues
     */
    async _setupServiceWithRetry(clientId, maxRetries = 3) {
        const clientPart = clientId.includes('/') ? clientId.split('/')[1] : clientId;
        
        // Run this in the background to avoid blocking
        setTimeout(async () => {
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    // Exponential backoff: 100ms, 400ms, 1600ms
                    const delay = 100 * Math.pow(4, attempt - 1);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    
                    if (this._rpc) {
                        const svc = await this._rpc.get_remote_service(`${clientPart}:default`, 5); // 5 second timeout
                        if (svc && svc.setup) {
                            await svc.setup();
                            console.debug(`✅ Setup completed for default service \`${clientId}\``);
                            return; // Success, exit retry loop
                        }
                    }
                } catch (e) {
                    if (attempt === maxRetries) {
                        // Only show this as debug since it's often expected for local services
                        console.debug(`Setup not available for default service \`${clientId}\` (this is normal for local services)`);
                    } else {
                        // Don't log individual retry attempts to reduce noise
                        continue;
                    }
                }
            }
        }, 50); // Start after 50ms delay
    }
    
    async unregisterService(serviceId, context) {
        const ws = context.ws;
        if (!serviceId.includes("/")) {
            serviceId = `${ws}/${serviceId}`;
        }
        if (!serviceId.includes(":")) {
            throw new Error("Service id info must contain ':'");
        }
        if (!serviceId.includes("@")) {
            serviceId = serviceId + "@*";
        }

        // Remove from local services if it exists
        if (this._localServices.has(serviceId)) {
            this._localServices.delete(serviceId);
            console.info(`Removed local service: ${serviceId}`);
        }

        const key = `services:*:${serviceId}`;
        console.info(`Removing service: ${key}`);
    
        // Check if the service exists before removal
        const serviceExists = this._redis.exists(key);
    
        if (serviceExists) {
            this._redis.delete(key);
            if (key.includes(":built-in@")) {
                this.eventBus.emit("client_disconnected", { id: context.from, workspace: ws });
            } else {
                this.eventBus.emit("service_removed", { id: serviceId });
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
            const workspace = query.workspace || ws;
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
                // First check if this is a local service
                const localServiceKey = `${serviceId}@*`;
                if (this._localServices.has(localServiceKey)) {
                    console.info(`Found local service (direct): ${localServiceKey}`);
                    const localService = this._localServices.get(localServiceKey);
                    return this.patchServiceConfig(workspace, localService);
                }
                
                // If not local, try to get it via RPC (for remote services)
                if (this._rpc) {
                    const serviceApi = await this._rpc.get_remote_service(serviceId, timeout);
                    if (serviceApi) {
                        return this.patchServiceConfig(workspace, serviceApi);
                    }
                }
                return null;
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
    
        // console.info("Getting service:", query);
    
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
    
        // console.debug("Query services using pattern:", pattern);
        const keys = this._redis.keys(pattern);
    
        if (query.workspace === "*") {
            const wsPattern = `services:${originalVisibility}:${ws}/${query.client_id}:${query.service_id}@${query.app_id}`;
            keys.push(...this._redis.keys(wsPattern));
        }
    
        // console.debug("Found service keys:", keys);
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
                
                // First check if this is a local service
                const localServiceKey = `${serviceId}@${appId}`;
                if (this._localServices.has(localServiceKey)) {
                    // console.info(`Found local service: ${localServiceKey}`);
                    const localService = this._localServices.get(localServiceKey);
                    return this.patchServiceConfig(workspace, localService);
                }
                
                // If not local, try to get it via RPC (for remote services)
                if (this._rpc) {
                    const serviceApi = await this._rpc.get_remote_service(serviceId, timeout);
                    if (serviceApi) {
                        return this.patchServiceConfig(workspace, serviceApi);
                    }
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
        
        // Check if this is a local service with function implementations
        const isLocalService = this._hasServiceFunctions(serviceApi);
        
        if (isLocalService) {
            // For local services, convert snake_case method names back to camelCase for JavaScript clients
            serviceApi = convertToCamelCase(serviceApi);
            
            if (serviceApi.config.require_context) {
                // For local services that require context, wrap each method to inject proper context
                return this._wrapLocalServiceMethods(serviceApi, workspace);
            }
        }
        
        return serviceApi;
    }

    /**
     * Wrap local service methods to inject proper context
     */
    _wrapLocalServiceMethods(serviceApi, workspace) {
        const wrappedService = { ...serviceApi };
        
        // Get the workspace client info to extract user details
        const getContextForCall = () => {
            // Try to get context from current RPC call if available
            if (this._rpc && this._rpc.current_context) {
                // For workspace manager with "*" workspace, use the context's workspace if available
                const contextWorkspace = this._rpc.current_context.ws || workspace;
                return {
                    ws: contextWorkspace,
                    user: this._rpc.current_context.user || {
                        id: "anonymous",
                        email: "",
                        roles: [],
                        scopes: []
                    },
                    from: this._rpc.current_context.from || `${contextWorkspace}/anonymous-client`,
                    to: this._rpc.current_context.to || `${contextWorkspace}/workspace-service`
                };
            }
            
            // Fallback to default context
            return {
                ws: workspace,
                user: {
                    id: "anonymous",
                    email: "",
                    roles: [],
                    scopes: []
                },
                from: `${workspace}/anonymous-client`,
                to: `${workspace}/workspace-service`
            };
        };
        
        // Recursively wrap function properties
        const wrapFunctions = (obj, path = '') => {
            const wrapped = {};
            
            for (const [key, value] of Object.entries(obj)) {
                if (['id', 'name', 'description', 'config', 'app_id'].includes(key)) {
                    // Skip metadata fields
                    wrapped[key] = value;
                } else if (typeof value === 'function') {
                    // Wrap function to inject context
                    wrapped[key] = (...args) => {
                        // Check if the last argument looks like a context object
                        const lastArg = args[args.length - 1];
                        const hasContext = lastArg && 
                            typeof lastArg === 'object' && 
                            !Array.isArray(lastArg) &&
                            ('ws' in lastArg || 'user' in lastArg || 'from' in lastArg || 'to' in lastArg);
                        
                        if (!hasContext) {
                            // Inject context as the last argument
                            args.push(getContextForCall());
                        } else {
                            // Merge with existing context, ensuring all required fields are set
                            const baseContext = getContextForCall();
                            const mergedContext = {
                                ...lastArg,  // Preserve existing context properties
                                ws: lastArg.ws || baseContext.ws,
                                user: lastArg.user || baseContext.user,
                                from: lastArg.from || baseContext.from,
                                to: lastArg.to || baseContext.to
                            };
                            args[args.length - 1] = mergedContext;
                        }
                        
                        return value.apply(obj, args);
                    };
                } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    // Don't wrap _rintf objects as they're RPC proxies
                    if (value._rintf) {
                        wrapped[key] = value;
                    } else {
                        // Recursively wrap nested objects
                        wrapped[key] = wrapFunctions(value, `${path}.${key}`);
                    }
                } else {
                    // Copy other values as-is
                    wrapped[key] = value;
                }
            }
            
            return wrapped;
        };
        
        return wrapFunctions(wrappedService);
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
        // console.log("Listing services using pattern:", pattern);
        const keys = this._redis.keys(pattern);
    
        if (workspace === "*") {
            const wsPattern = `services:${originalVisibility}:${cws}/${clientId}:${serviceId}@${appId}`;
            keys.push(...this._redis.keys(wsPattern));
            // console.log("Listing more services using pattern:", wsPattern);
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

    async createWindow(config, extra_config, context) {
        // Window creation requires browser environment
        Environment.requireBrowser('Window/iframe creation');
        
        let elem;
        const ws = context.ws;
        const clientId = "client-" + Date.now();
        const connectionId = ws + "/" + clientId;
        
        this.connections[connectionId] = {
            id: connectionId,
            workspace: ws,
            user: context.user,  // Store user info for nested app creation
            websocket: null,
            postMessage: (data) => {
                Environment.safePostMessage(elem.contentWindow, data);
            },
        };

        // Generate authentication token if not provided
        let authToken = context.token;
        if (!authToken) {
            try {
                // Generate a token for the iframe to authenticate with
                authToken = await this.getDefaultService().generate_token({
                    workspace: ws,
                    client_id: clientId,
                    user_id: context.user?.id || "anonymous",
                    email: context.user?.email || "",
                    roles: context.user?.roles || [],
                    scopes: context.user?.scopes || [],
                    expires_in: 3600 // 1 hour
                }, context);
            } catch (error) {
                console.warn("Failed to generate auth token for iframe:", error);
            }
        }

        // Prepare authentication parameters for URL hash
        const authParams = new URLSearchParams();
        authParams.set('client_id', clientId);
        authParams.set('workspace', ws);
        authParams.set('server_url', this.serverUrl);
        if (authToken) {
            authParams.set('token', authToken);
        }
        if (context.user) {
            authParams.set('user_info', JSON.stringify(context.user));
        }
        const authHash = `#${authParams.toString()}`;

        if (config.type === "iframe") {
            if (typeof document === 'undefined') {
                throw new Error('iframe creation requires browser environment with document API');
            }
            elem = document.createElement("iframe");
            elem.src = config.src + authHash;
            elem.id = config.window_id || "window-" + Date.now();
            elem.style.width = config.width || "100%";
            elem.style.height = config.height || "100%";
            elem.style.display = "none";
            document.body.appendChild(elem);
        } else if (config.window_id) {
            if (typeof document === 'undefined') {
                throw new Error('Window element access requires browser environment with document API');
            }
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
            let count = 0;
            while (!document.getElementById(config.window_id) && count < 9) {
                await new Promise((resolve) => setTimeout(resolve, 500));
                count++;
            }
            elem = document.getElementById(config.window_id);
            if (!elem) {
                throw new Error(`iframe element not found ${config.window_id} in ${9 * 500 / 1000} s`);
            }
        }
        if (elem.tagName !== "IFRAME") {
            // create a child iframe
            if (typeof document === 'undefined') {
                throw new Error('iframe creation requires browser environment with document API');
            }
            const iframe = document.createElement("iframe");
            iframe.style.width = config.width || "100%";
            iframe.style.height = config.height || "100%";
            iframe.src = config.src + authHash;
            elem.appendChild(iframe);
            elem = iframe;
        }
        this.connections[connectionId].source = elem.contentWindow;
        
        let waitClientPromise;

        if (!config.passive) {
            waitClientPromise = this.waitForClient(connectionId, 180000);
        }

        await new Promise((resolve, reject) => {
            elem.onload = resolve;
            elem.onerror = reject;
        });

        if (config.passive) {
            delete this.connections[connectionId];
            return;
        }

        
        const initMessage = {
            type: "initializeHyphaClient",
            server_url: this.serverUrl,
            client_id: clientId,
            workspace: ws,
            token: authToken || null,
            user_info: context.user || null,
            config,
        };
        // Important: this setTimeout is necessary, otherwise, the iframe won't be able to receive the message
        // Add a small delay to ensure the iframe's JavaScript has loaded and setupLocalClient() 
        // has had time to set up its message listener
        setTimeout(() => {
            try {
                Environment.safePostMessage(elem.contentWindow, initMessage);
            } catch (error) {
                console.error(`❌ [DEBUG] Failed to send initializeHyphaClient to ${connectionId}:`, error);
            }
        }, 0);

        const svc = await waitClientPromise;
        
        // Automatically call setup() if it exists for ImJoy plugins
        if (svc.setup && typeof svc.setup === 'function') {
            try {
                await svc.setup();
                // Mark that setup has been called automatically to avoid duplicate calls
                svc._hyphaSetupCalled = true;
            } catch (error) {
                console.error(`❌ [DEBUG] setup() failed for window plugin: ${config.name || config.src}:`, error);
            }
        }
        
        // Automatically call run() for window/iframe plugins
        if (svc.run && typeof svc.run === 'function') {
            try {
                await svc.run({ data: config.data, config: config.config });
            } catch (error) {
                console.error(`❌ [DEBUG] run() failed for window plugin: ${config.name || config.src}:`, error);
            }
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
        return undefined;
    }

    async loadApp(config, extra_config, context) {
        let code;
        const ws = context.ws;
        const src = config.src;
        
        // If type is already specified as web-worker and src is a URL, use it directly as the worker script
        if (config.type === "web-worker" && src && (src.startsWith("http") || src.startsWith("blob:"))) {
            return await this.createWorker(config, ws, src, context);
        }
        
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
                return await this.createWorker(config, ws, this.baseUrl + "hypha-app-webworker.js", context);
            case "window":
            case "iframe":
                config.src = this.baseUrl + "hypha-app-iframe.html";
                return await this.createWindow(config, extra_config, context);
            case "web-python":
                return await this.createWorker(config, ws, this.baseUrl + "hypha-app-webpython.js", context);
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

    async createWorker(config, workspace, workerUrl, context) {
        // Check if Worker API is available
        if (typeof Worker === 'undefined') {
            throw new Error('WebWorker creation requires browser environment with Worker API');
        }
        
        const clientId = "client-" + Date.now();
        
        // Generate authentication token if not provided
        let authToken = context.token;
        if (!authToken) {
            try {
                // Generate a token for the worker to authenticate with
                authToken = await this.getDefaultService().generate_token({
                    workspace: workspace,
                    client_id: clientId,
                    user_id: context.user?.id || "anonymous",
                    email: context.user?.email || "",
                    roles: context.user?.roles || [],
                    scopes: context.user?.scopes || [],
                    expires_in: 3600 // 1 hour
                }, context);
            } catch (error) {
                console.warn("Failed to generate auth token for worker:", error);
            }
        }
        
        // Prepare authentication parameters for URL hash
        const authParams = new URLSearchParams();
        authParams.set('client_id', clientId);
        authParams.set('workspace', workspace);
        authParams.set('server_url', this.serverUrl);
        if (authToken) {
            authParams.set('token', authToken);
        }
        if (context.user) {
            authParams.set('user_info', JSON.stringify(context.user));
        }
        const authHash = `#${authParams.toString()}`;
        
        const worker = new Worker(workerUrl + authHash);
        this.connections[workspace + "/" + clientId] = {
            id: workspace + "/" + clientId,
            source: worker,
            workspace: workspace,
            user: context.user,  // Store user info for nested app creation
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
            token: authToken || null,
            user_info: context?.user || null,
            config,
        });
        const svc = await this.waitForClient(workspace + "/" + clientId, 60000);
        
        // Automatically call setup() if it exists for ImJoy plugins
        if (svc.setup && typeof svc.setup === 'function') {
            try {
                await svc.setup();
                // Mark that setup has been called automatically to avoid duplicate calls
                svc._hyphaSetupCalled = true;
            } catch (error) {
                console.error(`❌ [DEBUG] setup() failed for ${config.type} plugin: ${config.name || 'unnamed'}:`, error);
            }
        }
        
        // For window type plugins created via web-worker, also call run()
        if (config.type === 'window' && svc.run && typeof svc.run === 'function') {
            try {
                await svc.run({ data: config.data, config: config.config });
            } catch (error) {
                console.error(`❌ [DEBUG] run() failed for window worker plugin: ${config.name || 'unnamed'}:`, error);
            }
        }
        
        return svc;
    }

    async getApp(config, extra_config, context) {
        if (typeof config === "string") {
            return await this.loadApp({ src: config }, extra_config, context);
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

    getDefaultService() {
        const service = {
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
                if (progress !== 0 && progress !== 100) {
                    console.debug("showProgress", progress);
                }
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
            "getService": this.getService.bind(this),
            "listServices": this.listServices.bind(this),
            "generateToken": async (tokenConfig, context) => {
                // Handle default value for tokenConfig
                if (!tokenConfig) {
                    tokenConfig = {};
                }
                
                const currentWorkspace = context.ws;
                const currentClientId = context.from?.split('/')[1];
                
                // Determine target workspace with access control
                let targetWorkspace = tokenConfig.workspace || currentWorkspace;
                
                // Only root client in default workspace can generate tokens for other workspaces
                if (targetWorkspace !== currentWorkspace) {
                    if (currentWorkspace !== "default" || currentClientId !== "root") {
                        throw new Error(`Access denied: Cannot generate token for workspace '${targetWorkspace}' from workspace '${currentWorkspace}' with client '${currentClientId}'. Only root client in default workspace can generate cross-workspace tokens.`);
                    }
                }
                
                // Build JWT payload
                const payload = {
                    sub: tokenConfig.user_id || context.user?.id || "anonymous",
                    workspace: targetWorkspace,
                    client_id: tokenConfig.client_id || context.from?.split('/')[1] || "anonymouz-" + Date.now().toString(),
                    email: tokenConfig.email || context.user?.email || "",
                    roles: tokenConfig.roles || context.user?.roles || [],
                    scope: Array.isArray(tokenConfig.scopes) ? tokenConfig.scopes.join(' ') : (tokenConfig.scope || ""),
                    iat: Math.floor(Date.now() / 1000),
                    exp: tokenConfig.expires_in ? Math.floor(Date.now() / 1000) + tokenConfig.expires_in : Math.floor(Date.now() / 1000) + (24 * 60 * 60), // Default 24 hours
                    iss: "hypha-core",
                    aud: "hypha-api"
                };
                
                // Get JWT secret from server
                const jwtSecret = this._server.jwtSecret;
                if (!jwtSecret) {
                    throw new Error("JWT secret not configured on server");
                }
                
                // Generate and return JWT token
                return await generateJWT(payload, jwtSecret);
            },
            "loadApp": async (config, extra_config, context) => {
                return this.loadApp(config, extra_config, context);
            },
            "createWindow": async (config, extra_config, context) => {
                return this.createWindow(config, extra_config, context);
            },
            "getWindow": async (config, context) => {
                return this.getWindow(config, context);
            },
            "getApp": async (config, extra_config, context) => {
                return this.getApp(config, extra_config, context);
            },
            "registerService": async (service, context) => {
                return await this.registerService(service, context);
            },
            "unregisterService": async (serviceId, context) => {
                return await this.unregisterService(serviceId, context);
            },
        };
        // make it compatible with imjoy
        service.getPlugin = service.getApp;
        service.loadPlugin = service.loadApp;
        
        // Convert camelCase methods to snake_case for Python/JavaScript compatibility
        const convertedService = convertToSnakeCase(service);
        console.debug('🔧 Converted workspace default service methods to snake_case for compatibility');
        return convertedService;
    }
}
