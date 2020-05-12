const ipc = require('node-ipc');
// ipc settings
// Reference:
// http://riaevangelist.github.io/node-ipc/#ipc-config

/**
 * Registers a given service to the IPC platform
 * @param serviceName Name of the service that needs to be registered
 */
module.exports.register = function(serviceName) {
    ipc.config.appspace = "gateway.";
    ipc.config.socketRoot = __dirname + "/socket";
    ipc.config.id = serviceName;
    //TODO check if these are needed
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
};

/**
 * Forwards message via IPC to the recipient specified. Adds a layer of metadata to the payload with all of the
 * communication details.
 * @param sender service-name of self
 * @param recipient service to which message is to be forwarded
 * @param event the name of the event the recipient should be listening for
 * @param payload contents of the message
 */
module.exports.forwardMessage = function(sender, recipient, event, payload) {
    ipc.of.platform.emit("forward", {
        "meta": {
            "sender": sender,
            "recipient": recipient,
            "event": event
        },
        "payload": payload
    });
};

module.exports.subscribeForEvent = function(event, callback) {

};