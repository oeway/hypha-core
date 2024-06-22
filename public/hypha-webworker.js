importScripts("https://cdn.jsdelivr.net/npm/imjoy-rpc@0.5.51/dist/hypha-rpc-websocket.min.js");
hyphaWebsocketClient.setupLocalClient({enable_execution: true}).then(() => {
    console.log('Hypha RPC WebSocket Client initialized');
}).catch((error) => {
    document.body.innerHTML = '<h1>Error: ' + error + '</h1>';
});