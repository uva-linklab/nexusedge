const ipc = require('node-ipc');
const fs = require("fs-extra");

/**
 * Wrapper around a node-ipc object that avoids rewrite of the same config for the ipc object. Also exposes methods
 * like forwardMessage() and listenForEvent() to avoid directly using the ipc object. For IPC servers that need to
 * access the node-ipc object, this can be done using the getIPCObject() method.
 * Note: the service "platform" is treated as a special entity with a difference in the constructor logic.
 */
class MessagingService {
    /**
     * Creates a MessagingService object and registers the given service to the IPC platform
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

        //For all services except the platform manager, connect to the PlatformManager and send back socket
        if(serviceName !== "platform") {
            // Connect to platform manager and send
            ipc.connectTo('platform', () => {
                ipc.of.platform.on('connect', () => {
                    console.log(`[INFO] ${serviceName} connected to platform`);

                    let message = {
                        "meta": {
                            "sender": serviceName,
                        },
                        "payload": `${serviceName} sent back the socket.`
                    };
                    ipc.of.platform.emit("register-socket", message);
                });
                ipc.of.platform.on('disconnect', () => {
                    console.log(`[INFO] ${serviceName} disconnected from platform`);
                });
            });
        }
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

    /**
     * Use this function to send a query to any recipient and return a query response promise.
     * @param sender
     * @param recipient
     * @param query
     * @param queryParams
     * @return {Promise<queryResult>} Provides a query result from the query's recipient
     */
    query(sender, recipient, query, queryParams) {
        return new Promise((resolve, reject) => {
            ipc.of.platform.emit("forward", {
                "meta": {
                    "sender": sender,
                    "recipient": recipient,
                    "event": query
                },
                "payload": {
                    "query": {
                        "params": queryParams,
                        "meta": {
                            "sender": sender,
                            "event": query,
                            "recipient": recipient
                        }
                    }
                }
            });

            // wait for the <query>-response event which will be sent by the recipient
            ipc.of.platform.on(`${query}-response`, message => {
                // resolve the promise when we get it
                resolve(message.data);
            });
        });
    }

    /**
     * Listen for specific query events. The query can be obtained from the message in the callback as message.data.query.
     * @param queryEvent
     * @param callback
     */
    listenForQuery(queryEvent, callback) {
        ipc.of.platform.on(queryEvent, message => {
            callback(message);
        });
    }

    /**
     * To respond to a query, pass the received query to this function along with a response.
     * @param query same query object received from the query event (message.data.query)
     * @param response your response to the query
     */
    respondToQuery(query, response) {
        const sender = query['meta']['recipient'];
        const recipient = query['meta']['sender'];
        const event = `${query['meta']['event']}-response`; // send this to a "<query>-response" event
        ipc.of.platform.emit("forward", {
            "meta": {
                "sender": sender,
                "recipient": recipient,
                "event": event
            },
            "payload": response
        });
    }
}

module.exports = MessagingService;