const deploymentUtils = require("./deployment-utils");
const fs = require("fs-extra");
const fsPromises = require("fs").promises;
const path = require("path");
const child_process = require('child_process');
const crypto = require('crypto');
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

// Create a persistent temporary directory for executing applications in.
const APP_DEPLOY_PATH = '/var/tmp/nexus-edge/apps';
fs.ensureDirSync(APP_DEPLOY_PATH);

setTimeout(() => {
    restartAllApps(); // restarting involves requesting ssm to setup streams. so we wait a little bit for the messaging
    // service to initialize.
}, 2000);

/**
 * Resumes all apps that were executing on this gateway
 */
function restartAllApps() {
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
}



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
 * @param tempAppPath
 * @param tempMetadataPath
 * @param runtime
 */
function deployApplication(packagePath, tempMetadataPath, runtime) {
    const appName = path.basename(tempAppPath);
    // generate an id for this app
    const appId = generateAppId(appName);

    // shift this app from the current temporary directory to a permanent directory
    const appDirectoryPath = deploymentUtils.storeApp(tempAppPath, tempMetadataPath);

    // copy the oracle library to use for the app.
    // TODO: ideally this should be reused by all apps!
    deploymentUtils.copyOracleLibrary(appDirectoryPath, runtime);

    const appExecutablePath = path.join(appDirectoryPath, appName);
    const metadataPath = path.join(appDirectoryPath, path.basename(tempMetadataPath));
    const logPath = getLogPath(appName);
    const app = new appsDao.App(appId, appName, appExecutablePath, metadataPath, runtime);

    // execute the app!
    const appProcess = deploymentUtils.executeApplication(appId, appExecutablePath, logPath, runtime);

    // record app info in memory and/or db
    storeAppInfo(app, appProcess, logPath);
    appsDao.addApp(app).then(() => console.log("added app info to db"));

    // request sensor-stream-manager to provide streams for this app
    messagingService.forwardMessage(serviceName, "sensor-stream-manager", "request-streams", {
        "topic": appId,
        "metadataPath": metadataPath
    });
}

/** Deploy an application package.
 *
 * @param appPackagePath Path to the application package tar.
 * @param deployMetadataPath Path to the deployment-time metadata.
 */
function deployApplicationV2(appPackagePath, deployMetadataPath) {
    const appName = path.basename(appPackagePath);
    // Generate an ID for this app.
    const appId = generateAppId(appName);

    // Unpackage the application in its own directory in the deployment directory.
    const runPath = `${APP_DEPLOY_PATH}/${appId}`;
    fs.ensureDirSync(runPath);

    console.log(`Extracting ${appName} to '${runPath}'...`);
    child_process.execFileSync(
        utils.tarPath,
        ['-x', '-f', appPackagePath],
        { cwd: runPath });
    // Move deployment metadata to run path as well.
    const residentDeployMetadataPath = `${APP_DEPLOY_PATH}/${appId}/_deploy.json`;
    fs.renameSync(deployMetadataPath, residentDeployMetadataPath);

    // Fetch the runtime type from the application metadata.
    const appMetadataPath = path.join(runPath, '_metadata.json');
    const appMetadata = JSON.parse(fs.readFileSync(appMetadataPath));
    const runtime = appMetadata['app-type'];
    if (runtime === undefined) {
        throw new Error('Application metadata does not specify a runtime.');
    }

    // Prepare the application code for execution depending on its type.
    var executablePath = null;
    if (runtime === 'nodejs') {
        executablePath = path.join(runPath, 'app.js');

        // copy the oracle library to use for the app.
        deploymentUtils.copyOracleLibrary(runPath, runtime);
    } else if (runtime === 'python') {
        // Unzip the wheel.
        var dir = fs.opendirSync(runPath);
        var entry = dir.readSync();
        while (entry != null) {
            if (path.extname(entry.name) === '.whl') {
                child_process.execFileSync(
                    '/usr/bin/unzip',
                    [path.join(entry.name)],
                    { cwd: runPath });
                break;
            }

            entry = dir.readSync();
        }
        dir.closeSync();

        // Didn't find the wheel file.
        if (entry == null) {
            throw new Error ('Could not locate .whl file for Python application.');
        }

        executablePath = findPythonMain(runPath);

        if (executablePath == null) {
            throw new Error('Could not find __main__.py file.');
        }

        // copy the oracle library to use for the app.
        deploymentUtils.copyOracleLibrary(executablePath, runtime);
    } else {
        throw new Error(`Unsupported runtime: ${runtime}.`);
    }

    const logPath = path.join(__dirname, 'logs', `${appName}-${appId}.log`);
    const app = new appsDao.App(appId, appName, executablePath, residentDeployMetadataPath, runtime);

    // execute the app!
    const appProcess = deploymentUtils.executeApplication(appId, executablePath, logPath, runtime);

    // record app info in memory and/or db
    storeAppInfo(app, appProcess, logPath);
    appsDao.addApp(app).then(() => console.log("added app info to db"));

    // request sensor-stream-manager to provide streams for this app
    messagingService.forwardMessage(serviceName, "sensor-stream-manager", "request-streams", {
        "topic": appId,
        "metadataPath": residentDeployMetadataPath
    });
}

/** Locate the __main__.py file.
 *
 * @returns the path to the __main__.py file or null if it does not exist.
 */
function findPythonMain(appRoot) {
    var dir = fs.opendirSync(appRoot);
    var entry = dir.readSync();

    while (entry != null) {
        if (entry.isDirectory()) {
            const maybeAppDir = fs.opendirSync(path.join(appRoot, entry.name));
            var maybeAppDirEntry = maybeAppDir.readSync();
            while (maybeAppDirEntry != null) {
                if (maybeAppDirEntry.name == '__main__.py') {
                    dir.closeSync();
                    maybeAppDir.closeSync();
                    console.log(`main is in ${maybeAppDir.path}`);
                    return maybeAppDir.path;
                } else {
                    maybeAppDirEntry = maybeAppDir.readSync();
                }
            }

        }

        entry = dir.readSync();
    }

    dir.closeSync();
    maybeAppDir.closeSync();

    return null;
}

// listen to events to deploy applications
messagingService.listenForEvent('deploy-app', message => {
    const appData = message.data;
    deployApplication(appData.appPath, appData.metadataPath, appData.runtime);
});

messagingService.listenForEvent('execute-app-v2', message => {
    const appData = message.data;
    deployApplicationV2(appData.packagePath, appData.deployMetadataPath);
});

messagingService.listenForQuery('execute-app', query => {
    const packagePath = query.params.packagePath;
    const deployMetadataPath = query.params.deployMetadataPath;

    // Unpackage the app metadata.
    const extractDir = '/tmp';
    try {
        child_process.execFileSync(
            utils.tarPath,
            ['-x', '-f', packagePath, '_metadata.json'],
            { cwd: extractDir, timeout: 1000 });
    } catch (e) {
        console.log(`Failed to unpackage app metadata: ${e}.`);
        messagingService.respondToQuery(query, {
            status: false,
            message: ''
        });

        return;
    }

    const runMetadata = JSON.parse(await fs.promises.readFile(path.join(extractDir, '_metadata.json')));
    const deployMetadata = JSON.parse(await fs.promises.readFile(deployMetadataPath));

    // Obtain gateway resource information to make a scheduling decision.
    const graph = await utils.getLinkGraph();
    const gatewayResources = await Promise.all(Object.keys(graph.data).map((gatewayId) => {
        const gatewayInfo = graph.data[gatewayId];
        const ip = gatewayInfo.ip;

        // Get a count of devices by type for each gateway.
        // This is used for deployment metadata that specifies a particular kind of device.
        var deviceTypes = new Map();
        gatewayInfo.devices.forEach((device) => {
            if (deviceTypes.has(device.type)) {
                deviceTypes[device.type] += 1;
            } else {
                deviceTypes.set(device.type, 1);
            }
        });

        const opts = {
            method: 'GET',
            uri: `http://${ip}:5000/gateway/resources`,
            json: true
        };

        return request(opts)
            .then((resources) => {
                const deviceInfo = {
                    id: gatewayId,
                    ip: ip,
                    resources: resources,
                    deviceIds: gatewayInfo.devices.map(device => device.id),
                    deviceTypes: deviceTypes
                };

                return deviceInfo;
            });
    }));

    // Run the scheduling algorithm to determine where to put the application.
    const gateway = schedule(deployMetadata, runMetadata, gatewayResources);
    if (gateway !== null) {
        console.log(`Sending application to run on ${gateway.ip}.`);

        const gatewayUri = `http://${gateway.ip}:5000/gateway/execute-app-v2`;
        const formData = {
            'appPackage': fsExtra.createReadStream(packagePath),
            'deployMetadata': fsExtra.createReadStream(deployMetadataPath)
        };
        const opts = {
            method: 'POST',
            uri: gatewayUri,
            formData: formData
        };

        request(opts)
            .then(
                () => {
                    messagingService.respondToQuery(query, {
                        status: true
                    });
                },

                () => {
                    messagingService.respondToQuery(query, {
                        status: false
                    });
                });
    } else {
        // No gateways available for the application.
        messagingService.respondToQuery(query, {
            status: false,
            message: 'No gateways available to run application.'
        });
    }
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
