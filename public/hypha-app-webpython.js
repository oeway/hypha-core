importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.1/full/pyodide.js");

let initializationData = null;

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
    initializationData = hashAuth;
    console.log('Using hash authentication for Web Python:', initializationData);
}

// Listen for initialization message (fallback)
self.addEventListener('message', function(event) {
    if (event.data && event.data.type === 'initializeHyphaClient') {
        if (!initializationData) {
            initializationData = event.data;
            console.log('Received initialization data for Web Python:', initializationData);
        }
    }
});

const startupScript = `
import sys
import types
import hypha_rpc
from hypha_rpc import setup_local_client
async def execute(server, config):
    print('executing script:', config["name"])
    for script in config["scripts"]:
        if script.get("lang") != "python":
            raise Exception("Only python scripts are supported")
        hypha_rpc.api = server
        imjoyModule = types.ModuleType('imjoy_rpc')
        imjoyModule.api = server
        sys.modules['imjoy'] = imjoyModule
        sys.modules['imjoy_rpc'] = imjoyModule
        exec(script["content"], {'imjoy': hypha_rpc, 'imjoy_rpc': hypha_rpc, 'hypha_rpc': hypha_rpc, 'api': server})

async def setup_client():
    # Build server config from initialization data
    server_config = {"enable_execution": False, "on_ready": execute}
    
    if initializationData:
        if hasattr(initializationData, 'server_url') or 'server_url' in initializationData:
            server_config["server_url"] = initializationData.get('server_url') if isinstance(initializationData, dict) else initializationData.server_url
        if hasattr(initializationData, 'client_id') or 'client_id' in initializationData:
            server_config["client_id"] = initializationData.get('client_id') if isinstance(initializationData, dict) else initializationData.client_id
        if hasattr(initializationData, 'workspace') or 'workspace' in initializationData:
            server_config["workspace"] = initializationData.get('workspace') if isinstance(initializationData, dict) else initializationData.workspace
        if hasattr(initializationData, 'token') or 'token' in initializationData:
            server_config["token"] = initializationData.get('token') if isinstance(initializationData, dict) else initializationData.token
        if hasattr(initializationData, 'user_info') or 'user_info' in initializationData:
            server_config["user_info"] = initializationData.get('user_info') if isinstance(initializationData, dict) else initializationData.user_info
    
    print(f"Setting up Hypha client with config: {server_config}")
    
    try:
        server = await setup_local_client(**server_config)
        print(f"Hypha Web Python client ready in workspace: {server_config.get('workspace', 'default')}")
        return server
    except Exception as e:
        print(f"Failed to setup Hypha client: {e}")
        raise

# Start the client setup when initialization data is available
server = await setup_client()
`

console.log("Loading Pyodide...");
loadPyodide().then(async (pyodide) => {
    console.log("Pyodide is ready to use.");
    pyodide.setStdout({ batched: (msg) => console.log(msg) });
    pyodide.setStderr({ batched: (msg) => console.error(msg) });
    await pyodide.loadPackage("micropip");
    const micropip = pyodide.pyimport("micropip");
    await micropip.install('hypha-rpc==0.20.55');
    
    // Wait for initialization data before starting
    const checkInitialization = () => {
        if (initializationData) {
            console.log("Starting Hypha Web Python with initialization data...");
            pyodide.globals.set("initializationData", initializationData);
            pyodide.runPythonAsync(startupScript).then(() => {
                console.log("Hypha Web Python initialized.");
                
                // Notify parent that client is ready
                const isWindow = typeof window !== "undefined";
                setTimeout(() => {
                    if (isWindow) {
                        window.parent.postMessage({ type: "hyphaClientReady" }, "*");
                    } else {
                        globalThis.postMessage({ type: "hyphaClientReady" });
                    }
                }, 10);
                
            }).catch(error => {
                console.error("Error initializing Hypha Web Python:", error);
                self.postMessage({
                    type: 'hyphaClientError',
                    error: error.message
                });
            });
        } else {
            console.log("Waiting for initialization data...");
            setTimeout(checkInitialization, 100);
        }
    };
    
    checkInitialization();
});