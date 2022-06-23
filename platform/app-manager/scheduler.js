const fs = require('fs-extra');
const utils = require('../utils/utils');
const path = require('path');
const crypto = require('crypto');

class Gateway {
    constructor(id, ip, memoryFreeMB, cpuFreePercent, numDevicesSupported) {
        this.id = id;
        this.ip = ip;
        this.memoryFreeMB = memoryFreeMB;
        this.cpuFreePercent = cpuFreePercent;
        this.numDevicesSupported = numDevicesSupported;
    }

    toString() {
        return `Gateway @ ${this.ip}, [MemFreeMB: ${this.memoryFreeMB}, CPUFreePercent: ${this.cpuFreePercent}, 
            numDevicesSupported: ${this.numDevicesSupported}]`;
    }
}

// Specifies the threshold free CPU % and available memory on the gateways to execute an application
const CPU_FREE_PERCENT_THRESHOLD = 0.05; // 5% free CPU
const MEM_FREE_MB_THRESHOLD = 200; // 200MB of available memory

/**
 * Returns the best gateway to execute an application among two specified gateways.
 * The gateway is picked based on the number of supported devices, memory usage, and cpu usage (in that order).
 * @param gateway1 @type Gateway
 * @param gateway2 @type Gateway
 * @return {Gateway}
 */
function compareGateways(gateway1, gateway2) {
    if(gateway1.numDevicesSupported === gateway2.numDevicesSupported) {
        if(gateway1.memoryFreeMB === gateway2.memoryFreeMB) {
            return gateway1.cpuFreePercent >= gateway2.cpuFreePercent ? gateway1 : gateway2;
        } else {
            return gateway1.memoryFreeMB > gateway2.memoryFreeMB ? gateway1 : gateway2;
        }
    } else {
        return gateway1.numDevicesSupported > gateway2.numDevicesSupported ? gateway1 : gateway2;
    }
}

/**
 * Given a list of devices and the current link graph of the network, finds out which gateways host those devices.
 * Returns a dictionary of gateway->[sensor-ids]
 * @param devicesIds List of sensor ids
 * @param linkGraph Current link graph of the network
 * @returns {Promise<{}>} Promise object of the gateway->[sensor-id] mapping
 */
async function getHostGateways(devicesIds, linkGraph) {
    const gatewayToSensorMapping = {};
    const data = linkGraph["data"];

    for (const [gatewayId, gatewayData] of Object.entries(data)) {
        const gatewayDeviceList = gatewayData["devices"];
        const gatewayIp = gatewayData["ip"];

        //for each device given to us, find out if that is present in the device list of the current gw
        for (let i = 0; i < devicesIds.length; i++) {
            const targetDeviceId = devicesIds[i];
            const matchFound = gatewayDeviceList.find(function (device) {
                return device["id"] === targetDeviceId;
            });
            //there's a match
            if (matchFound) {
                if (gatewayIp in gatewayToSensorMapping) {
                    gatewayToSensorMapping[gatewayIp].push(targetDeviceId);
                } else {
                    gatewayToSensorMapping[gatewayIp] = [targetDeviceId];
                }
            }
        }
    }
    return gatewayToSensorMapping;
}

/**
 * This function generates the id of the new application.
 * The id is also used for application's topic
 * @param {string} appName
 * @returns {string}
 */
function generateAppId(appName) {
    // The fastest algorithm is sha1-base64
    // Reference: https://medium.com/@chris_72272/what-is-the-fastest-node-js-hashing-algorithm-c15c1a0e164e
    const hash = crypto.createHash('sha1');
    // Use the timestamp and application's name to create id
    hash.update(Date.now().toString() + appName);
    return hash.digest('hex');
}

/**
 * Picks an executor gateway to run the app and a watcher gateway to watch for failure of the executor gateway to restart the app
 * @param appPath Path to the app
 * @param metadataPath path to metadata
 */
async function schedule(appPath, metadataPath) {
    let metadata;
    try {
        metadata = await fs.readJson(metadataPath);
    } catch (err) {
        throw new Error(`error reading json file at metadataPath ${metadataPath}. Error = ${err.toString()}`);
    }
    if(!metadata.hasOwnProperty("devices")) {
        throw new Error("Metadata doesn't have devices specified.");
    }
    const requiredDevices = metadata["devices"]["ids"]; // metadata object contains required devices and the runtime

    // identify best gateway to execute the app based on device requirements and load on gateways
    const linkGraph = await utils.getLinkGraph();
    // for each gateway in the link graph, obtain the resource usage
    const gatewayIds = Object.keys(linkGraph.data);
    const gatewayIpAddresses = Object.values(linkGraph.data).map(value => value.ip);

    const promises = gatewayIpAddresses.map(ip => utils.getGatewayResourceUsage(ip));
    const resourceUsages = await Promise.all(promises);

    const gatewayToDeviceMapping = await getHostGateways(requiredDevices, linkGraph);

    const availableGateways = [];
    gatewayIpAddresses.forEach((gatewayIp, index) => {
        const gateway = new Gateway(gatewayIds[index],
            gatewayIp,
            resourceUsages[index]['memoryFreeMB'],
            resourceUsages[index]['cpuFreePercent'],
            gatewayToDeviceMapping.hasOwnProperty(gatewayIp) ?
                gatewayToDeviceMapping[gatewayIp].length : 0);

        availableGateways.push(gateway);
    });

    // filter out gateways which do not have enough resources to run the application
    const candidateGateways = availableGateways.filter(gateway => gateway.cpuFreePercent >= CPU_FREE_PERCENT_THRESHOLD &&
        gateway.memoryFreeMB >= MEM_FREE_MB_THRESHOLD);

    if(candidateGateways.length === 0) {
        throw new Error('Gateway devices are low on resources. Could not deploy application.');
    } else {
        // find the best gateway by comparing amongst each other
        const executorGateway = candidateGateways.reduce(compareGateways);
        let watcherGateway;

        //deploy the code using the Gateway API on the executor gateway
        const appName = path.basename(appPath);
        const appId = generateAppId(appName); // generate an appId for this app

        const appFiles = {
            app: appPath,
            metadata: metadataPath
        };

        try {
            console.log(`executing the app on ${executorGateway.ip}`);
            await utils.executeAppOnGateway(executorGateway.ip, appFiles, appId, linkGraph);
        } catch(err) {
            throw new Error(`Error trying to execute app ${appId} on ${executorGateway.ip}. Error = ${err.toString()}`);
        }

        // pick a watcher gateway (randomly picked from the candidate gateways, not the executor gateway)
        candidateGateways.splice(candidateGateways.indexOf(executorGateway),1); // remove the executor gateway first

        if(candidateGateways.length !== 0) {
            watcherGateway = candidateGateways[Math.floor(Math.random()*candidateGateways.length)];
            console.log(`watcher for the app: ${watcherGateway.ip}`);
            try {
                await utils.watchAppOnGateway(watcherGateway.ip, appFiles, appId, executorGateway.id);
            } catch(err) {
                throw new Error(`Error trying to watch app ${appId} on ${watcherGateway.ip}. Error = ${error.toString()}`);
            }
        } else {
            // no gateways available to watch this app
            console.error(`no gateways available to watch app ${appId}.`);
        }
        // return the executor and watcher gateway ip addresses
        return {
            "executor": executorGateway.ip,
            "watcher": watcherGateway ? watcherGateway.ip : ""
        };
    }
}

module.exports = {
    schedule: schedule
};