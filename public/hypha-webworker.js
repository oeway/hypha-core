importScripts("https://cdn.jsdelivr.net/npm/imjoy-rpc@0.5.53/dist/hypha-rpc-websocket.min.js");
hyphaWebsocketClient.setupLocalClient({enable_execution: true}).then((api)=>{
    console.log("Hypha WebWorker initialized.", api)
}).catch(console.error);