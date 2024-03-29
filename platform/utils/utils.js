const crypto = require('crypto');
const config = require('./config.json');
const fetch = require('node-fetch');
const os = require('os');
const Address4 = require('ip-address').Address4;
const osUtils = require('os-utils');
const fs = require('fs-extra');
const httpFileTransfer = require("./http-file-transfer");
const path = require('path');
const sysinfo = require('systeminformation');

// store the time when the gateway platform starts up
const startTime = Date.now();
let key, iv, groupKey;
let backhaulInterface;
let serviceUuid, charUuid, bleAdvUuids;

const StoragePath = '/var/tmp';

// Find the tar utility.
// Assuming it exists, it is either in /bin/tar or /usr/bin/tar.
const tarPath = fs.existsSync('/bin/tar') ? '/bin/tar' : '/usr/bin/tar';

function getStorageFilesystem() {
    // Find which filesystem has the configured StoragePath under it.
    return sysinfo.fsSize().then((filesystems) => {
        // Shortest relative path back to the mount wins.
        var mountFs = null;
        var levels = -1;
        for (var i = 0; i < filesystems.length; i++) {
            const relativePath = path.relative(StoragePath, filesystems[i].mount);
            const isParent = relativePath.split(path.sep)
                  .reduce((acc, cur) => { return (acc && cur == '..'); }, true);
            const levelsUp = relativePath.split('..').length;

            if (isParent && (relativePath.split(path.sep).length - 1 < levels || mountFs === null)) {
                mountFs = filesystems[i];
                levels = levelsUp;
            }
        }

        return mountFs;
    })
        .catch((e) => { console.log(`Getting FSs failed: ${e}`); });
}

function getStartTime() {
	return startTime;
}

function getFreeCpuPercent() {
	return new Promise(resolve => {
		osUtils.cpuFree(cpuFreePercent => {
			resolve(cpuFreePercent)
		});
	})
}

function getFreeMemoryMB() {
	return osUtils.freemem();
}

/**
 * Get the % of free cpu, and the megabytes of free memory available
 * @return {Promise<{cpu: *, memory: *}>}
 */
// TODO change this to use load avg instead of cpu free
function getResourceUsage() {
	return getFreeCpuPercent().then(freeCpuPercent => {
		return {
			cpuFreePercent: freeCpuPercent,
			memoryFreeMB: getFreeMemoryMB()
		};
	})
}

/**
 * Returns a snapshot of the gateways resource usage and capabilities.
 */
function getResources() {
    return Promise.all([sysinfo.currentLoad(),
                        sysinfo.mem(),
                        getStorageFilesystem(),
                        sysinfo.cpu(),
                        sysinfo.graphics()])
        .then(([load, mem, storageFs, cpuInfo, gpuInfo]) => {
            // Look for secure enclave support in CPU flags.
            const cpuFlags = cpuInfo.flags.split(' ');
            const secureEnclaveAvailable = ['sgx', 'sev']
                  .reduce((acc, cur) => { return (acc || (cur in cpuFlags)); }, false);

            // Build graphics card information.
            const gpus = gpuInfo.controllers.map((gpu) => {
                return {
                    memoryFreeMB: Math.trunc(gpu.memoryFree / (1024 * 1024)),
                    utilization: gpu.utilizationGpu
                };
            });

            return {
                cpuFreePercent: load.currentLoad,
                memoryFreeMB: Math.trunc(mem.available / (1024 * 1024)),
                storageFreeMB: Math.trunc(storageFs.available / (1024 * 1024)),
                secureEnclave: secureEnclaveAvailable,
                gpus: gpus
            };
        });
}

function getConfig(key) {
	const value = config[key];
	if(!value) {
		throw new Error(`${key} not defined in utils/config.json`);
	}
	return value;
}

/**
 * Returns the ip address of the network interface defined in config.network.interface
 * @return {string}
 */
function getGatewayIp() {
	const interfaceInConfig = getBackhaulInterface();
	const systemInterfaces = os.networkInterfaces();
	if(systemInterfaces.hasOwnProperty(interfaceInConfig)) {
		const sysInterface = systemInterfaces[interfaceInConfig].find(elem => elem.family === 'IPv4');
		if(sysInterface) {
			return sysInterface.address;
		} else {
			throw new Error(`no IPv4 address found for ${interfaceInConfig} interface defined in utils/config.json`);
		}
	} else {
		throw new Error(`interface ${interfaceInConfig} defined in utils/config.json is not valid`);
	}
}

/**
 * Returns an id for the gateway. Tries to obtain the gateway id in the following order:
 * 1) if /etc/gateway-id is present, then return the contents
 * 2) mac address of the network interface defined in config.network.interface
 * @return {string}
 */
function getGatewayId() {
	try {
		return fs.readFileSync('/etc/gateway-id', 'utf-8').trim();
	} catch (e) {
		console.log("/etc/gateway-id not found or unreadable");
		if(process.env.NEXUSEDGE_GATEWAY_ID) {
			return process.env.NEXUSEDGE_GATEWAY_ID;
		} else {
			const interfaceInConfig = getBackhaulInterface();
			const systemInterfaces = os.networkInterfaces();
			if(systemInterfaces.hasOwnProperty(interfaceInConfig)) {
				const sysInterface = systemInterfaces[interfaceInConfig].find(elem => elem.family === 'IPv4');
				if(sysInterface) {
					return sysInterface.mac.replace(/:/g, ''); // remove all colon chars
				} else {
					throw new Error(`${interfaceInConfig} interface defined in env var or utils/config.json is not an IPv4 interface`);
				}
			} else {
				throw new Error(`${interfaceInConfig} interface defined in env var or utils/config.json is not valid`);
			}
		}
	}
}

function getBackhaulInterface() {
	if(!backhaulInterface) {
		if(process.env.NEXUSEDGE_BACKHAUL_INTERFACE) {
			backhaulInterface = process.env.NEXUSEDGE_BACKHAUL_INTERFACE;
			console.log("read backhaul interface from env var");
		} else {
			backhaulInterface = getConfig('network')['interface'];
		}
	}
	return backhaulInterface;
}

function getGroupKey() {
	if(!groupKey) {
		if(process.env.NEXUSEDGE_GROUP_KEY && process.env.NEXUSEDGE_GROUP_IV) {
			key = process.env.NEXUSEDGE_GROUP_KEY;
			iv = process.env.NEXUSEDGE_GROUP_IV;
			groupKey = {
				"key": key,
				"iv": iv
			};
			console.log("read group key and iv from env vars");
		} else {
			groupKey = getConfig('groupKey');
		}
	}
	return groupKey;
}

function getBleAdvUuid() {
	if(!bleAdvUuids) {
		if(process.env.NEXUSEDGE_BLE_ADV_SERVICE_UUID && process.env.NEXUSEDGE_BLE_ADV_CHAR_UUID) {
			serviceUuid = process.env.NEXUSEDGE_BLE_ADV_SERVICE_UUID;
			charUuid = process.env.NEXUSEDGE_BLE_ADV_CHAR_UUID;
			bleAdvUuids = {
				"serviceUuid": serviceUuid,
				"charUuid": charUuid
			};
			console.log("read serviceUuid and charUuid from env vars");
		} else {
			bleAdvUuids = getConfig('bleAdvUuids');
		}
	}
	return bleAdvUuids;
}

// TODO: move getAdvertisementName() and getGateway() into a separate file that is available on npm for aux devices to use
/**
 * Returns an encrypted string that has embedded information about the id and ip address of the gateway. The encryption
 * in AES-256-CTR mode using the Group Key specified in config.groupKey. This encrypted string is to be used as the
 * local name in the BLE advertisement. It is made sure that the returned string is <= 31 bytes long, which is the
 * requirement for BLE advertisements.
 * @return {string}
 */
function getAdvertisementName() {
	const groupKey = getGroupKey();

	const id = getGatewayId();
	const ip = getGatewayIp();

	const ipHexStr = new Address4(ip).toHex().replace(/:/g, '');
	const strToEncrypt = `${id}*${ipHexStr}`;

	return encryptAES(strToEncrypt, groupKey.key, groupKey.iv);
}

/**
 * Returns a gateway's id and ip address from its encrypted advertisement name
 * @param advertisementName the encrypted local name field obtained from the BLE advertisement
 * @return {{ip: string, id: string}}
 */
function getGatewayDetails(advertisementName) {
	const groupKey = getGroupKey();

	const decryptedStr = decryptAES(advertisementName, groupKey.key, groupKey.iv);
	const parts = decryptedStr.split('*');

	return {
		id: parts[0],
		ip: Address4.fromHex(parts[1]).address
	};
}

const algorithm = 'aes-256-ctr';

function encryptAES(text, password, iv) {
	const cipher = crypto.createCipheriv(algorithm, password, iv);
	let encrypted = cipher.update(text, 'utf8', 'base64');
	encrypted += cipher.final('base64');
	return encrypted;
}

function decryptAES(encrypted, password, iv) {
	const decipher = crypto.createDecipheriv(algorithm, password, iv);
	let dec = decipher.update(encrypted, 'base64', 'utf8');
	dec += decipher.final('utf8');
	return dec;
}

/**
 * Obtain the Link Graph by sending a request on the api-server.
 * @return {Promise<linkGraphJson>}
 */
function getLinkGraph() {
	const execUrl = 'http://localhost:5000/platform/link-graph-data';
	return fetch(execUrl, {method: 'GET'})
		.then(body => body.json());
}

function sendGetRequest(url) {
	return fetch(url, {
		method: 'GET'
	});
}

function sendPostRequest(url, data) {
	return fetch(url, {
		method: 'POST',
		body: JSON.stringify(data),
		headers: {'Content-Type': 'application/json'},
		timeout: 5000
	});
}

/**
 * * Calls the execute-app API to run an app on a specified gateway
 * @param appFiles Object with key-value pairs app and metadata paths
 * @return {*}
 */
function scheduleApp(appFiles) {
	const httpFileTransferUri = `http://localhost:5000/platform/schedule-app`;
	return httpFileTransfer.transferFiles(httpFileTransferUri, appFiles, {
	});
}

/**
 * * Calls the execute-app API to run an app on a specified gateway
 * @param gatewayIP The ip of the gateway where the app needs to run
 * @param appFiles Object with key-value pairs app and metadata paths
 * @param appId
 * @param linkGraph optional
 * @return {*}
 */
function executeAppOnGateway(gatewayIP, appFiles, appId, linkGraph) {
	const httpFileTransferUri = `http://${gatewayIP}:5000/gateway/execute-app`;
	return httpFileTransfer.transferFiles(httpFileTransferUri, appFiles, {
		"appId": appId,
		"linkGraph": JSON.stringify(linkGraph)
	});
}

/**
 * * Calls the watch-app API to watch the app on a specified gateway
 * @param gatewayIP The ip of the gateway where the app needs to run
 * @param appFiles Object with key-value pairs app and metadata paths
 * @param appId
 * @param executorGatewayId
 * @return {*}
 */
function watchAppOnGateway(gatewayIP, appFiles, appId, executorGatewayId) {
	const httpFileTransferUri = `http://${gatewayIP}:5000/gateway/watch-app`;
	return httpFileTransfer.transferFiles(httpFileTransferUri, appFiles, {
		"appId": appId,
		"executorGatewayId": executorGatewayId
	});
}


async function getGatewayResourceUsage(gatewayIp) {
	const execUrl = `http://${gatewayIp}:5000/gateway/resource-usage`;
	return fetch(execUrl, {method: 'GET'}).then(body => body.json());
}

/**
 * Removes a file or directory. The directory can have contents. If the path does not exist, silently does nothing.
 * @param filePath
 */
function deleteFile(filePath) {
	return fs.remove(filePath);
}

module.exports = {
    tarPath: tarPath,

	getStartTime: getStartTime,
	getGatewayIp: getGatewayIp,
	getGatewayId: getGatewayId,
	getAdvertisementName: getAdvertisementName,
	getGatewayDetails: getGatewayDetails,
	getLinkGraph: getLinkGraph,
	sendGetRequest: sendGetRequest,
	sendPostRequest: sendPostRequest,
	getFreeCpuPercent: getFreeCpuPercent,
	getFreeMemoryMB: getFreeMemoryMB,
	getResourceUsage: getResourceUsage,
	getGatewayResourceUsage: getGatewayResourceUsage,
	executeAppOnGateway: executeAppOnGateway,
	watchAppOnGateway: watchAppOnGateway,
	scheduleApp: scheduleApp,
	deleteFile: deleteFile,
	getResources: getResources,
	getBleAdvUuid: getBleAdvUuid
};
