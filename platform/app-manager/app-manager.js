const codeContainer = require(`${__dirname}/code-container/container`);
const fs = require("fs-extra");
const path = require("path");
const {fork, spawn} = require('child_process');
const crypto = require('crypto');
const Tail = require('tail').Tail;
const MessagingService = require('../messaging-service');
const MqttController = require('../utils/mqtt-controller');
const mqttController = MqttController.getInstance();
const daoHelper = require('../dao/dao-helper');

console.log("[INFO] Initialize app-manager...");
const serviceName = process.env.SERVICE_NAME;
const messagingService = new MessagingService(serviceName);

// Create logs directory for apps if not present
fs.ensureDirSync(`${__dirname}/logs`);
fs.emptyDirSync(`${__dirname}/logs`); // clear directory

codeContainer.cleanupExecutablesDir();

// Stores the process, id, pid, appPath, and metadataPath in apps
// apps = {
//     "app-name": {
//         "app": instance-of-process,
//         "pid": application-process-pid,
//         "id": topic,
//         "appPath": application-executable-path,
//         "metadataPath": application-metadata-path
//     }
// }
const apps = {};

// load info about startup apps
daoHelper.appsDao.fetchAll().then(apps => {
   apps.forEach(app => {
       // start app
   })
});


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

/**
 * Returns the MQTT topic on which the specified app's logs are streaming to
 * @param appId The id of the app
 * @return {string}
 */
function getAppLogTopic(appId) {
    return `${appId}-log`;
}

function executeApplication(appPath, metadataPath, runtime, isStartupApp) {
    codeContainer.setupAppRuntimeEnvironment(appPath, metadataPath, runtime, isStartupApp)
        .then((newAppPath) => {
            // newAppPath = /on-the-edge/app-manager/code-container/.../1583622378159/app.js
            let appName = path.basename(newAppPath);
            // Generate application's id
            // The id is also used for application's topic
            let appId = generateAppId(appName);

            // Using fork() to create a child process for a new application
            // Using fork() not spawn() is because fork is a special instance of spawn for creating a Nodejs child process.
            // Reference:
            // https://stackoverflow.com/questions/17861362/node-js-child-process-difference-between-spawn-fork

            // use "ipc" in options.stdio to setup ipc between the parent process and the child process
            // Reference: https://nodejs.org/api/child_process.html#child_process_options_stdio

            const appLogPath = path.join(__dirname, 'logs', `${appName}.out`);

            let newApp;

            if(appData.runtime === 'nodejs') {
                newApp = fork(newAppPath, [], {
                    env: {TOPIC: appId},
                    stdio: [
                        0,
                        fs.openSync(appLogPath, 'w'),
                        fs.openSync(appLogPath, 'a'),
                        "ipc"
                    ]
                });
            } else if(appData.runtime === 'python') {
                newApp = spawn('python3', ['-u', newAppPath], {
                    env: {TOPIC: appId},
                    stdio: [
                        0,
                        fs.openSync(appLogPath, 'w'),
                        fs.openSync(appLogPath, 'a')
                    ]
                });
            }

            // Stores the process, id, pid, appPath, and metadataPath in apps
            // The id is also used for application's topic
            apps[appId] = {
                "id": appId,
                "name": appName,
                "app": newApp, // instance of process,
                "pid": newApp.pid,
                "appPath": newAppPath,
                "metadataPath": appData.metadataPath,
                "logPath": appLogPath
            };

            // if it's a startup app, then store this info in the db as well
            if(appData.isStartupApp) {
                daoHelper.appsDao.addApp(new App(appId,
                    newAppPath,
                    appData.metadataPath,
                    appData.runtime,
                    appData.isStartupApp)
                ).then(() => console.log("added startup app info to db"));
            }

            console.log(`[INFO] Launched ${newAppPath} successfully!`);
            console.log(`   time: ${new Date().toISOString()}`);
            console.log(`   path: ${newAppPath}`);
            console.log(`    id: ${appId}`);
            console.log(`    pid: ${newApp.pid}`);
            // sends application's information to sensor-stream-manager
            // for registering the topic and sensor data requirement.
            messagingService.forwardMessage(serviceName, "sensor-stream-manager", "request-streams", {
                "topic": appId,
                "metadataPath": appData.metadataPath
            });
        })
        .catch(err => console.error(err));
}

// app-manager will fork a process for executing new app.
messagingService.listenForEvent('app-deployment', message => {
    let appData = message.data;
    executeApplication(appData);
});

messagingService.listenForQuery("get-apps", message => {
    const query = message.data.query;
    // respond back with a list of apps with just the app id and name
    const appsList = [];
    Object.keys(apps).forEach(appId => {
        appsList.push({
            id: appId,
            name: apps[appId]['name']
        });
    });
    messagingService.respondToQuery(query, appsList);
});

// TODO move the functionality to app-utils.js
messagingService.listenForQuery("terminate-app", message => {
    const query = message.data.query;

    if(query.params.hasOwnProperty('id')) {
        const appId = query.params['id'];

        // if we know of this app, process termination request
        if(apps.hasOwnProperty(appId)) {
            // fetch details of the app
            const app = apps[appId];
            const appName = app['name'];
            const appInstance = app['app'];
            const appPath = app['appPath'];
            const appLogPath = app['logPath'];

            // kill the process
            appInstance.kill('SIGINT');
            console.log(`app ${appName} killed.`);

            // remove logs
            fs.remove(appLogPath);
            console.log(`log file for ${appName} removed.`);

            // remove the execution directory
            const appExecDirectory = path.dirname(appPath);
            fs.remove(appExecDirectory);
            console.log(`execution directory for ${appName} removed.`);

            // remove item from apps object
            delete apps[appId];

            messagingService.respondToQuery(query, {
                'status': true
            });

        } else {
            console.error(`App ${appId} is not a running app on this gateway. Could not complete termination request.`);
            messagingService.respondToQuery(query, {
                'status': false,
                'error': `App ${appId} is not a running app on this gateway.`
            });
        }
    }
});

messagingService.listenForQuery('get-log-streaming-topic', message => {
    const query = message.data.query;
    if(query.params.hasOwnProperty('id')) {
        const appId = query.params['id'];

        // check if the app is running
        if(apps.hasOwnProperty(appId)) {
            const appLogMqttTopic = getAppLogTopic(appId);
            messagingService.respondToQuery(query, {
                'status': true,
                'appLogTopic': appLogMqttTopic
            });
        } else {
            // send an error
            messagingService.respondToQuery(query, {
                'status': false,
                'error': `App ${appId} is not a running app on this gateway.`
            });
        }
    }
});

// TODO move the functionality to app-utils.js
messagingService.listenForQuery('start-log-streaming', message => {
    const query = message.data.query;
    if(query.params.hasOwnProperty('id')) {
        const appId = query.params['id'];

        // check if the app is running
        if(apps.hasOwnProperty(appId)) {
            // fetch the app's log file path
            const app = apps[appId];
            const appLogPath = app['logPath'];

            // if we were already tailing this app, then return
            if(apps[appId].hasOwnProperty('logTail')) {
                messagingService.respondToQuery(query, {
                    'status': true
                });
            } else {
                if(fs.existsSync(appLogPath)) {
                    const appLogMqttTopic = getAppLogTopic(appId);
                    const tail = new Tail(appLogPath, {
                        fromBeginning: true
                    });

                    tail.on("line", function(data) {
                        // publish to mqtt topic
                        mqttController.publish('localhost', appLogMqttTopic, data);
                    });

                    tail.on("error", function(error) {
                        console.error(`error while tailing the log file for ${appId}, ERROR: ${error}`);
                        tail.unwatch();
                    });

                    // add the tail object to the apps object
                    apps[appId]['logTail'] = tail;

                    messagingService.respondToQuery(query, {
                        'status': true
                    });
                }
            }
        } else {
            // send an error
            messagingService.respondToQuery(query, {
                'status': false,
                'error': `App ${appId} is not a running app on this gateway.`
            });
        }
    }
});

// TODO move the functionality to app-utils.js
messagingService.listenForQuery('stop-log-streaming', message => {
    const query = message.data.query;

    if(query.params.hasOwnProperty('id')) {
        const appId = query.params['id'];

        // check if we know this app
        if(apps.hasOwnProperty(appId)) {
            // check if we were tailing this app's log
            if(apps[appId].hasOwnProperty('logTail')) {
                const tail = apps[appId]['logTail'];
                // stop tailing
                tail.unwatch();
                delete apps[appId]['logTail'];

                // stop streaming the app's log on mqtt
                const appLogTopic = getAppLogTopic(appId);
                mqttController.unsubscribe('localhost', appLogTopic);

                messagingService.respondToQuery(query, {
                    'status': true
                });
            } else {
                console.error(`App ${appId} was not streaming its logs. Did not attempt to stop streaming.`);
                messagingService.respondToQuery(query, {
                    'status': false,
                    'error': `App ${appId} was not streaming its logs.`
                });
            }
        } else {
            console.error(`App ${appId} is not a running app on this gateway. Did not attempt to stop app log streaming.`);
            messagingService.respondToQuery(query, {
                'status': false,
                'error': `App ${appId} is not a running app on this gateway.`
            });
        }
    }
});

messagingService.listenForEvent('send-to-device', message => {
    messagingService.forwardMessage(serviceName, 'device-manager', 'send-to-device', message.data);
});
