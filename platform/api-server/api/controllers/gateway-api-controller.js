const discoveryModel = require('../models/discovery-model');
const path = require("path");

// TODO: ipc should be available for all function in api-server rather than specific controller.
const ipc = require('node-ipc');

const serviceName = process.env.SERVICE_NAME;
ipc.config.appspace = "gateway."
ipc.config.socketRoot = path.normalize(`${__dirname}/../../../socket/`);
ipc.config.id = serviceName;
ipc.config.retry = 1500;
ipc.config.silent = true;

ipc.connectTo('platform', () => {
  ipc.of.platform.on('connect', () => {
    console.log(`gateway-api-controller connected to platform`);
    let message = {
      "meta": {
        "sender": serviceName
      },
      "payload": `${serviceName} send back the socket`
    };
    ipc.of.platform.emit("register-socket", message);
  });
  ipc.of.platform.on('disconnect', () => {
    console.log(`${serviceName} disconnected from platform`);
  });
});

/**
 * Return the neighbors discovered in the last 5 mins.
 * @param req
 * @param res
 * @returns {Promise<*>}
 */
exports.getNeighbors = async function(req, res) {
  const neighborData = await discoveryModel.getNeighborData(300000);
  return res.json(neighborData);
};

/**
 * Returns the sensors connected in the last 5 mins.
 * @param req
 * @param res
 * @returns {Promise<*>}
 */
exports.getSensors = async function(req, res) {

  const sensorData = await discoveryModel.getSensorData(300000);
  return res.json(sensorData);
};

/**
 * This call gives the status of the server. It is primarily intended to be used as a means to check reachability.
 * @param req
 * @param res
 * @returns {Promise<*>}
 */
exports.getServerStatus = async function(req, res) {
  //for the time being use a simple json with a status=true key-value
  const status = {status: true};
  return res.json(status);
};

/**
 * This endpoint takes the uploaded code and metadata and executes it using the code-container module
 * @param req
 * @param res
 * @returns {Promise<void>}
 */
exports.executeApp = async function(req, res) {
  const appPath = req["files"]["app"][0]["path"];
  const metadataPath = req["files"]["metadata"][0]["path"];

  // Forward the application path and metadata.
  // The data format is described in the platfor-manager.js
  ipc.of.platform.emit("forward", {
    "meta": {
      "sender": serviceName,
      "recipient": "app-manager",
      "event": "app-deployment"
    },
    "payload": {
      "appPath": appPath,
      "metadataPath": metadataPath
    }
  });
  res.send();
};