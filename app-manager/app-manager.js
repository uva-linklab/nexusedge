const codeContainer = require('./code-container/container');
const path = require("path");
const { fork } = require('child_process');

// APPS stores app name, topic, and pid
let APPS = {};

/**
 * This function generates the topic for new coming app.
 * TODO: use app name or other?
 * @param {string} appName
 * @returns {string}
 */
let getTopic = function(appName) {
  let topic = appName;
  return topic;
}

// when app-manager get appPath and metadataPath from platform-manager,
// app-manager will fork a process for executing new app
process.on('message', (cmd) => {
  if(cmd.appPath && cmd.metadataPath) {
    codeContainer.setApp(cmd.appPath, cmd.metadataPath)
      .then((newAppPath) => {
        let appName = path.basename(newAppPath);

        // fork a process for a new app
        // Use spaw or fork?
        // https://stackoverflow.com/questions/17861362/node-js-child-process-difference-between-spawn-fork
        const newApp = fork(newAppPath);

        // get the topic, pid and store them in APPS
        APPS[appName] = {
          topic: getTopic(appName),
          pid: newApp.pid
        };

        newApp.stdout.on('data', (data) => {
          console.log(data.toString().trim());
        });

        newApp.stderr.on('data', (data) => {
          console.error(data.toString());
        });

        newApp.on('exit', (data) => {
          console.log("script exited");
        });
      })
      .catch(err => console.error(err));
    }
});