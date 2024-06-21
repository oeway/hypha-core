import { encode as msgpack_packb, Decoder } from "@msgpack/msgpack";
import { parseComponent } from "./pluginParser";
export class MessageEmitter {
    constructor(debug) {
        this._event_handlers = {};
        this._once_handlers = {};
        this._debug = debug;
    }
    emit() {
        throw new Error("emit is not implemented");
    }
    on(event, handler) {
        if (!this._event_handlers[event]) {
            this._event_handlers[event] = [];
        }
        this._event_handlers[event].push(handler);
    }
    once(event, handler) {
        handler.___event_run_once = true;
        this.on(event, handler);
    }
    off(event, handler) {
        if (!event && !handler) {
            // remove all events handlers
            this._event_handlers = {};
        } else if (event && !handler) {
            // remove all hanlders for the event
            if (this._event_handlers[event]) this._event_handlers[event] = [];
        } else {
            // remove a specific handler
            if (this._event_handlers[event]) {
                const idx = this._event_handlers[event].indexOf(handler);
                if (idx >= 0) {
                    this._event_handlers[event].splice(idx, 1);
                }
            }
        }
    }
    _fire(event, data) {
        if (this._event_handlers[event]) {
            var i = this._event_handlers[event].length;
            while (i--) {
                const handler = this._event_handlers[event][i];
                try {
                    handler(data);
                } catch (e) {
                    console.error(e);
                } finally {
                    if (handler.___event_run_once) {
                        this._event_handlers[event].splice(i, 1);
                    }
                }
            }
        } else {
            if (this._debug) {
                console.warn("unhandled event", event, data);
            }
        }
    }
}
export function randId() {
    return (
        Math.random()
            .toString(36)
            .substr(2, 10) + new Date().getTime()
    );
}

export function assert(condition, message) {
    if (!condition) {
        throw new Error(message || "Assertion failed");
    }
}

export class WebsocketRPCConnection {
    constructor(clients, clientId, workspace, userInfo, timeout = 60) {
        this._clients = clients;
        this._clientId = clientId;
        this._handle_message = null;
        this._reconnection_token = null;
        this._timeout = timeout * 1000; // converting to ms
        this.workspace = workspace;
        this.userInfo = userInfo;
    }

    register_socket(websocket){
        websocket.on('message', data => {
            const decoder = new Decoder();
            const unpacker = decoder.decodeMulti(data);
            
            const { value: message, done } = unpacker.next(); // Only unpack the main message
            const targetId = message.to.includes('/') ? message.to.split('/')[1] : message.to;
            if(targetId === this._clientId){
                this._handle_message(data.buffer);
            }
            else{
                this.emit_message(data);
            }
            
        });
    }

    set_reconnection_token(token) {
        this._reconnection_token = token;
    }

    on_message(handler) {
        assert(handler, "handler is required");
        this._handle_message = handler;
    }

    async emit_message(data) {
        assert(this._handle_message, "No handler for message");
        // Assuming `data` is an ArrayBuffer or Uint8Array containing your msgpack-encoded data
        const decoder = new Decoder();
        const unpacker = decoder.decodeMulti(data);
        
        const { value: message, done } = unpacker.next(); // Only unpack the main message
        // Assuming `this.workspace` and `this.clientId` are available in your context
        // and represent `_workspace` and `_client_id` from the Python code respectively
        let targetId = message.to;
        if (!targetId.includes("/")) {
            targetId = `${this.workspace}/${targetId}`;
        }
        if(!this._clients[targetId]){
            console.error('No client found for targetId:', targetId);
            return
        }
        const websocket = this._clients[targetId].socket;  
        if(!message.from.includes('/')){
            message.from = `${this.workspace}/${message.from}`;
        }
        // Update the message with new fields
        const updatedMessage = {
            ...message,
            to: targetId,
            from: message.from,
            user: this.userInfo, // Assuming `this.userInfo` represents `_user_info` from Python
        };
        // Re-encode the updated message
        const encodedUpdatedMessage = msgpack_packb(updatedMessage);

        // Assuming `pos` is the position where the original main message ended
        // and there's additional data in `data` that should be appended after the updated message
        const pos = decoder.pos; // Equivalent to unpacker.tell() in Python
        const remainingData = data.slice(pos); // Get remaining data after the main message
        const finalData = new Uint8Array(encodedUpdatedMessage.length + remainingData.length);
        // Combine the updated message and any remaining data into `finalData`
        finalData.set(encodedUpdatedMessage, 0);
        finalData.set(new Uint8Array(remainingData), encodedUpdatedMessage.length);
        if(!websocket || ! websocket.send){
            console.error('No websocket found for targetId:', targetId);
            return
        }
        websocket.send(finalData.buffer);
    }

    disconnect(reason) {
        console.info(`Websocket connection disconnected (${reason})`);
    }
}

const CONFIGURABLE_FIELDS = [
    "env",
    "requirements",
    "dependencies",
    "icon",
    "ui",
    "type",
    "flags",
    "labels",
    "cover",
    "base_frame",
    "base_worker",
    "passive",
];

export function parsePluginCode(code, overwrite_config) {
    overwrite_config = overwrite_config || {};
    try {
        const pluginComp = parseComponent(code);
        let config;
        if (pluginComp.config[0].attrs.lang === "yaml") {
            throw new Error("YAML not supported")
            // config = yaml.load(pluginComp.config[0].content);
        } else if (pluginComp.config[0].attrs.lang === "json") {
            config = JSON.parse(pluginComp.config[0].content);
        } else {
            config = JSON.parse(pluginComp.config[0].content);
            if (compareVersions(config.api_version, ">", "0.1.5")) {
            throw `Unsupported config language ${
                pluginComp.config[0].attrs.lang
            }, please set lang="json" or lang="yaml"`;
            }
        }

        config.tag = overwrite_config.tag || (config.tags && config.tags[0]);
        (config.hot_reloading = overwrite_config.hot_reloading),
            (config.scripts = []);
        // try to match the script with current tag
        for (let i = 0; i < pluginComp.script.length; i++) {
            if (pluginComp.script[i].attrs.tag === config.tag) {
            config.script = pluginComp.script[i].content;
            }

            // exclude script with mismatched tag
            if (
            !pluginComp.script[i].attrs.tag ||
            pluginComp.script[i].attrs.tag === config.tag
            ) {
            config.scripts.push(pluginComp.script[i]);
            }
        }
        if (!config.script && pluginComp.script.length > 0) {
            config.script = pluginComp.script[0].content;
            config.lang = pluginComp.script[0].attrs.lang;
        }
        config.links = pluginComp.link || null;
        config.windows = pluginComp.window || null;
        config.styles = pluginComp.style || null;
        config.docs = (pluginComp.docs && pluginComp.docs[0]) || config.docs;
        config.attachments = pluginComp.attachment || null;

        config._id = overwrite_config._id || config.name.replace(/ /g, "_");
        config.uri = overwrite_config.uri;
        config.origin = overwrite_config.origin;
        config.namespace = overwrite_config.namespace;
        config.code = code;
        config.id = config.name.trim().replace(/ /g, "_") + "_" + randId();
        config.runnable = config.runnable === false ? false : true;
        config.requirements = config.requirements || [];

        for (let i = 0; i < CONFIGURABLE_FIELDS.length; i++) {
            const obj = config[CONFIGURABLE_FIELDS[i]];
            if (obj && typeof obj === "object" && !(obj instanceof Array)) {
            if (config.tag) {
                config[CONFIGURABLE_FIELDS[i]] = obj[config.tag];
                if (!Object.prototype.hasOwnProperty.call(obj, config.tag)) {
                console.log(
                    "WARNING: " +
                    CONFIGURABLE_FIELDS[i] +
                    " do not contain a tag named: " +
                    config.tag
                );
                }
            } else {
                throw "You must use 'tags' with configurable fields.";
            }
            }
        }
        config.lang = config.lang || "javascript";
        
        return config;
    } catch (e) {
        console.error(e);
        throw `Failed to parse the plugin file, error: ${e}`;
    }
}
