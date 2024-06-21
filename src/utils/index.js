import { encode as msgpack_packb, Decoder } from "@msgpack/msgpack";
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
