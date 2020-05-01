const codeContainer = require(`${__dirname}/code-container/container`);
const path = require("path");
const { fork } = require('child_process');
const mongoClient = require('mongodb').MongoClient;
const ipc = require('node-ipc');

const role = process.env.role;

let ipcToPlatform = new ipc.IPC;
// ipc settings
// reference: http://riaevangelist.github.io/node-ipc/#ipc-config
ipcToPlatform.config.appspace = "gateway.";
ipcToPlatform.config.socketRoot = path.normalize(`${__dirname}/../socket/`);
ipcToPlatform.config.id = role;
ipcToPlatform.config.retry = 1500;
ipcToPlatform.config.silent = true;

// connect to platform manager
ipcToPlatform.connectTo('platform', () => {
  ipcToPlatform.of.platform.on('connect', () => {
    console.log(`${role} connected to platform`);
    let message = {
      sender: role,
      _meta: {
        data: `${role} send back the socket`
      }
    }
    ipcToPlatform.of.platform.emit("register-socket", message);
  });
  ipcToPlatform.of.platform.on('disconnect', () => {
    console.log(`${role} disconnected from platform`);
  });
});

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
  };
  return appId;
}

// APPS stores app name, topic, and pid
let apps = {};

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

// when app-manager get appPath and metadataPath from platform-manager,
// app-manager will fork a process for executing new app
ipcToPlatform.of.platform.on('app-deployment', message => {
  let appData = message.data;
  if(appData.appPath && appData.metadataPath) {
    codeContainer.setApp(appData.appPath, appData.metadataPath)
      .then((newAppPath) => {
        // appPath = /on-the-edge/app-manager/code-container/executables/1583622378159/app.js
        let appName = path.basename(newAppPath);
        // app's MQTT topic
        let appTopic = getTopic(appName);

        // fork a process for a new app
        // Use spaw or fork?
        // https://stackoverflow.com/questions/17861362/node-js-child-process-difference-between-spawn-fork
        const newApp = fork(newAppPath, [], {
          env: { "topic": appTopic },
          stdio: [0, fs.openSync(`${__dirname}/logs/${appName}.out`, 'w'), fs.openSync(`${__dirname}/logs/${appName}.err`, 'w'), "ipc"]
        });
        let appId = saveAppInfoToDB(newAppPath, appTopic, newApp.pid);

        // store the topic, pid, and appPath in apps
        apps[appName] = {
          app: newApp,
          id: appId,
          topic: appTopic,
          path: appPath
        };

      })
      .catch(err => console.error(err));
    }
});