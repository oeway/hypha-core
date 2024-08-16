
import { assert } from "./utils/index.js";
import { hyphaWebsocketClient } from 'hypha-rpc';

const test_web_python_src = `
<docs lang="markdown">
[TODO: write documentation for this plugin.]
</docs>

<config lang="json">
{
  "name": "Untitled Plugin",
  "type": "web-python",
  "version": "0.1.0",
  "description": "[TODO: describe this plugin with one sentence.]",
  "tags": [],
  "ui": "",
  "cover": "",
  "inputs": null,
  "outputs": null,
  "flags": [],
  "icon": "extension",
  "api_version": "0.1.7",
  "env": "",
  "permissions": [],
  "requirements": [],
  "dependencies": []
}
</config>

<script lang="python">
from hypha_rpc import api

class HyphaApp():
    async def setup(self):
        await api.log('initialized')

    async def run(self, ctx):
        await api.alert('hello world.')

api.export(HyphaApp())
</script>
`
export async function setupHyphaClients(api) {

    // const uiDesigner = await api.getService(reactUI.id)
    // await uiDesigner.renderApp(`const {useState, useEffect} = React; const App = () => { return <div>Hello World!</div>; }; export default App;`);

    // let kaibuViewer = null;
    // let currentScript = "";
    // const chatbotExtension = {
    //     _rintf: true,
    //     id: "ui-designer",
    //     type: "bioimageio-chatbot-extension",
    //     name: "Design React UI",
    //     description: "React UI Designer, design and render React UI components. The UI script along with the rendered view will be displayed, no need to show code to the end user; Always test your UI with the test script until it produces the expected behavior.",
    //     config: {
    //         visibility: "public",
    //         require_context: false,
    //     },
    //     async get_state(){
    //         return {
    //             "Current Script": await uiDesigner.getScript(),
    //             "Tips for scripting": `
    //             - Keep in mind the User do not know coding, so instead telling the user about the code issues, try to fix it.
    //             - Always test your UI with the test script until it produces the expected behavior.
    //             - You have access to a set of ImJoy api, for example, to display an image in interactive viewer, you can use the \`api.createWindow\` function.
    //             e.g.
    //             const viewer = await api.createWindow({ src: "https://kaibu.org/#/app", name: "Kaibu"})
    //             await viewer.view_image("https://images.proteinatlas.org/61448/1319_C10_2_blue_red_green.jpg")
    //             // note you cannot use jest to access the dom of the viewer, you need to manually check the viewer.
    //             // to test the viewer, you can use \`await api.getWindow("Kaibu")\` to test if the viewer is created.
    //             `
    //         };
    //     },
    //     get_schema() {
    //         return {
    //             render_app: {
    //                 type: "object",
    //                 title: "RenderApp",
    //                 description: "Render a React Component with babel(7.24.7), react(17.0.2) and tailwindcss for styling.",
    //                 properties: {
    //                     script: {
    //                         type: "string",
    //                         description: "A react component script, for example: `const {useState, useEffect} = React; const App = () => { return <div>Hello World!</div>; }; export default App;`",
    //                     },
    //                     testScript: {
    //                         type: "string",
    //                         description: "A jest test script using testingLibrary (the component is already rendered, no need to call render() explicitly, but you need to waitFor event to be handled by react), for example: `const {screen, waitFor} = testingLibraryDom; const userEvent = testingLibraryUserEvent; describe('App Component', () => { it('renders hello world', () => { expect(screen.getByText(/hello world/i)).toBeInTheDocument(); }); });`",
    //                     },
    //                 },
    //                 required: ["script"],
    //             },
    //         };
    //     },
    //     tools: {
    //         async render_app(config) {
    //             const report = await uiDesigner.renderApp(config.script, config.testScript);
    //             currentScript = config.script;
    //             return report //"The UI script displayed to the user, and rendered as React UI successfully!";
    //         }
    //     }
    // }
    // const chatbot = await api.createWindow({ src: `https://bioimage.io/chat?assistant=Skyler`, pos: "main"})
    // await chatbot.registerExtension(chatbotExtension);

    const editor = await api.createWindow({ src: "https://if.imjoy.io", pos: "main"})
    
    await editor.run({ config: {}, data: {} });
    // const viewer = await api.createWindow({ src: "https://kaibu.org/#/app", pos: "main"})
    // await viewer.view_image("https://images.proteinatlas.org/61448/1319_C10_2_blue_red_green.jpg")

    // // console.log("chatbot initialized:", chatbot)
    // const webPython = await api.loadPlugin({src: test_web_python_src})
    // await webPython.run({});
    

    // const webPython = await api.loadPlugin({src: "https://raw.githubusercontent.com/imjoy-team/imjoy-core/master/src/plugins/webPythonTemplate.imjoy.html"})
    // await webPython.run({});

    // const viewer = await api.createWindow({src: "https://kaibu.org/#/app"})
    // await viewer.view_image("https://images.proteinatlas.org/61448/1319_C10_2_blue_red_green.jpg")
    // console.log("kaibu viewer initialized:", viewer)

    // const vizarr = await api.createWindow({ src: 'https://hms-dbmi.github.io/vizarr' });
    // await vizarr.add_image({ source: 'https://uk1s3.embassy.ebi.ac.uk/idr/zarr/v0.1/6001240.zarr' });

    // await api.log("hi-api")
    // const token = await api.generateToken();
    // console.log("token:", token)
    // const server2 = await hyphaWebsocketClient.connectToServer({"server_url": hyphaServer.url, "workspace": "ws-2", "client_id": "client-2", WebSocketClass: WebSocket})
    // await server2.log("hi-server2")

    // assert(await api.echo("hello") === "hello", "echo failed")

    // const svc = await api.registerService({
    //     "id": "hello-world",
    //     "name": "Hello World",
    //     "description": "A simple hello world service",
    //     "config": {
    //         "visibility": "public",
    //         "require_context": false,
    //     },
    //     "hello": (name) => {
    //         return `Hello ${name}!`;
    //     },
    // })
    // const svc2 = await api.getService(svc.id)
    // const ret = await svc2.hello("John")
    // assert(ret === "Hello John!", "hello failed")
    // console.log("hello-world service successfully tested:", svc);
    // console.log("services", await api.listServices())


    const iframeWindow = await api.loadPlugin({src: "https://raw.githubusercontent.com/imjoy-team/imjoy-core/master/src/plugins/windowTemplate.imjoy.html"})

    await iframeWindow.run();
    console.log("iframeWindow:", iframeWindow)

    const plugin = await api.loadPlugin({src: "https://raw.githubusercontent.com/imjoy-team/imjoy-core/master/src/plugins/webWorkerTemplate.imjoy.html"})
    await plugin.run();
    console.log("web-worker plugin:", plugin)
    return api;
};
