importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.1/full/pyodide.js");

const startupScript = `
import sys
import types
from imjoy_rpc.hypha import setup_local_client

async def execute(server, config):
    print('executing script:', config["name"])
    for script in config["scripts"]:
        if script.get("lang") != "python":
            raise Exception("Only python scripts are supported")
        imjoyModule = types.ModuleType('imjoy')
        imjoyModule.api = server
        sys.modules['imjoy'] = imjoyModule
        import imjoy
        import imjoy_rpc
        imjoy_rpc.api = server
        sys.modules['imjoy_rpc'] = imjoy_rpc
        exec(script["content"], {'imjoy': imjoy, 'imjoy_rpc': imjoy_rpc, 'api': server})

server = await setup_local_client(enable_execution=False, on_ready=execute)
`
console.log("Loading Pyodide...");
loadPyodide().then(async (pyodide) => {
    // Pyodide is now ready to use...
    console.log("Pyodide is ready to use.");
    await pyodide.loadPackage("micropip");
    const micropip = pyodide.pyimport("micropip");
    await micropip.install('imjoy-rpc==0.5.55');
    const isWindow = typeof window !== "undefined";
    if (isWindow) {
        window.parent.postMessage({ type: "hyphaClientReady" }, "*");
    } else {
        self.postMessage({ type: "hyphaClientReady" });
    }
    await pyodide.runPythonAsync(startupScript)
    console.log("Hypha Web Python initialized.");
});