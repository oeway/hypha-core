importScripts("https://cdn.jsdelivr.net/npm/imjoy-rpc@0.5.49/dist/hypha-rpc-websocket.min.js")

// create a temporary event listener to initiate the connection
self.addEventListener("message", (event) => {
    const { type, server_url, workspace, client_id, config } = event.data;
    if(type === "initializeHyphaClient"){
        if(!server_url || !workspace || !client_id){
            console.error("server_url, workspace, and client_id are required.");
            return;
        }
        class WebSocketProxy {
            constructor(url) {
                this.url = url;
                this.onopen = () => {};
                this.onmessage = () => {};
                this.onclose = () => {};
                this.onerror = () => {};

                this.readyState = WebSocket.CONNECTING;
                self.addEventListener("message", (event) => {
                    const { type, data, to } = event.data;
                    if(to !== client_id) {
                        console.debug("message not for me", to, client_id);
                        return;
                    }
                    switch (type) {
                        case "message":
                            if(this.readyState === WebSocket.OPEN && this.onmessage){
                                this.onmessage({data: data});
                            }
                            break;
                        case "connected":
                            this.readyState = WebSocket.OPEN;
                            this.onopen();
                            break
                        case "closed":
                            this.readyState = WebSocket.CLOSED;
                            this.onclose();
                            break;
                        default:
                            break;
                    }
                }, false);
                self.postMessage({type: "connect", url: this.url, from: client_id, workspace});
            }

            send(data){
                if(this.readyState === WebSocket.OPEN){
                    self.postMessage({type: "message", data: data, from: client_id, workspace});
                }
            }

            close(){
                this.readyState = WebSocket.CLOSING;
                self.postMessage({type: "close", from: client_id, workspace});
                this.onclose();
            }

            addEventListener(type, listener){
                if(type === "message"){
                    this.onmessage = listener;
                }
                if(type === "open"){
                    this.onopen = listener;
                }
                if(type === "close"){
                    this.onclose = listener;
                }
                if(type === "error"){
                    this.onerror = listener;
                }
            }
        }
        hyphaWebsocketClient.connectToServer({server_url, workspace, client_id, WebSocketClass: WebSocketProxy}).then((server) => {
            globalThis.api = server;
            server.log("Webworker plugin connected to the server.")
            if(config.script){
                try{
                    eval(config.script);
                    self.postMessage({type: "executeSuccess", from: client_id, workspace});
                }catch(e){
                    self.postMessage({type: "executeError", error: e.message, from: client_id, workspace});
                }
            }
        });
    }
}, false);
