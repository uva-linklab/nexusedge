const daoHelper = require('../../../dao/dao-helper');
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
    const neighborData = await daoHelper.neighborsDao.getNeighborDataSince(300000);
    return res.json(neighborData);
};

/**
 * Returns the sensors connected in the last 5 mins.
 * @param req
 * @param res
 * @returns {Promise<*>}
 */
exports.getSensors = async function(req, res) {
    const sensorData = await daoHelper.sensorsDao.getSensorDataSince(300000);
    return res.json(sensorData);
};

/**
 * This call gives the status of the server.
 * It is primarily intended to be used as a means to check reachability.
 * @param req
 * @param res
 * @returns {Promise<*>}
 */
exports.getServerStatus = async function(req, res) {
    // for the time being use a simple json with a status=true key-value
    const status = {status: true};
    return res.json(status);
};

/**
 * This endpoint takes the uploaded code and metadata and
 * executes it using the code-container module.
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

// TODO: need to be changed to the general api.
/**
 * This endpoint takes sensor requirement from the remote gateways and
 * passes the sensor requirement to sensor-stream-manager.
 * @param req
 * @param res
 * @returns {Promise<void>}
 */
exports.registerAppSensorRequirement = async function(req, res) {
    // Forward the application's sensor requirement to sensor-stream-manager
    messagingService.forwardMessage(serviceName, "sensor-stream-manager", "register-topic", {
        "app": req.body
    });
    res.send();
};

exports.talkToManager = async function(req, res) {
    const jsonData = req.body;

    if(jsonData != null) {
        /*
        Format:
        {
            "_meta" : {
                "recipient": "manager-name-goes-here"
                "event": "..."
            },
            "payload": {
                ...
            }
        }
        */
        const recipient = jsonData["_meta"]["recipient"];
        const event = jsonData["_meta"]["event"];
        const payload = jsonData["payload"];

        this.messagingService.forwardMessage(serviceName, recipient, event, payload);
    }

    res.send();
};