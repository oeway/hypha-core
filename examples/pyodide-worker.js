importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js");

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

        # Wrap user code in an async function to allow await
        code = script["content"]
        namespace = {'imjoy': hypha_rpc, 'imjoy_rpc': hypha_rpc, 'hypha_rpc': hypha_rpc, 'api': server}

        # Indent the code for the function body
        lines = code.split(chr(10))
        indented_lines = ['    ' + line for line in lines]
        indented_code = chr(10).join(indented_lines)
        wrapped_code = "async def __user_script__():" + chr(10) + indented_code

        # Execute to define the function
        exec(wrapped_code, namespace)

        # Now call and await the function
        await namespace['__user_script__']()

server = await setup_local_client(enable_execution=False, on_ready=execute)
`

console.log("Loading Pyodide...");
loadPyodide().then(async (pyodide) => {
    // Pyodide is now ready to use...
    console.log("Pyodide is ready to use.");
    pyodide.setStdout({
        batched: (msg) => {
            console.log(msg);
            self.postMessage({ type: 'stdout', message: msg });
        }
    });
    pyodide.setStderr({
        batched: (msg) => {
            console.error(msg);
            self.postMessage({ type: 'stderr', message: msg });
        }
    });
    await pyodide.loadPackage("micropip");
    const micropip = pyodide.pyimport("micropip");
    await micropip.install('hypha-rpc==0.20.84');

    // Signal that worker is ready - this goes to the parent
    setTimeout(() => {
        globalThis.postMessage({ type: "hyphaClientReady" });
    }, 10);

    // This will block until initializeHyphaClient is received
    await pyodide.runPythonAsync(startupScript);
    console.log("Hypha Web Python initialized.");
});
