const discoveryModel = require('../models/discovery-model');
const MessagingService = require('../../../messaging-service');

const serviceName = process.env.SERVICE_NAME;
const messagingService = new MessagingService(serviceName);

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
    // The data format is described in the platform-manager.js
    messagingService.forwardMessage(serviceName, "app-manager", "app-deployment", {
        "appPath": appPath,
        "metadataPath": metadataPath
    });

    res.send();
};

/**
 * This endpoint takes sensor requirement from the other gateways.
 * @param req
 * @param res
 * @returns {Promise<void>}
 */
exports.registerAppSensorReqruirement = async function(req, res) {
    // Forward the application's sensor requirement to sensor-stream-manager
    messagingService.forwardMessage(serviceName, "sensor-stream-manager", "register-topic", {
        "app": req.body
    });

    res.send();
};