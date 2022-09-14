const deploymentUtils = require("./deployment-utils");
const scheduler = require("./scheduler");
const watcher = require("./watcher");
const fs = require("fs-extra");
const path = require("path");
const Tail = require('tail').Tail;
const MessagingService = require('../messaging-service');
const MqttController = require('../utils/mqtt-controller');
const mqttController = MqttController.getInstance();
const appsDao = require('../dao/dao-helper').appsDao;
const utils = require('../utils/utils');

console.log("[INFO] Initialize app-manager...");
const serviceName = process.env.SERVICE_NAME;
const messagingService = new MessagingService(serviceName);

const apps = {}; // list of running apps indexed by id

// Create logs directory for apps if not present
fs.ensureDirSync(`${__dirname}/logs`);

setTimeout(() => {
    restartAllApps(); // restarting involves requesting ssm to setup streams. so we wait a little bit for the messaging
    // service to initialize.
}, 2000);

/**
 * Resumes all apps that were executing on this gateway
 */
function restartAllApps() {
    // restart applications if you're the only gateway present. otherwise trust that resiliency is handled by the watcher gateway.
    utils.getLinkGraph().then(linkGraph => {
        // if you're the only gateway available
        if(Object.keys(linkGraph["data"]).length === 1) {
            console.log("you're the last gateway standing. restart all apps.");
            appsDao.fetchAll().then(apps => {
                apps.forEach(app => {
                    const logPath = getLogPath(app.name);

                    // restart the app
                    const appProcess = deploymentUtils.executeApplication(app.id,
                        app.executablePath,
                        logPath,
                        app.runtime);

                    // record app info in memory
                    storeAppInfo(app, appProcess, logPath);

                    // request sensor-stream-manager to provide streams for this app
                    messagingService.forwardMessage(serviceName, "sensor-stream-manager", "request-streams", {
                        "topic": app.id,
                        "metadataPath": app.metadataPath
                    });
                })
            });
        } else {
            console.log("you're not the last gateway standing. trust the process. remove all apps.");
            // clear the apps dao
            appsDao.fetchAll().then(apps => {
                apps.forEach(app => {
                    appsDao.removeApp(app.id)
                        .then(() => console.log(`app ${app.name} (${app.id}) removed from db`))
                        .catch(() => console.log(`error removing app ${app.id} from db`));
                });
            });
        }
    });
}

/**
 * Returns the MQTT topic on which the specified app's logs are streaming to
 * @param appId The id of the app
 * @return {string}
 */
function getAppLogTopic(appId) {
    return `${appId}-log`;
}

/**
 * Store the application info in memory
 * @param app
 * @param process
 * @param logPath
 */
function storeAppInfo(app, process, logPath) {
    apps[app.id] = {
        "id": app.id,
        "name": app.name,
        "process": process, // instance of process
        "appPath": app.executablePath,
        "metadataPath": app.metadataPath,
        "logPath": logPath
    };
}

function getLogPath(appName) {
    return path.join(__dirname, 'logs', `${appName}.out`);
}

/**
 * This function deploys a given application.
 1. generate a new app id from app name
 2. copy the app and metadata to a new permanent directory
 3. copy oracle library into this new directory (this should be a sin!)
 4. start the process for the app
 5. store the app's info in the memory obj and in db
 6. request SSM to setup streams for this app based on its requirements
 * @param appId
 * @param linkGraph optional linkgraph to speedup compute
 * @param tempAppPath
 * @param tempMetadataPath
 */
async function executeApplication(appId, linkGraph, tempAppPath, tempMetadataPath) {
    let metadata;
    try {
        metadata = await fs.readJson(tempMetadataPath);
    } catch (err) {
        throw new Error(`while executing app ${appId}, error reading json file at metadataPath ${tempMetadataPath}. Error = ${err.toString()}`);
    }

    const appName = path.basename(tempAppPath);

    // shift this app from the current temporary directory to a permanent directory
    const appDirectoryPath = deploymentUtils.storeApp(tempAppPath, tempMetadataPath);

    // copy the oracle library to use for the app.
    // TODO: ideally this should be reused by all apps!
    deploymentUtils.copyOracleLibrary(appDirectoryPath, metadata.runtime);

    const appExecutablePath = path.join(appDirectoryPath, appName);
    const metadataPath = path.join(appDirectoryPath, path.basename(tempMetadataPath));
    const logPath = getLogPath(appName);
    const app = new appsDao.App(appId, appName, appExecutablePath, metadataPath, metadata.runtime);

    // execute the app!
    const appProcess = deploymentUtils.executeApplication(appId, appExecutablePath, logPath, metadata.runtime);

    // record app info in memory and/or db
    storeAppInfo(app, appProcess, logPath);
    appsDao.addApp(app).then(() => console.log("added app info to db"));

    // request sensor-stream-manager to provide streams for this app
    messagingService.forwardMessage(serviceName, "sensor-stream-manager", "request-streams", {
        "topic": appId,
        "linkGraph": linkGraph,
        "metadataPath": metadataPath
    });
}

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

messagingService.listenForQuery("terminate-app", message => {
    const query = message.data.query;

    if(query.params.hasOwnProperty('id')) {
        const appId = query.params['id'];

        // if we know of this app, process termination request
        if(apps.hasOwnProperty(appId)) {
            // fetch details of the app
            const app = apps[appId];
            const appName = app['name'];
            const appProcess = app['process'];
            const appPath = app['appPath'];
            const appLogPath = app['logPath'];

            // kill the process
            appProcess.kill('SIGINT');
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

            // remove the app's entry from db as well
            appsDao.removeApp(appId)
                .then(() => console.log(`app ${appName} (${appId}) removed from db`))
                .catch(() => console.log(`error removing app from db`));

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

// listen to schedule an application
messagingService.listenForQuery('schedule-app', message => {
    const query = message.data.query;
    const params = message.data.query.params;

    console.log(`received request to schedule app. appPath = ${params.appPath}`);

    scheduler.schedule(params.packagePath, params.deployMetadataPath)
        .then( scheduleInfo => {
            messagingService.respondToQuery(query, {
                'status': true,
                'scheduleInfo': scheduleInfo
            });
        })
        .catch(error => {
            messagingService.respondToQuery(query, {
                'status': false,
                'error': error
            });
        });
});

// listen to queries to execute applications on gateway
messagingService.listenForQuery('execute-app', message => {
    const query = message.data.query;
    const params = message.data.query.params;

    console.log(`received request to execute app. appPath = ${params.appPath}`);
    executeApplication(params.appId, params.linkGraph, params.packagePath, params.deployMetadataPath)
        .then(() => {
            messagingService.respondToQuery(query, {
                'status': true
            });
        })
        .catch(error => {
            messagingService.respondToQuery(query, {
                'status': false,
                'error': error
            });
        });
});

// "watch" an application: periodically check if the gateway that executes an application fails. if so, restart app
messagingService.listenForQuery('watch-app', message => {
    const query = message.data.query;
    const params = message.data.query.params;

    console.log(`received request to watch app. appPath = ${params.appPath}`);
    watcher.watch(params.appId, params.executorGatewayId, params.packagePath, params.deployMetadataPath)
        .then(() => {
            messagingService.respondToQuery(query, {
                'status': true
            });
        })
        .catch(error => {
            messagingService.respondToQuery(query, {
                'status': false,
                'error': error
            });
        });
});
