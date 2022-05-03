const request = require('request-promise');
const fs = require('fs');
const path = require('path');
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
    const extractDir = '/tmp';
    try {
        child_process.execFileSync(
            '/usr/bin/tar',
            ['-x', '-f', packagePath, '_metadata.json'],
            { cwd: extractDir, timeout: 1000 });
    } catch (e) {
        console.log(`Failed to unpackage app metadata: ${e}.`);
        res.sendStatus(500);
        return;
    }

    const runMetadata = JSON.parse(await fs.promises.readFile(path.join(extractDir, '_metadata.json')));
    const deployMetadata = JSON.parse(await fs.promises.readFile(deployMetadataPath));

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

    const gateway = schedule(deployMetadata, runMetadata, gatewayResources);
    if (gateway !== null) {
        console.log(`Executing application on ${gateway.ip}.`);
        res.sendStatus(204);
    } else {
        // No gateways available for the application.
        // Send back 503 Service Unavailable.
        res.sendStatus(503);
    }
};

function schedule(deployMetadata, runMetadata, gateways) {
    // (1) Remove gateways based on specs, requirements, and connected devices.
    // Remove overloaded gateways.
    // Inspect CPU and memory load and removes gateways that are above the threshold.
    var candidates = gateways.filter((gw) => {
        return gw.resources.cpuFreePercent < 80
            && gw.resources.memoryFreeMB > 200;
    });

    // Include only gateways that fulfill all essential capabilities.
    candidates = candidates.filter((gw) => {
        for (var i = 0; i < runMetadata.requires.length; i++) {
            const r = runMetadata.requires[i];
            if (evaluate_capability(gw, r) != true) {
                return false;
            }
        }

        return true;
    });

    // TODO: include only gateways that have the devices required.

    // Make sure we still have gateways to work with after this filtering.
    if (candidates.length == 0) {
        return null;
    }

    // (2) Prioritize gateways with preferred capabilities.
    // Tier gateways by the number of optional requirements they fulfill
    // and take the gateways fulfilling the most preferences.
    // This does mean that each preferential capability is weighted evenly.
    //
    // Also the decision made here may run counter to the optimization step.
    // Example: single gateway with 10 preferential capabilities filled but is loaded
    // vs. five gateways with 9 preferential capabilities filled but less loaded.
    var most_fulfilled = 0;
    candidates = candidates.map((gw) => {
        var no_fulfilled = 0;
        runMetadata.prefers.forEach((p) => {
            if (evaluate_capability(gw, p)) {
                no_fulfilled += 1;
            }
        });

        gw.preferences_fulfilled = no_fulfilled;
        // Cache the most fulfilled for selecting the most preferential.
        if (no_fulfilled > most_fulfilled) {
            most_fulfilled = no_fulfilled;
        }

        return gw;
    });
    candidates = candidates.filter((gw) => gw.preferences_fulfilled == most_fulfilled)
        .map((gw) => { return { ip: gw.ip, resources: gw.resources }; });
    // TODO: factor in devices requested and favor those with more devices.

    // (3) Aim to balance loads and for a tight requirements fit.
    const optimizationSortFns = [
        (gwa, gwb) => gwa.resources.memoryFreeMB > gwb.resources.memoryFreeMB,
        (gwa, gwb) => {
            const reduceGpuMem = (acc, gpu) => acc + gpu.memoryFreeMB;
            const a = gwa.resources.gpus.reduce(reduceGpuMem, 0);
            const b = gwb.resources.gpus.reduce(reduceGpuMem, 0);
            return a > b;
        },
        (gwa, gwb) => gwa.resources.storageFreeMB > gwb.resources.storageFreeMB,
        (gwa, gwb) => {
            const reduceGpuUtil = (acc, gpu) => acc + gpu.utilization;
            const a = gwa.resources.gpus.reduce(reduceGpuUtil, 0);
            const b = gwa.resources.gpus.reduce(reduceGpuUtil, 0);
            return a < b;
        },
        (gwa, gwb) => gwa.resources.cpuFreePercent < gwa.resources.cpuFreePercent,
        // Look for a tighter fit on gateway requirements by prioritizing gateways with the least no. of capabilities.
        (gwa, gwb) => capability_count(gwa.resources) < capability_count(gwb.resources)
    ];
    optimizationSortFns.forEach((sortFn) => { candidates.sort(sortFn); });

    if (candidates.length > 0) {
        return candidates[0];
    } else {
        return null;
    }
}

function evaluate_capability(gw, tag) {
    if (r == 'gpu') {
        // At least one GPU must have sufficient memory and idle compute.
        return gw.gpus.reduce((acc, cur) => {
            return acc || (cur.memoryFreeMB > 200 && cur.utilization < 80);
        }, false);
    } else if (r == 'secure-enclave') {
        // Just a flag check.
        return gw.secureEnclave;
    } else {
        // Unknown requirement.
        console.log(`Unknown requirement specified: '${r}'`);
        return null;
    }
}

function capability_count(resources) {
    var count = 0;

    if (resources.gpus.length > 0) { count += 1; }
    if (resources.secureEnclave) { count += 1; }
    if (resources.storageFreeMB > 1024) { count += 1; }

}
