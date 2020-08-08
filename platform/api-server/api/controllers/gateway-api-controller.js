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
 * Returns the active devices.
 * @param req
 * @param res
 * @returns {Promise<*>}
 */
exports.getDevices = async function(req, res) {
    const response =
        await messagingService.query(serviceName, 'device-manager', 'get-active-devices', {});
    return res.json(response['devices']);
};

/**
 * Returns the currently running apps.
 * @param req
 * @param res
 * @returns {Promise<*>}
 */
exports.getApps = async function(req, res) {
    const appsData = await daoHelper.appsDao.fetchAll();
    return res.json(appsData);
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
 * This call retrieves the self details of the gateway.
 * @param req
 * @param res
 * @returns {Promise<*>}
 */
exports.getSelfDetails = async function(req, res) {
    const selfDetails = await daoHelper.selfDao.getLatestEntry();
    return res.json(selfDetails);
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

exports.terminateApp = async function(req, res) {
    const appId = req.body['id'];
    if(appId) {
        // Forward the termination request to app-manager
        messagingService.forwardMessage(serviceName, "app-manager", "terminate-app", {
            "id": appId
        });
    }
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

        messagingService.forwardMessage(serviceName, recipient, event, payload);
    }

    res.send();
};