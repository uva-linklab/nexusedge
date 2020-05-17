const ipc = require('node-ipc');

class PlatformMessenger {
    /**
     * Creates a PlatformMessenger object and registers the given service to the IPC platform
     * @param serviceName Name of the service that needs to be registered
     */
    constructor(serviceName) {
        // Create socket directory if not present
        fs.ensureDirSync(`${__dirname}/socket`);

        // Reference: http://riaevangelist.github.io/node-ipc/#ipc-config
        ipc.config.appspace = "gateway.";
        ipc.config.socketRoot = __dirname + "/socket/"; //path where the socket directory is created
        ipc.config.id = serviceName;
        ipc.config.retry = 1500; //client waits 1500 milliseconds before trying to reconnect to server if connection is lost
        ipc.config.silent = true; //turn off IPC logging

        // Connect to platform manager and send
        ipc.connectTo('platform', () => {
            ipc.of.platform.on('connect', () => {
                console.log(`${serviceName} connected to platform`);

                //TODO check if this is necessary
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
    }

    getIPCObject() {
        return ipc;
    }

    /**
     * Forwards message via IPC to the recipient specified. Adds a layer of metadata to the payload with all of the
     * communication details.
     * @param sender service-name of self
     * @param recipient service to which message is to be forwarded
     * @param event the name of the event the recipient should be listening for
     * @param payload contents of the message
     */
    forwardMessage(sender, recipient, event, payload) {
        ipc.of.platform.emit("forward", {
            "meta": {
                "sender": sender,
                "recipient": recipient,
                "event": event
            },
            "payload": payload
        });
    };

    listenForEvent(event, callback) {
        ipc.of.platform.on(event, message => {
            callback(message);
        });
    };
}

module.exports = PlatformMessenger;


// module.exports.register = function(serviceName) {
//     // Reference: http://riaevangelist.github.io/node-ipc/#ipc-config
//     ipc.config.appspace = "gateway.";
//     ipc.config.socketRoot = __dirname + "/socket/"; //path where the socket directory is created
//     ipc.config.id = serviceName;
//     ipc.config.retry = 1500; //client waits 1500 milliseconds before trying to reconnect to server if connection is lost
//     ipc.config.silent = true; //turn off IPC logging
//
//     // Connect to platform manager and send
//     ipc.connectTo('platform', () => {
//         ipc.of.platform.on('connect', () => {
//             console.log(`${serviceName} connected to platform`);
//
//             //TODO check if this is necessary
//             let message = {
//                 "meta": {
//                     "sender": serviceName,
//                 },
//                 "payload": `${serviceName} sent back the socket.`
//             };
//             ipc.of.platform.emit("register-socket", message);
//         });
//         ipc.of.platform.on('disconnect', () => {
//             console.log(`${serviceName} disconnected from platform`);
//         });
//     });
// };

// /**
//  * Forwards message via IPC to the recipient specified. Adds a layer of metadata to the payload with all of the
//  * communication details.
//  * @param sender service-name of self
//  * @param recipient service to which message is to be forwarded
//  * @param event the name of the event the recipient should be listening for
//  * @param payload contents of the message
//  */
// module.exports.forwardMessage = function(sender, recipient, event, payload) {
//     ipc.of.platform.emit("forward", {
//         "meta": {
//             "sender": sender,
//             "recipient": recipient,
//             "event": event
//         },
//         "payload": payload
//     });
// };
//
// module.exports.subscribeForEvent = function(event, callback) {
//     ipc.of.platform.on(event, message => {
//         callback(message);
//     });
// };