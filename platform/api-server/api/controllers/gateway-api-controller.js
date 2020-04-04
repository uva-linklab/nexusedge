const discoveryModel = require('../models/discovery-model');
const path = require("path");
let ipc = require('node-ipc');

const role = process.env.role;
ipc.config.appspace = "gateway."
ipc.config.socketRoot = path.normalize(`${__dirname}/../../../socket/`);
ipc.config.id = role;
ipc.config.retry = 1500;
ipc.config.silent = true;

ipc.connectTo('platform', () => {
  ipc.of.platform.on('connect', () => {
    console.log(`gateway-api-controller connected to platform`);
    ipc.of.platform.emit(role, `${role} send back the socket`);
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

  ipc.emit('app-deployment', {
    appPath: appPath,
    metadataPath: metadataPath
  });
  res.send();
};