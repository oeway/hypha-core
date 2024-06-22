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

    const chatbot = await server1.createWindow({src: "https://bioimage.io/chat"})
        
    const chatbotExtension = {
      _rintf: true,
      id: "my-extension",
      type: "bioimageio-chatbot-extension",
      name: "My Extension",
      description: "This is my extension",
      get_schema() {
          return {
              my_tool: {
                  type: "object",
                  title: "my_tool",
                  description: "my tool description",
                  properties: {
                      my_param: {
                          type: "number",
                          description: "This is my parameter doc"
                      }
                  }
              }
          };
      },
      tools: {
          my_tool(config) {
              console.log(config.my_param);
              return {result: "success"};
          }
      }
    }
    await chatbot.registerExtension(chatbotExtension)

    const viewer = await server1.createWindow({src: "https://kaibu.org/#/app"})
    await viewer.view_image("https://images.proteinatlas.org/61448/1319_C10_2_blue_red_green.jpg")
    console.log("kaibu viewer initialized:", viewer)

    const vizarr = await server1.createWindow({ src: 'https://hms-dbmi.github.io/vizarr' });
    await vizarr.add_image({ source: 'https://uk1s3.embassy.ebi.ac.uk/idr/zarr/v0.1/6001240.zarr' });

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
