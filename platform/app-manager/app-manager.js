const codeContainer = require(`${__dirname}/code-container/container`);
const fs = require("fs-extra");
const path = require("path");
const { fork } = require('child_process');
const mongoClient = require('mongodb').MongoClient;
const MessagingService = require('../messaging-service');
const messagingService = new MessagingService(process.env.SERVICE_NAME);

// db settings
const mongoUrl = 'mongodb://localhost:27017';
const appsDb = 'apps';
const appsInfoCollection = 'info';

// Initialize database connection once
var db;
mongoClient.connect(mongoUrl, { useNewUrlParser: true }, function(err, client) {
    if(err) throw err;
    db = client.db(appsDb);
});

// Create logs directory if not present
fs.ensureDirSync(`${__dirname}/logs`);
/**
 * This function saves the app info to the database
 * @param {string} appPath application path
 * @param {string} topic mqtt topic
 * @param {string} pid application pid
 * @returns {string}
 */
function saveAppInfoToDB(appPath, topic, pid) {
    let appId;
    try {
        let result = db.collection(appsInfoCollection).insertOne( { "appName": appPath, "topic": topic, "pid": pid });
        appId = result["insertedId"];
    } catch (err) {
        console.error(err);
    }
    return appId;
}

// apps stores process, topic, pid, and path
const apps = {};

/**
 * This function generates the topic for new coming app.
 * TODO: use app name or other?
 * @param {string} appName
 * @returns {string}
 */
function getTopic(appName) {
    let topic = appName;
    return topic;
}

// When app-manager get appPath and metadataPath from platform-manager,
// app-manager will fork a process for executing new app.
messagingService.listenForEvent('app-deployment', message => {
    let appData = message.data;
    if(appData.appPath && appData.metadataPath) {
        codeContainer.setApp(appData.appPath, appData.metadataPath)
            .then((newAppPath) => {
                // appPath = /on-the-edge/app-manager/code-container/executables/1583622378159/app.js
                let appName = path.basename(newAppPath);
                // app's MQTT topic
                let appTopic = getTopic(appName);

                // Using fork() to create a child process for a new application
                // Using fork() not spawn() is because fork is a special instance of spawn for creating a Nodejs child process.
                // Reference:
                // https://stackoverflow.com/questions/17861362/node-js-child-process-difference-between-spawn-fork
                const newApp = fork(newAppPath, [], {
                    env: { TOPIC: appTopic },
                    stdio: [0, fs.openSync(`${__dirname}/logs/${appName}.out`, 'w'), fs.openSync(`${__dirname}/logs/${appName}.err`, 'w'), "ipc"]
                });
                let appId = saveAppInfoToDB(newAppPath, appTopic, newApp.pid);

                // Stores the process, topic, pid, and path in apps
                apps[appName] = {
                    "app": newApp,
                    "id": appId,
                    "topic": appTopic,
                    "path": newAppPath
                };

            })
            .catch(err => console.error(err));
        }
});