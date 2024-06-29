
import { hyphaWebsocketClient } from 'imjoy-rpc';

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
from imjoy_rpc import api

class ImJoyPlugin():
    async def setup(self):
        await api.log('initialized')

    async def run(self, ctx):
        await api.alert('hello world.')

api.export(ImJoyPlugin())
</script>
`

export async function setupHyphaClients(server) {

    const api = await hyphaWebsocketClient.connectToServer({ server, workspace: "ws-1", client_id: "client-1" })
    
    let kaibuViewer = null;
    const chatbotExtension = {
        _rintf: true,
        id: "image-viewer",
        type: "bioimageio-chatbot-extension",
        name: "Image Viewer",
        description: "An extension to show images in Kaibu Interactive Viewer",
        config: {
            visibility: "public",
            require_context: false,
        },
        get_schema() {
            return {
                show_image: {
                    type: "object",
                    title: "ShowImage",
                    description: "Show Image in Kaibu Interactive Viewer",
                    properties: {
                        image_url: {
                            type: "string",
                            description: "The URL of the image to show",
                        },
                        name: {
                            type: "string",
                            description: "The name of the image",
                        },
                    },
                    required: ["image_url", "name"],
                }
            };
        },
        tools: {
            async show_image(config) {
                kaibuViewer = kaibuViewer || await api.createWindow({ src: "https://kaibu.org/#/app", pos: "side"})
                const layer = await kaibuViewer.view_image(config.image_url, {name: config.name})
                return `Image displayed in Kaibu Viewer, layer id ${layer.id}`
            }
        }
    }
    // const chatbot = await api.createWindow({ src: `https://bioimage.io/chat?assistant=Bridget`, pos: "main"})
    // await chatbot.registerExtension(chatbotExtension)
    // const viewer = await api.createWindow({ src: "https://kaibu.org/#/app", pos: "main"})
    // await viewer.view_image("https://images.proteinatlas.org/61448/1319_C10_2_blue_red_green.jpg")

    // // console.log("chatbot initialized:", chatbot)
    // const webPython = await api.loadPlugin({src: test_web_python_src})
    // await webPython.run({});
    // // const webPython = await api.loadPlugin({src: "https://raw.githubusercontent.com/imjoy-team/imjoy-core/master/src/plugins/webPythonTemplate.imjoy.html"})
    // // await webPython.run({});

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
    // const svc2 = await server2.getService(svc.id)
    // const ret = await svc2.hello("John")
    // assert(ret === "Hello John!", "hello failed")
    // console.log("hello-world service successfully tested:", svc);



    const iframeWindow = await api.loadPlugin({src: "https://raw.githubusercontent.com/imjoy-team/imjoy-core/master/src/plugins/windowTemplate.imjoy.html"})
    await iframeWindow.run();
    console.log("iframeWindow:", iframeWindow)

    const plugin = await api.loadPlugin({src: "https://raw.githubusercontent.com/imjoy-team/imjoy-core/master/src/plugins/webWorkerTemplate.imjoy.html"})
    await plugin.run();
    console.log("web-worker plugin:", plugin)
};
