const codeContainer = require(`${__dirname}/code-container/container`);
const fs = require("fs-extra");
const path = require("path");
const { fork } = require('child_process');
const crypto = require('crypto');
const daoHelper = require('../dao/dao-helper');
const MessagingService = require('../messaging-service');

console.log("[INFO] Initialize app-manager...");
const serviceName = process.env.SERVICE_NAME;
const messagingService = new MessagingService(serviceName);

// TODO: When initializing app-manager, app-manager checks database to see
//  if any apps already exists (zombie process). This happens when app-manager crashed abnormally.

// Create logs directory for apps if not present
fs.ensureDirSync(`${__dirname}/logs`);

// when starting up, remove all existing apps
daoHelper.appsDao.clearAll(); // asynchronous operation

// Stores the process, _id, pid, appPath, and metadataPath in apps
// apps = {
//     "app-name": {
//         "app": instance-of-process,
//         "pid": application-process-pid,
//         "_id": topic,
//         "appPath": application-executable-path,
//         "metadataPath": application-metadata-path
//     }
// }
const apps = {};

/**
 * This function generates the id of the new application.
 * The id is also used for application's topic
 * @param {string} appName
 * @returns {string}
 */
function generateAppId(appName) {
    // The fastest algorithm is sha1-base64
    // Reference: https://medium.com/@chris_72272/what-is-the-fastest-node-js-hashing-algorithm-c15c1a0e164e
    const hash = crypto.createHash('sha1');
    // Use the timestamp and application's name to create id
    hash.update(Date.now().toString() + appName);
    return hash.digest('hex');
}

// When app-manager get appPath and metadataPath from platform-manager,
// app-manager will fork a process for executing new app.
messagingService.listenForEvent('app-deployment', message => {
    let appData = message.data;
    if(appData.appPath && appData.metadataPath) {
        codeContainer.setupAppRuntimeEnvironment(appData.appPath, appData.metadataPath)
            .then((newAppPath) => {
                // newAppPath = /on-the-edge/app-manager/code-container/executables/1583622378159/app.js
                let appName = path.basename(newAppPath);
                // Generate application's id
                // The id is also used for application's topic
                let appId  = generateAppId(appName);

                // Using fork() to create a child process for a new application
                // Using fork() not spawn() is because fork is a special instance of spawn for creating a Nodejs child process.
                // Reference:
                // https://stackoverflow.com/questions/17861362/node-js-child-process-difference-between-spawn-fork

                // use "ipc" in options.stdio to setup ipc between the parent process and the child process
                // Reference: https://nodejs.org/api/child_process.html#child_process_options_stdio
                const newApp = fork(newAppPath, [], {
                    env: { TOPIC: appId },
                    stdio: [
                        0,
                        fs.openSync(`${__dirname}/logs/${appName}.out`, 'a'),
                        fs.openSync(`${__dirname}/logs/${appName}.out`, 'a'),
                        "ipc"
                    ]
                });
                // Save application's _id, name, application path, metadata path, and pid in mongodb
                daoHelper.appsDao.saveAppInfo(appId,
                    path.basename(newAppPath),
                    newAppPath,
                    appData.metadataPath,
                    newApp.pid.toString()
                );

                // Stores the process, _id, pid, appPath, and metadataPath in apps
                // The _id is also used for application's topic
                apps[appName] = {
                    "_id": appId,
                    "app": newApp, // instance of process,
                    "pid": newApp.pid,
                    "appPath": newAppPath,
                    "metadataPath": appData.metadataPath
                };

                console.log(`[INFO] Launched ${newAppPath} successfully!`);
                console.log(`   time: ${new Date().toISOString()}`);
                console.log(`   path: ${newAppPath}`);
                console.log(`    _id: ${appId}`);
                console.log(`    pid: ${newApp.pid}`);
                // sends application's information to sensor-stream-manager
                // for registering the topic and sensor data requirement.
                messagingService.forwardMessage(serviceName, "sensor-stream-manager", "app-deployment", {
                    "app": apps[appName],
                });
            })
            .catch(err => console.error(err));
    }
});

messagingService.listenForEvent('send-to-device', message => {
    messagingService.forwardMessage(serviceName, 'device-manager', 'send-to-device', message.data);
});