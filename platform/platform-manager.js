const { fork } = require('child_process');
const fs = require("fs-extra");
let ipc = require('node-ipc');

let services = [
  {
    type: "app-manager",
    path: __dirname + "/app-manager/app-manager.js",
    socket: undefined
  }, {
    type: "api-server",
    path: __dirname + "/api-server/server.js",
    socket: undefined
  }
];

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
  for(let service of services) {
    ipc.server.on(service.type, (data, socket) => {
      // receive socket from services
      service.socket = socket;
      console.log(`[PLATFORM] got a message from ${service.type}:`, data);
    });
  }
  // "app-deployment" event will be emitted by gateway-api-controller and pass the data to app-manager
  ipc.server.on("app-deployment", (data, socket) => {
    ipc.server.emit(services[0].socket, "app-deployment", data);
  });
});
ipc.server.start();

let managers = {};
// start services by fork
for(let service of services) {
  managers[service.type] = fork(service.path, [], {
    env: { role: service.type },
    // references:
    // 1. https://nodejs.org/docs/latest-v8.x/api/child_process.html#child_process_options_stdio
    // 2. https://nodejs.org/docs/latest-v8.x/api/child_process.html#child_process_subprocess_stdio
    stdio: [
      0, // Use platform's stdin for services
      fs.openSync(`${__dirname}/logs/${service.type}.out`, 'w'), // pipe service output to log
      fs.openSync(`${__dirname}/logs/${service.type}.err`, 'w'), // pipe service output to log
      "ipc"
    ]
  });
};
