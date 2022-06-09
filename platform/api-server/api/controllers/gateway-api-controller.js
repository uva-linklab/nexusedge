const MessagingService = require('../../../messaging-service');
const utils = require('../../../utils/utils');
const path = require('path');

const serviceName = process.env.SERVICE_NAME;
const messagingService = new MessagingService(serviceName);

exports.getLinkGraphData = async function(req, res) {
    const neighbors =
        await messagingService.query(serviceName, 'device-manager', 'get-neighbors', {});
    const devices =
        await messagingService.query(serviceName, 'device-manager', 'get-devices', {});
    const apps =
        await messagingService.query(serviceName, 'app-manager', 'get-apps', {});
    return res.json({
        "neighbors": neighbors,
        "devices": devices,
        "apps": apps
    });
};

/**
 * Return the neighboring gateways.
 * @param req
 * @param res
 * @returns {Promise<*>}
 */
exports.getNeighbors = async function(req, res) {
    const response =
        await messagingService.query(serviceName, 'device-manager', 'get-neighbors', {});
    return res.json(response);
};

/**
 * Returns the active devices.
 * @param req
 * @param res
 * @returns {Promise<*>}
 */
exports.getDevices = async function(req, res) {
    const response =
        await messagingService.query(serviceName, 'device-manager', 'get-devices', {});
    return res.json(response);
};

/**
 * Returns the currently running apps.
 * @param req
 * @param res
 * @returns {Promise<*>}
 */
exports.getApps = async function(req, res) {
    const response =
        await messagingService.query(serviceName, 'app-manager', 'get-apps', {});
    return res.json(response);
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
 * This call gives the status of the server.
 * It is primarily intended to be used as a means to check reachability.
 * @param req
 * @param res
 * @returns {Promise<*>}
 */
exports.getStartTime = async function(req, res) {
    const response = {startTime: utils.getStartTime()};
    return res.json(response);
};


/**
 * This call retrieves the self details of the gateway.
 * @param req
 * @param res
 * @return {*}
 */
exports.getGatewayDetails = function(req, res) {
    const selfDetails = {id: utils.getGatewayId(), ip: utils.getGatewayIp()};
    return res.json(selfDetails);
};

/**
 * Give gateway's resource usage statistics.
 * @param req
 * @param res
 * @return {*}
 */
exports.getResourceUsage = async function(req, res) {
    const resourceUsage = await utils.getResourceUsage();
    return res.json(resourceUsage);
};


/**
 * This endpoint takes the uploaded code and metadata and requests app-manager to execute it.
 * @param req
 * @param res
 * @returns {Promise<void>}
 */
exports.executeApp = async function(req, res) {
    const appId = req.body.appId;
    if(!appId) {
        res.status(400).send({
            message: 'no app id provided!'
        });
    } else {
        const appPath = req["files"]["app"][0]["path"];
        const metadataPath = req["files"]["metadata"][0]["path"];

        // Forward the application path and metadata.
        // The data format is described in the platform-manager.js
        const response = await messagingService.query(serviceName, "app-manager", "execute-app", {
            "appId": appId,
            "appPath": appPath,
            "metadataPath": metadataPath
        });

        // remove the app and metadata
        utils.deleteFile(path.dirname(appPath));
        utils.deleteFile(path.dirname(metadataPath));
        res.send(response);
    }
};

/**
 * This endpoint takes a copy of the  uploaded code and metadata and requests app-manager to watch it.
 * @param req
 * @param res
 * @returns {Promise<void>}
 */
exports.watchApp = async function(req, res) {
    const appId = req.body.appId;
    const executorGatewayId = req.body.executorGatewayId;
    if(!appId || !executorGatewayId) {
        res.status(400).send({
            message: 'no app id or executor gateway id provided!'
        });
    } else {
        const appPath = req["files"]["app"][0]["path"];
        const metadataPath = req["files"]["metadata"][0]["path"];

        // Forward the application path and metadata.
        // The data format is described in the platform-manager.js
        const response = await messagingService.query(serviceName, "app-manager", "watch-app", {
            "appId": appId,
            "executorGatewayId": executorGatewayId,
            "appPath": appPath,
            "metadataPath": metadataPath,
        });

        // remove the app and metadata
        utils.deleteFile(path.dirname(appPath));
        utils.deleteFile(path.dirname(metadataPath));
        res.send(response);
    }
};

exports.terminateApp = async function(req, res) {
    const appId = req.params['id'];
    if(appId) {
        // Forward the termination request to app-manager
        const response =
            await messagingService.query(serviceName, "app-manager", "terminate-app", {
                "id": appId
            });
        return res.json(response);
    } else {
        res.status(400).send({
            message: 'no app id provided!'
        });
    }
};

exports.getLogStreamingTopic = async function(req, res) {
    const appId = req.params['id'];
    if(appId) {
        // pass the request to app-manager and get back an mqtt topic to listen to the logs
        const response =
            await messagingService.query(serviceName, 'app-manager', 'get-log-streaming-topic', {
                'id': appId
            });
        return res.json(response);
    } else {
        res.status(400).send({
            message: 'no app id provided!'
        });
    }
};

exports.startLogStreaming = async function(req, res) {
    const appId = req.params['id'];
    if(appId) {
        // pass the request to app-manager and get back an mqtt topic to listen to the logs
        const response =
            await messagingService.query(serviceName, 'app-manager', 'start-log-streaming', {
                'id': appId
            });
        return res.json(response);
    } else {
        res.status(400).send({
            message: 'no app id provided!'
        });
    }
};

exports.stopLogStreaming = async function(req, res) {
    const appId = req.params['id'];
    if(appId) {
        // Forward the termination request to app-manager
        const response =
            await messagingService.query(serviceName, "app-manager", "stop-log-streaming", {
                "id": appId
            });
        return res.json(response);
    } else {
        res.status(400).send({
            message: 'no app id provided!'
        });
    }
};

/**
 * This endpoint takes sensor requirement from the remote gateways and
 * passes the sensor requirement to sensor-stream-manager.
 * @param req
 * @param res
 * @returns {Promise<void>}
 */
exports.registerAppSensorRequirement = async function(req, res) {
    // Forward the application's sensor requirement to sensor-stream-manager
    messagingService.forwardMessage(serviceName, "sensor-stream-manager", "register-topic", req.body);
    res.send();
};

exports.deregisterAppSensorRequirement = async function(req, res) {
    // Forward the application's sensor requirement to sensor-stream-manager
    messagingService.forwardMessage(serviceName, "sensor-stream-manager", "deregister-topic", req.body);
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

exports.retrievePrivacyPolicy = async function(req, res) {
    const policy = await messagingService.query(serviceName, "sensor-stream-manager", "retrieve-policy", {});
    res.json(policy);
};