const request = require('request-promise');
const mqtt = require('mqtt');
const utils = require('../../../utils/utils');
const mqttTopic = 'platform-data';

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
    const ipAddress = utils.getIPAddress();
    const isLocalRequest = req.connection.localAddress === req.connection.remoteAddress;

    if(isLocalRequest) {
        //if it is a local request, forward to everyone, no need to publish on mqtt

        //get the link graph to get all the gateways in the network
        const linkGraph = await getLinkGraphData();
        const gatewayIPAddressList = getGatewayIPAddressList(linkGraph);

        gatewayIPAddressList
            .filter(gatewayIP => gatewayIP !== ipAddress) //exclude self from the list of recipients
            .forEach(gatewayIP => platformAPIFunction(gatewayIP, data)); //call the platform API function

    } else {
        //if it is a request from some other gateway, then publish it on mqtt
        publishOnMQTT("mqtt://localhost", mqttTopic, JSON.stringify(data));
    }
    res.sendStatus(200);
}

function getGatewayIPAddressList(linkGraph) {
    return Object.entries(linkGraph.data).map(entry => entry[1]["ip"]);
}

/**
 * Use the platform API to get the link graph data
 * @returns {Promise<any>} promise of the link graph json
 */
async function getLinkGraphData() {
    const execUrl = `http://localhost:5000/platform/link-graph-data`;
    const body = await request({method: 'GET', uri: execUrl});
    return JSON.parse(body);
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

function publishOnMQTT(url, topic, msg) {
    const mqttClient = mqtt.connect(url);
    mqttClient.on('connect', () => {
        console.log("connected to mqtt");
        mqttClient.publish(topic, msg, function (err) {
            console.log("publish complete");
            mqttClient.end();
        });
    });
}