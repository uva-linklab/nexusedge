const { fork } = require('child_process');
const fs = require("fs-extra");
let ipc = require('node-ipc');

let services = {
  "app-manager": {
    path: __dirname + "/app-manager/app-manager.js",
    socket: undefined,
    process: undefined
  },
  "api-server": {
    path: __dirname + "/api-server/server.js",
    socket: undefined,
    process: undefined
  }
};

/**
  * data = {
  *  "sender": "api-server",
  *  "_meta": {
  *  "recipient": "app-manager",
  *  "event": "app-deployment",
  *  "data": {}
  * }
  */
let ipcCallback = {
  /**
   * The function forward the message from the sender to the recipient.
   * @param data
   */
  forward: function (data) {
    if(data["sender"] in services) {
      let message = {
        sender: data["sender"],
        data: data["_meta"]["data"]
      };
      ipc.server.emit(services[data["_meta"]["recipient"]].socket,
                      data["_meta"]["event"],
                      message);
    }
  },
    /**
   * The function store the socket from the sender.
   * @param data
   * @param socket
   */
  "register-socket": function (data, socket) {
    if(data["sender"] in services) {
      // receive socket from services
      services[data["sender"]].socket = socket;
      // TODO: figure out why printing twice
      console.log(`[PLATFORM] got a socket from ${data["sender"]}`);
    }
  }
}

// ipc settings
// reference: http://riaevangelist.github.io/node-ipc/#ipc-config
ipc.config.appspace = "gateway."
ipc.config.socketRoot = "./socket/"
ipc.config.id = 'platform';
ipc.config.retry = 1500;
ipc.config.silent = true;

// ipc server for services
// reference: http://riaevangelist.github.io/node-ipc/#serve
ipc.serve(() => {
  for(let service in services) {
    ipc.server.on("register-socket", ipcCallback["register-socket"]);
  }
  // listen to forward event
  ipc.server.on("forward", ipcCallback["forward"]);
});
ipc.server.start();

// start services by fork
for(let service in services) {
  services[service]["process"] = fork(services[service]["path"], [], {
    env: { role: service },
    // references:
    // 1. https://nodejs.org/docs/latest-v8.x/api/child_process.html#child_process_options_stdio
    // 2. https://nodejs.org/docs/latest-v8.x/api/child_process.html#child_process_subprocess_stdio
    stdio: [
      0, // Use platform's stdin for services
      fs.openSync(`${__dirname}/logs/${service}.out`, 'w'), // pipe service output to log
      fs.openSync(`${__dirname}/logs/${service}.err`, 'w'), // pipe service output to log
      "ipc"
    ]
  });
  console.log(`${service} is successfully created with pid: ${services[service]["process"].pid}.`);
};
