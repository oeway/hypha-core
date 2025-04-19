importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.1/full/pyodide.js");

const startupScript = `
import asyncio
import sys
import types
import hypha_rpc
from hypha_rpc import setup_local_client
from js import globalThis, postMessage as _post_message, Object
from pyodide.ffi import to_js, JsException

def post_message(data):
    try:
        # Convert to a plain JavaScript object that can be cloned
        js_data = to_js(data, dict_converter=Object.fromEntries)
        _post_message(js_data)
    except JsException as e:
        print(f"Error posting message: {e}")

async def notify_client_ready():
    message = {"type": "hyphaClientReady"}
    try:
        from js import window
        window.parent.postMessage(to_js(message, dict_converter=Object.fromEntries), "*")
    except ImportError:
        # We're in a web worker context
        post_message(message)

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

await asyncio.sleep(0.01)
await notify_client_ready()
server = await setup_local_client(enable_execution=False, on_ready=execute)
`
console.log("Loading Pyodide...");
loadPyodide().then(async (pyodide) => {
    // Pyodide is now ready to use...
    console.log("Pyodide is ready to use.");
    pyodide.setStdout({ batched: (msg) => console.log(msg) });
    pyodide.setStderr({ batched: (msg) => console.error(msg) });
    await pyodide.loadPackage("micropip");
    const micropip = pyodide.pyimport("micropip");
    await micropip.install('hypha-rpc==0.20.51');
    await pyodide.runPythonAsync(startupScript)
    console.log("Hypha Web Python initialized.");
});