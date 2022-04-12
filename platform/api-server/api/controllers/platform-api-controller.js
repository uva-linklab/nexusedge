const request = require('request-promise');
const utils = require('../../../utils/utils');
const child_process = require('child_process');
const MqttController = require('../../../utils/mqtt-controller');
const mqttController = MqttController.getInstance();
const mqttTopic = 'platform-data';
const MessagingService = require('../../../messaging-service');

const serviceName = process.env.SERVICE_NAME;
const messagingService = new MessagingService(serviceName);

exports.disseminateAll = async function (req, res) {
    return platformAPICallHelper(req, res, sendDisseminateAllRequest);
};

exports.queryAll = async function (req, res) {
    return platformAPICallHelper(req, res, sendQueryAllRequest);
};

/**
 * This method performs the disseminate-all or query-all platform API functions depending on the platformAPIFunction
 * parameter. This is a helper function to reduce code rewrite for the similar looking disseminate-all and query-all
 * API methods. If the API call is from the same machine, then the call is forwarded to all the gateways in the platform.
 * If not, it is send to the local MQTT for consumption by apps.
 * @param req
 * @param res
 * @param platformAPIFunction
 * @returns {Promise<void>}
 */
async function platformAPICallHelper(req, res, platformAPIFunction) {
    const data = req.body;
    const ipAddress = utils.getGatewayIp();
    const isLocalRequest = req.connection.localAddress === req.connection.remoteAddress;

    if(isLocalRequest) {
        //if it is a local request, forward to everyone, no need to publish on mqtt

        //get the link graph to get all the gateways in the network
        const linkGraph = await utils.getLinkGraph();
        const gatewayIPAddressList = getGatewayIPAddressList(linkGraph);

        gatewayIPAddressList
            .filter(gatewayIP => gatewayIP !== ipAddress) //exclude self from the list of recipients
            .forEach(gatewayIP => platformAPIFunction(gatewayIP, data)); //call the platform API function

    } else {
        // if it is a request from some other gateway, then publish it on local mqtt
        mqttController.publish("localhost", mqttTopic, JSON.stringify(data));
    }
    res.sendStatus(200);
}

function getGatewayIPAddressList(linkGraph) {
    return Object.entries(linkGraph.data).map(entry => entry[1]["ip"]);
}

/**
 * Use the platform API to send a disseminate-all request to a gateway with the data
 * @param gatewayIP
 * @param data
 * @returns {Promise<void>}
 */
async function sendDisseminateAllRequest(gatewayIP, data) {
    const execUrl = `http://${gatewayIP}:5000/platform/disseminate-all`;
    sendPostRequest(execUrl, data);
}

/**
 * Use the platform API to send a query-all request to a gateway with the data
 * @param gatewayIP
 * @param data
 * @returns {Promise<void>}
 */
async function sendQueryAllRequest(gatewayIP, data) {
    const execUrl = `http://${gatewayIP}:5000/platform/query-all`;
    sendPostRequest(execUrl, data);
}

function sendPostRequest(url, data) {
    const options = {
        method: 'POST',
        uri: url,
        body: data,
        json: true // Automatically stringifies the body to JSON
    };
    request(options);
}

/**
 * This endpoint takes the privacy policy and
 * passes the policy to sensor-stream-manager.
 * @param req
 * @param res
 * @returns {Promise<void>}
 */
exports.updatePrivacyPolicy = async function(req, res) {
    // Forward the privacy policy to sensor-stream-manager
    messagingService.forwardMessage(serviceName, "sensor-stream-manager", "update-policy", {
        "policy": req.body
    });
    res.send();
};

exports.deployApplication = async function(req, res) {
    const deployMetadataPath = req['files']['deployMetadata'][0]['path'];
    const packagePath = req['files']['appPackage'][0]['path'];
    console.log(`Received deploy metadata at ${deployMetadataPath}`);
    console.log(`Received app package at ${packagePath}`);

    // Unpackage the app metadata.
    try {
        child_process.execFileSync(
            '/usr/bin/tar',
            ['-x', '-f', packagePath, '_metadata.json'],
            { cwd: '/tmp', timeout: 1000 });
    } catch (e) {
        console.log(`Failed to unpackage app metadata: ${e}.`);
        res.sendStatus(500);
        return;
    }

    // Obtain gateway resource information.
    const graph = await utils.getLinkGraph();
    const gatewayIPs = getGatewayIPAddressList(graph);
    const gatewayResources = await Promise.all(gatewayIPs.map((ip) => {
        const opts = {
            method: 'GET',
            uri: `http://${ip}:5000/gateway/resources`,
            json: true
        };

        return request(opts)
            .then((res) => { return { ip: ip, resources: res } });
    }));

    const gateway = schedule(null, null, gatewayResources);
    console.log(`Executing application on ${gateway.ip}.`);

    res.sendStatus(204);
};

function schedule(deployMetadata, runMetadata, gateways) {
    return gateways[0];
}
