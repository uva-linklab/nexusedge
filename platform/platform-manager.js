const { fork } = require('child_process');
const fs = require("fs-extra");
const MessagingService = require('./messaging-service');

console.log("[INFO] Initialize platform-manager...");
const messagingService = new MessagingService("platform");

const services = {
    "app-manager": {
        path: __dirname + "/app-manager/app-manager.js",
        socket: undefined,
        process: undefined
    },
    "api-server": {
        path: __dirname + "/api-server/server.js",
        socket: undefined,
        process: undefined
    },
    "sensor-stream-manager": {
        path: __dirname + "/sensor-stream-manager/sensor-stream-manager.js",
        socket: undefined,
        process: undefined
    },
    "device-manager": {
        path: __dirname + "/device-manager/device-manager.js",
        socket: undefined,
        process: undefined
    },
    "data-publish-manager": {
        path: __dirname + "/data-publish-manager/data-publish-manager.js",
        socket: undefined,
        process: undefined
    },
};

// ipcCallback stores all the call back function used by ipc server.
// The data format is described below.
// data = {
//   "meta": {
//     "recipient": "app-manager",
//     "event": "app-deployment",
//     "sender": "api-server",
//   },
//   "payload": {}
// }
const ipcCallback = {
    /**
     * The function forwards the message from the sender to the recipient
     * and is the call back function used for `forward` event.
     * @param data
     */
    "forward": function (data) {
        if("meta" in data && data["meta"]["sender"] in services) {
            let message = {
                sender: data["meta"]["sender"],
                // TODO: since we call it "payload" in forwardMessage, this should also be called payload.
                data: data["payload"]
            };
            ipc.server.emit(services[data["meta"]["recipient"]].socket,
                            data["meta"]["event"],
                            message);
            console.log("[INFO] Forwarded msg.");
            console.log(`  Event: ${data["meta"]["event"]}`);
            console.log(`   From: ${data["meta"]["sender"]}`);
            console.log(`     To: ${data["meta"]["recipient"]}`);
        }
    },
    /**
     * The function stores the socket from the sender
     * and is the call back function used for `register-socket` event.
     * @param data
     * @param socket
     */
    "register-socket": function (data, socket) {
        if("meta" in data && data["meta"]["sender"] in services) {
            // receive socket from services
            services[data["meta"]["sender"]].socket = socket;
            console.log(`[INFO] Got a socket from ${data["meta"]["sender"]}`);
        }
    }
};

// ipc server for services
// Reference: http://riaevangelist.github.io/node-ipc/#serve
const ipc = messagingService.getIPCObject();
ipc.serve(() => {
    // get the socket from services
    ipc.server.on("register-socket", ipcCallback["register-socket"]);
    // listen to forward event
    ipc.server.on("forward", ipcCallback["forward"]);
    ipc.server.on('socket.disconnected', (socket, destroyedSocketID) => {
        ipc.log('client ' + destroyedSocketID + ' has disconnected!');
    });
});
ipc.server.start();

// Create logs directory if not present
fs.ensureDirSync(`${__dirname}/logs`);

// we pass all environment variables of platform-manager to its children
const childEnv = process.env;
for(let serviceName in services) {
    childEnv["SERVICE_NAME"] = serviceName; // used by the IPC platform to set the id of the service
    const forkedProcess = fork(services[serviceName]["path"], [], {
        env: childEnv,
        // References:
        // 1. https://nodejs.org/docs/latest-v8.x/api/child_process.html#child_process_options_stdio
        // 2. https://nodejs.org/docs/latest-v8.x/api/child_process.html#child_process_subprocess_stdio
        stdio: [
            0, // Use platform's stdin for services
            fs.openSync(`${__dirname}/logs/${serviceName}.out`, 'w'), //append service's stdout to log
            fs.openSync(`${__dirname}/logs/${serviceName}.out`, 'a'), //append service's stderr to same log
            "ipc"
        ]
    });
    services[serviceName]["process"] = forkedProcess;
    console.log(`[INFO] ${serviceName} process forked with pid: ${services[serviceName]["process"].pid}.`);

    // listen for error messages from child services
    forkedProcess.on("message", messageStr => {
       const message = JSON.parse(messageStr);
       if(message.hasOwnProperty("error") && message.hasOwnProperty("service")) {
           const error = message["error"];
           const service = message["service"];
           console.error(`Error in ${service}: ${error}`);
           console.log("Exiting...");
           process.exit(1);
       }
    });
}

