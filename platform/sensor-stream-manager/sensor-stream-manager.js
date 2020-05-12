//TODO: add mqtt-data-collector logic to SSM.
const ipc = require('node-ipc');
const path = require("path");
const WebSocket = require('ws');

const serviceName = process.env.SERVICE_NAME;
//TODO move all IPC related logic into a separate file

// ipc settings
// Reference:
// http://riaevangelist.github.io/node-ipc/#ipc-config
ipc.config.appspace = "gateway.";
ipc.config.socketRoot = path.normalize(`${__dirname}/../socket/`);
ipc.config.id = serviceName;
ipc.config.retry = 1500;
ipc.config.silent = true;

// Connect to platform manager
ipc.connectTo('platform', () => {
    ipc.of.platform.on('connect', () => {
        console.log(`${serviceName} connected to platform`);
        let message = {
            "meta": {
                "sender": serviceName,
            },
            "payload": `${serviceName} sent back the socket.`
        };
        ipc.of.platform.emit("register-socket", message);
    });
    ipc.of.platform.on('disconnect', () => {
        console.log(`${serviceName} disconnected from platform`);
    });
});

//TODO: remove test code

// setTimeout(function () {
//     console.log("send stuff to gateway-scanner");
//     const ipcPayload = {
//         "gateway-ip": "10.0.0.90",
//         "gateway-msg-payload": {
//             "_meta": {
//                 "recipient": "sensor-stream-manager",
//                 "event": "connect-to-socket"
//             },
//             "payload": {
//                 "ws-address": "ws://10.0.0.157:8080"
//             }
//         }
//     };
//     forwardMessage(serviceName, "gateway-scanner", "talk-to-gateway", ipcPayload);
// },10000);

/**
 * Forwards message via IPC to the recipient specified. Adds a layer of metadata to the payload with all of the
 * communication details.
 * @param sender service-name of self
 * @param recipient service to which message is to be forwarded
 * @param event the name of the event the recipient should be listening for
 * @param payload contents of the message
 */
function forwardMessage(sender, recipient, event, payload) {
    ipc.of.platform.emit("forward", {
        "meta": {
            "sender": sender,
            "recipient": recipient,
            "event": event
        },
        "payload": payload
    });
}

ipc.of.platform.on('connect-to-socket', message => {
    const payload = message.data;

    const wsAddress = payload["ws-address"];

});