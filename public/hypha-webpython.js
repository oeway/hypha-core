importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.1/full/pyodide.js");

const startupScript = `
from imjoy_rpc.hypha import setup_local_client
server = await setup_local_client(enable_execution=True)
`
console.log("Loading Pyodide...");
loadPyodide().then(async (pyodide) => {
    // Pyodide is now ready to use...
    console.log("Pyodide is ready to use.");
    await pyodide.loadPackage("micropip");
    const micropip = pyodide.pyimport("micropip");
    await micropip.install('imjoy-rpc==0.5.53-post5');
    const isWindow = typeof window !== "undefined";
    if (isWindow) {
        window.parent.postMessage({ type: "hyphaClientReady" }, "*");
    } else {
        self.postMessage({ type: "hyphaClientReady" });
    }
    await pyodide.runPythonAsync(startupScript)
    console.log("Hypha Web Python initialized.");
});