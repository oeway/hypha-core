import "./App.css";
import { Greeting, Header } from "./components";
import React from "react";
import HyphaServer from "./hypha-server";
import { hyphaWebsocketClient } from 'imjoy-rpc';
import { assert } from './utils'
import { WebSocket } from 'mock-socket';

const App = () => {
  const setupHyphaServer = async () => {
    const port = 8080;
    const server = new HyphaServer(port);
    server.start();
    server.on("add_window", (config)=>{
      const elem = document.createElement("iframe");
      elem.src = config.src;
      elem.style.width = "100%";
      elem.style.height = "100%";
      elem.style.border = "none";
      elem.id = config.window_id;
      const container = document.getElementById("window-container");
      container.appendChild(elem);
    })

    const server1 = await hyphaWebsocketClient.connectToServer({"server_url": "http://localhost:" + port, "workspace": "ws-1", "client_id": "client-1", WebSocketClass: WebSocket})

    await server1.log("hi-server1")
    const token = await server1.generateToken();
    console.log("token:", token)
    const server2 = await hyphaWebsocketClient.connectToServer({"server_url": "http://localhost:" + port, "workspace": "ws-2", "client_id": "client-2", WebSocketClass: WebSocket})
    await server2.log("hi-server2")

    assert(await server1.echo("hello") === "hello", "echo failed")

    const svc = await server1.registerService({
        "id": "hello-world",
        "name": "Hello World",
        "description": "A simple hello world service",
        "config": {
            "visibility": "public",
            "require_context": false,
        },
        "hello": (name) => {
            return `Hello ${name}!`;
        },
    })
    const svc2 = await server2.getService("hello-world")
    const ret = await svc2.hello("John")
    assert(ret === "Hello John!", "hello failed")
    console.log("hello-world service successfully tested:", svc);

    const plugin = await server1.loadPlugin("https://raw.githubusercontent.com/imjoy-team/imjoy-core/master/src/plugins/webWorkerTemplate.imjoy.html")
    await plugin.run();
    console.log("web-worker plugin:", plugin)

    const iframeWindow = await server1.createWindow({src: "https://raw.githubusercontent.com/imjoy-team/imjoy-core/master/src/plugins/windowTemplate.imjoy.html"})
    await iframeWindow.run();
    console.log("iframeWindow:", iframeWindow)

  };

  return (
    <div className="container">
      <Header />
      <Greeting name="🙏" />
      <button onClick={ setupHyphaServer }>Start Hypha Server</button>
      <div id="window-container"></div>
    </div>
  );
};

export default App;
