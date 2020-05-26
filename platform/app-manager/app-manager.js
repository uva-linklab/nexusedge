const codeContainer = require(`${__dirname}/code-container/container`);
const fs = require("fs-extra");
const path = require("path");
const { fork } = require('child_process');
const crypto = require('crypto');
const mongoClient = require('mongodb').MongoClient;
const MessagingService = require('../messaging-service');

console.log("[INFO] Initialize app-manager...");
const serviceName = process.env.SERVICE_NAME;
const messagingService = new MessagingService(serviceName);

// db settings
const mongoUrl = 'mongodb://localhost:27017';
const appsDb = 'apps';
const appsInfoCollection = 'info';

// Initialize database connection once
let db;
mongoClient.connect(mongoUrl, { useNewUrlParser: true }, function(err, client) {
    if(err) {
        console.error("[ERROR] Failed to connect to mongodb.");
        throw err;
    }
    db = client.db(appsDb);
});

// TODO: When initializing app-manager, app-manager checks database to see
//  if any apps already existed (zombie process). This happens when app-manager crashed abnormally

// Create logs directory for apps if not present
fs.ensureDirSync(`${__dirname}/logs`);
/**
 * This function saves the app info to the database
 * @param {string} appId application's id
 * @param {string} appPath application executable path
 * @param {string} metadataPath metadata path
 * @param {string} pid application's pid
 */
function saveAppInfoToDB(appId, appPath, metadataPath, pid) {
    let result = db.collection(appsInfoCollection)
                    .insertOne({
                        "_id": appId,
                        "name": path.basename(appPath),
                        "pid": pid,
                        "appPath": appPath,
                        "metadataPath": metadataPath
                    });
    if("writeConcernError" in result) {
        throw result["writeConcernError"];
    }
}

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
                const newApp = fork(newAppPath, [], {
                    env: { TOPIC: appId },
                    stdio: [
                        0,
                        fs.openSync(`${__dirname}/logs/${appName}.out`, 'a'),
                        fs.openSync(`${__dirname}/logs/${appName}.out`, 'a'),
                        "ipc"
                    ]
                });
                // Save application's _id, application path, metadata path and pid in mongodb
                saveAppInfoToDB(appId, newAppPath, appData.metadataPath, newApp.pid);

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