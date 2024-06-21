import "./App.css";
import { Greeting, Header } from "./components";
import React from "react";
import HyphaServer from "./hypha-core";
import { hyphaWebsocketClient } from 'imjoy-rpc';
import { assert } from './utils'
import { WebSocket } from 'mock-socket';

const App = () => {
  const setupHyphaServer = async () => {
    const port = 8080;
    const server = new HyphaServer(port);
    server.start();

    const userToken = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6Im5VVnFFeWx4WEp2bV9hSjE4YlBHbCJ9.eyJodHRwczovL2FwaS5pbWpveS5pby9yb2xlcyI6WyJhZG1pbiJdLCJodHRwczovL2FwaS5pbWpveS5pby9lbWFpbCI6Im9ld2F5MDA3QGdtYWlsLmNvbSIsImlzcyI6Imh0dHBzOi8vaW1qb3kuZXUuYXV0aDAuY29tLyIsInN1YiI6ImdpdGh1Ynw0Nzg2NjciLCJhdWQiOlsiaHR0cHM6Ly9pbWpveS5ldS5hdXRoMC5jb20vYXBpL3YyLyIsImh0dHBzOi8vaW1qb3kuZXUuYXV0aDAuY29tL3VzZXJpbmZvIl0sImlhdCI6MTcxODg3MzQzMywiZXhwIjoxNzE4OTU5ODMzLCJzY29wZSI6Im9wZW5pZCBwcm9maWxlIGVtYWlsIG9mZmxpbmVfYWNjZXNzIiwiYXpwIjoib2Zzdng2QTdMZE1oRzBoa2xyNUpDQUVhd0x2NFB5c2UifQ.U1X5DWIrQ8H0o9lBFzP9dydnGE9Ma-vCSi_H0hLviUU3ZH_327hKjI58a6XzY1OMD7Y3GxBtAKtaYolETTC3ZMD_iWqmYsGOYBU9nd9s69GqQw0GNeuzeknLZMnfUByK8LHCD96bpuPBBGlQ8T4nhdstqj-zaJ8dJcT6zvhBiMJbp7_G5HOHlXKi7M85terGSbqpV9KANsyknnj2b-QySCbS_4zXlmBtqqpX1ZE90cn8QYaIxwPkkWt6ijGFY1wwCInGR-HNbB6C_5RRljWUnbeVbj81ciZsGmmneIRy-3RuAKWIGi0I9ccCRQVfm-byLKSPVC78amzUZCkLdyPd4g";
    const server1 = await hyphaWebsocketClient.connectToServer({"server_url": "http://localhost:" + port, "token": userToken, "workspace": "ws-1", "client_id": "client-1", WebSocketClass: WebSocket})

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


    const iframeWindow = await server1.createWindow({src: "/iframe-template.html"})
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
