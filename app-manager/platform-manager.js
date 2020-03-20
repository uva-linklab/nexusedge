const { fork } = require('child_process');

const appManager = fork(__dirname + "/app-manager.js");
const apiServer = fork(__dirname + "/../api-server/server.js");

let callback = function(messages) {
  if("appManager" in messages) {
    appManager.send(messages.appManager);
  }
  if("apiServer" in messages) {
    apiServer.send(messages.apiServer);
  }
}

appManager.on('message', callback);

apiServer.on("message", callback);
