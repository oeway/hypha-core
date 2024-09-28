# Hypha Core

Hypha Core for running Hypha App and ImJoy Plugins in the browser.


## Usage

Hypha core is available as a ES module, you can import it in your HTML file like this:

```html
<script src="https://rawcdn.githack.com/nextapps-de/winbox/0.2.82/dist/winbox.bundle.min.js"></script>
<script type="module">
    import { HyphaCore } from "https://cdn.jsdelivr.net/npm/hypha-core@0.20.38/dist/hypha-core.mjs";
    const hyphaCore = new HyphaCore();
    hyphaCore.on("add_window", (config) => {
        const wb = new WinBox(config.name || config.src.slice(0, 128), {
            background: "#448aff",
        });
        wb.body.innerHTML = `<iframe src="${config.src}" id="${config.window_id}" style="width: 100%; height: 100%; border: none;"></iframe>`;
    });
    const api = await hyphaCore.start();
    // use api to interact with the server


    // you can also create new connections to the server by calling:
    // const api2 = await hyphaCore.connect();
</script>
```

In the above example we use the `WinBox` library to create a window for each Hypha App or ImJoy Plugin. You can use any other window library or create your own window.

Importantly, you need to serve the 3 template files under the root of your server, you can find the template files in the `public` folder of this repository:

 - [hypha-app-iframe.html](./public/hypha-app-iframe.html)
 - [hypha-app-webpython.js](./public/hypha-app-webpython.js)
 - [hypha-app-webworker.js](./public/hypha-app-webworker.js)

You can also configure the base url by passing {base_url: "your_base_url"} to the `HyphaCore` constructor.

See [lite.html](./public/lite.html) for an example of how to use Hypha Core in the browser.
