importScripts("https://cdn.jsdelivr.net/npm/hypha-rpc@0.20.55/dist/hypha-rpc-websocket.min.js");

// Extract authentication parameters from URL hash
function getAuthFromHash() {
    const hash = self.location.hash.slice(1); // Remove the #
    if (!hash) return null;
    
    const params = new URLSearchParams(hash);
    const auth = {
        client_id: params.get('client_id'),
        workspace: params.get('workspace'),
        server_url: params.get('server_url')
    };
    
    if (params.get('token')) {
        auth.token = params.get('token');
    }
    
    if (params.get('user_info')) {
        try {
            auth.user_info = JSON.parse(params.get('user_info'));
        } catch (e) {
            console.warn('Failed to parse user_info from hash:', e);
        }
    }
    
    return auth;
}

// Initialize with hash parameters or wait for postMessage
const hashAuth = getAuthFromHash();

if (hashAuth && hashAuth.client_id && hashAuth.workspace && hashAuth.server_url) {
    // Use hash authentication
    const config = {
        server_url: hashAuth.server_url,
        client_id: hashAuth.client_id,
        workspace: hashAuth.workspace,
        enable_execution: true
    };
    
    if (hashAuth.token) {
        config.token = hashAuth.token;
    }
    
    if (hashAuth.user_info) {
        config.user_info = hashAuth.user_info;
    }
    
    hyphaWebsocketClient.setupLocalClient(config).then((api) => {
        console.log("Hypha WebWorker initialized (hash auth).", api);
        
        // Notify parent that worker is ready
        self.postMessage({
            type: 'hyphaClientReady',
            workspace: config.workspace,
            client_id: config.client_id
        });
    }).catch(error => {
        console.error("Failed to initialize Hypha WebWorker (hash auth):", error);
        self.postMessage({
            type: 'hyphaClientError',
            error: error.message
        });
    });
} else {
    // Fall back to postMessage initialization
    self.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'initializeHyphaClient') {
            const config = {
                server_url: event.data.server_url,
                client_id: event.data.client_id,
                workspace: event.data.workspace,
                enable_execution: true
            };
            
            // Add token if provided
            if (event.data.token) {
                config.token = event.data.token;
            }
            
            // Add user info if provided
            if (event.data.user_info) {
                config.user_info = event.data.user_info;
            }
            
            hyphaWebsocketClient.setupLocalClient(config).then((api) => {
                console.log("Hypha WebWorker initialized (postMessage).", api);
                
                // Notify parent that worker is ready
                self.postMessage({
                    type: 'hyphaClientReady',
                    workspace: config.workspace,
                    client_id: config.client_id
                });
            }).catch(error => {
                console.error("Failed to initialize Hypha WebWorker (postMessage):", error);
                self.postMessage({
                    type: 'hyphaClientError',
                    error: error.message
                });
            });
        }
    });
}

console.log('Hypha WebWorker loaded, waiting for initialization...');