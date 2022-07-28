const deploymentUtils = require("./deployment-utils");
const fs = require("fs-extra");
const fsPromises = require("fs").promises;
const path = require("path");
const child_process = require('child_process');
const request = require('request-promise');
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

// listen to events to deploy applications
messagingService.listenForEvent('deploy-app', message => {
    const appData = message.data;
    deployApplication(appData.appPath, appData.metadataPath, appData.runtime);
});


// Start running an application from an application package.
messagingService.listenForQuery('execute-app', message => {
    const query = message.data.query;
    const appPackagePath = query.params.packagePath;
    const deployMetadataPath = query.params.deployMetadataPath;

    const appName = path.basename(appPackagePath);
    const appId = generateAppId(appName);

    console.log(`Received request to start ${appName}.`);

    const result = deploymentUtils.deployApplication(
        appPackagePath, deployMetadataPath, appName, appId);

    console.log(`Executable is at ${result.executablePath}.`);

    if (result.status === true) {
        const logPath = path.join(__dirname, 'logs', `${result.appName}-${result.appId}.log`);
        const app = new appsDao.App(
            appId,
            appName,
            result.executablePath,
            result.deployMetadataPath,
            result.runtime);

        // execute the app!
        const appProcess = deploymentUtils.executeApplication(
            appId, result.executablePath, logPath, result.runtime);

        // record app info in memory and/or db
        storeAppInfo(app, appProcess, logPath);
        appsDao.addApp(app).then(() => console.log("added app info to db"));

        // request sensor-stream-manager to provide streams for this app
        messagingService.forwardMessage(serviceName, "sensor-stream-manager", "request-streams", {
            "topic": appId,
            "metadataPath": result.deployMetadataPath
        });

        messagingService.respondToQuery(query, {
            status: true,
            message: ''
        });
    }

    messagingService.respondToQuery(query, {
        status: result.status,
        message: result.message
    });
});

messagingService.listenForQuery('schedule-app', async (message) => {
    const query = message.data.query;
    const packagePath = query.params.packagePath;
    const deployMetadataPath = query.params.deployMetadataPath;

    // Unpackage the app metadata.
    const extractDir = '/tmp';
    const tarMetadataPaths = ['_metadata.json', './_metadata.json'];
    for (var i = 0; i < tarMetadataPaths.length; i++) {
        try {
            child_process.execFileSync(
                utils.tarPath,
                ['-x', '-f', packagePath, tarMetadataPaths[i]],
                { cwd: extractDir, timeout: 2000 });
        } catch (_e) {
            // Defer returning an error until trying all paths.
        }
    }
    // Make sure we have a metadata file.
    if (!fs.existsSync(path.join(extractDir, '_metadata.json'))) {
        console.log(`Failed to unpackage app metadata: ${e}.`);
        messagingService.respondToQuery(query, {
            status: false,
            message: ''
        });

        return;
    } else {
        console.log('Successfully extracted metadata file.');
    }

    console.log('Parsing runtime and deployment metadata.');
    const runMetadata = JSON.parse(await fs.promises.readFile(path.join(extractDir, '_metadata.json')));
    const deployMetadata = JSON.parse(await fs.promises.readFile(deployMetadataPath));

    // Obtain gateway resource information to make a scheduling decision.
    console.log('Getting link graph for scheduling.');
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

        const gatewayUri = `http://${gateway.ip}:5000/gateway/execute-app`;
        const formData = {
            'appPackage': fs.createReadStream(packagePath),
            'deployMetadata': fs.createReadStream(deployMetadataPath)
        };
        const opts = {
            method: 'POST',
            uri: gatewayUri,
            formData: formData
        };

        request(opts)
            .then(
                () => {
                    console.log(`This gateway finished scheduling; it is all up to ${gateway.ip} now.`);
                    messagingService.respondToQuery(query, {
                        status: true,
                        message: ''
                    });
                },

                (e) => {
                    messagingService.respondToQuery(query, {
                        status: false,
                        message: `Execution failed: ${e}`
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

const SchedulableCPUThreshold = 80;
const SchedulableMemoryThreshold = 200;

/** Decide which gateway should run an application.
 *
 * Makes a decision to schedule an application on a gateway provided in `gateways`.
 * If no gateway is suitable for the application, this function returns null.
 *
 * @param deployMetadata Deploy-time application information.
 * @param runMetadata Build-time application information.
 * @param gateways Nexus Edge gateways to select a gateway from.
 */
function schedule(deployMetadata, runMetadata, gateways) {
    // (1) Remove gateways based on specs, requirements, and connected devices.
    // Remove overloaded gateways.
    // Inspect CPU and memory load and removes gateways that are above the threshold.
    var candidates = gateways.filter((gw) => {
        return gw.resources.cpuFreePercent < SchedulableCPUThreshold
            && gw.resources.memoryFreeMB > SchedulableMemoryThreshold
    });
    console.log(`Overload check prunes to ${candidates.length} GWs.`);

    // Include only gateways that fulfill all essential capabilities.
    candidates = candidates.filter((gw) => {
        for (var i = 0; i < runMetadata.requires.length; i++) {
            const r = runMetadata.requires[i];
            if (evaluateCapability(gw, r) != true) {
                return false;
            }
        }

        return true;
    });
    console.log(`Required cap. check prunes to ${candidates.length} GWs.`);

    // Make sure we still have gateways to work with after this filtering.
    if (candidates.length == 0) {
        console.log(`No more gateways; app cannot run.`);
        return null;
    }

    // (2) Prioritize gateways with preferred capabilities.
    // Tier gateways by the number of optional requirements they fulfill
    // and take the gateways fulfilling the most preferences.
    // This does mean that each preferential capability is weighted evenly.
    //
    // Also the decision made here may run counter to the optimization step.
    // Example: single gateway with 10 preferential capabilities filled but is loaded
    // vs. five gateways with 9 preferential capabilities filled but less loaded.
    var mostFulfilled = 0;
    candidates = candidates.map((gw) => {
        var noFulfilled = 0;
        runMetadata.prefers.forEach((p) => {
            if (evaluateCapability(gw, p)) {
                noFulfilled += 1;
            }
        });

        gw.preferencesFulfilled = noFulfilled;
        // Cache the most fulfilled for selecting the most preferential.
        if (noFulfilled > mostFulfilled) {
            mostFulfilled = noFulfilled;
        }

        return gw;
    });
    candidates = candidates.filter((gw) => gw.preferencesFulfilled == mostFulfilled);
    console.log(`Prioritization step prunes to ${candidates.length} GWs.`);

    // (3) Aim to balance loads and for a tight requirements fit.
    const requestedDeviceIds = new Set(runMetadata.devices.ids);
    const optimizationSortFns = [
        (gwa, gwb) => gwb.resources.memoryFreeMB - gwa.resources.memoryFreeMB,
        (gwa, gwb) => {
            const reduceGpuMem = (acc, gpu) => acc + gpu.memoryFreeMB;
            const a = gwa.resources.gpus.reduce(reduceGpuMem, 0);
            const b = gwb.resources.gpus.reduce(reduceGpuMem, 0);
            return b - a;
        },
        (gwa, gwb) => gwa.resources.storageFreeMB > gwb.resources.storageFreeMB,
        (gwa, gwb) => {
            const reduceGpuUtil = (acc, gpu) => acc + gpu.utilization;
            const a = gwa.resources.gpus.reduce(reduceGpuUtil, 0);
            const b = gwa.resources.gpus.reduce(reduceGpuUtil, 0);
            return b - a;
        },
        (gwa, gwb) => gwb.resources.cpuFreePercent - gwa.resources.cpuFreePercent,
        // Prefer gateways with more of a type of connected devices requested of the application.
        (gwa, gwb) => {
            // Accumulate the counts of all the device types that the application will make use of.
            const sumDeviceTypes = function (gw) {
                return Object.keys(gw.deviceTypes)
                    .filter((deviceType) => {
                        return deviceType in deployMetadata.devices.types
                            || deviceType in runMetadata.devices;
                    })
                    .reduce((count, deviceType) => count + gw.deviceTypes[deviceType], 0);
            };

            const gwaSum = sumDeviceTypes(gwa);
            const gwbSum = sumDeviceTypes(gwb);

            return gwbSum - gwaSum;
        },
        // Prefer gateways with the most specifically requested devices connected.
        (gwa, gwb) => {
            const sumRequestedDevices = function (gw) {
                    return gw.deviceIds.reduce(
                        (acc, id) => {
                            if (requestedDeviceIds.has(id)) {
                                return acc + 1;
                            } else {
                                return acc;
                            }
                        }, 0);
            };

            const gwaCount = sumRequestedDevices(gwa);
            const gwbCount = sumRequestedDevices(gwb);

            return gwbCount - gwaCount;
        },
        // Look for a tighter fit on gateway requirements by prioritizing gateways with the least no. of capabilities.
        (gwa, gwb) => capabilityCount(gwa.resources) < capabilityCount(gwb.resources)
    ];
    optimizationSortFns.forEach((sortFn) => { candidates.sort(sortFn); });

    if (candidates.length > 0) {
        console.log('Top three:');
        for (var i = 0; i < 3; i++) {
            if (candidates.length > i) {
                console.log(`#${i+1}: ${candidates[i].ip}`);
            } else {
                break;
            }
        }

        return candidates[0];
    } else {
        return null;
    }
}

const SchedulableGPUThreshold = 80;
const SchedulableVRAMThreshold = 200;

function evaluateCapability(gw, tag) {
    if (r == 'gpu') {
        // At least one GPU must have sufficient memory and idle compute.
        return gw.gpus.some(gpu => gpu.memoryFreeMB > SchedulableGPUThreshold
                            && gpu.utilization < SchedulableVRAMThreshold);
    } else if (r == 'secure-enclave') {
        // Just a flag check.
        return gw.secureEnclave;
    } else {
        // Unknown requirement.
        console.log(`Unknown requirement specified: '${r}'`);
        return null;
    }
}

function capabilityCount(resources) {
    var count = 0;

    if (resources.gpus.length > 0) { count += 1; }
    if (resources.secureEnclave) { count += 1; }
    if (resources.storageFreeMB > 1024) { count += 1; }

}
