const utils = require('../utils/utils');
/**
 * This function picks the best gateway to run the app and uses the API on that gateway to execute the app.
 * @param appPath Path to the app
 * @param devices List of device ids
 * @param runtime runtime to use for the app
 * @param callback Indicates whether the app deployment was successful or not using a boolean argument
 */
async function schedule(appPath, devices, runtime, callback) {
    const linkGraph = await utils.getLinkGraph();

    // for each gateway in the link graph, obtain the resource usage
    const gatewayIpAddresses = Object.values(linkGraph.data).map(value => value.ip);

    const promises = gatewayIpAddresses.map(ip => utils.getResourceUsage(ip));
    const resourceUsages = await Promise.all(promises);

    const gatewayToDeviceMapping = await getHostGateways(devices, linkGraph);

    const availableGateways = [];
    gatewayIpAddresses.forEach((gatewayIp, index) => {
        const gateway = new Gateway(gatewayIp,
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
        callback(false, 'Gateway devices are low on resources. Could not deploy application.');
        deleteFile(appPath);
    } else {
        // find the best gateway by comparing amongst each other
        const idealGateway = candidateGateways.reduce(compareGateways);

        //store the metadata to a file
        const metadata = {"deviceMapping": gatewayToDeviceMapping};
        const metadataPath = path.join(__dirname, 'metadata.json');
        fs.writeFileSync(metadataPath, JSON.stringify(metadata));

        //deploy the code using the Gateway API on the target gateway
        const appFiles = {
            app: appPath,
            metadata: metadataPath
        };

        utils.executeAppOnGateway(idealGateway.ip, appFiles, runtime)
            .then(() => callback(true, ''))
            .catch(() => callback(false, `App deployment attempt on ${idealGateway.ip} failed. Please try again.`))
            .finally(() => {
                deleteFile(appPath);
                deleteFile(metadataPath);
            });
    }
};

module.exports = {
    schedule: schedule
};