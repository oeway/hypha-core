// ESM entry point for hypha-core (modern browsers/Node.js)
// This provides clean named exports using the Deno build (which has no webpack overhead)

export { HyphaCore, connectToServer, imjoyRPC, hyphaWebsocketClient, WebSocket, Workspace, WebsocketRPCConnection } from './dist/deno/hypha-core.js'; 