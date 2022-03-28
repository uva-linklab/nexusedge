const crypto = require('crypto');
const config = require('./config.json');
const fetch = require('node-fetch');
const os = require('os');
const Address4 = require('ip-address').Address4;
const osUtils = require('os-utils');
const fs = require('fs');

// store the time when the gateway platform starts up
const startTime = Date.now();

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
function getResourceUsage() {
	return getFreeCpuPercent().then(freeCpuPercent => {
		return {
			cpuFreePercent: freeCpuPercent,
			memoryFreeMB: getFreeMemoryMB()
		};
	})
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
	const interfaceInConfig = getConfig('network')['interface'];
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
		const interfaceInConfig = getConfig('network')['interface'];
		const systemInterfaces = os.networkInterfaces();
		if(systemInterfaces.hasOwnProperty(interfaceInConfig)) {
			const sysInterface = systemInterfaces[interfaceInConfig].find(elem => elem.family === 'IPv4');
			if(sysInterface) {
				return sysInterface.mac.replace(/:/g, ''); // remove all colon chars
			} else {
				throw new Error(`${interfaceInConfig} interface defined in utils/config.json is not an IPv4 interface`);
			}
		} else {
			throw new Error(`interface ${interfaceInConfig} defined in utils/config.json is not valid`);
		}
	}
}

function getGatewayTags() {
    try {
        var tagText = fs.readFileSync('/etc/gateway-tags.json');
        var arr = JSON.parse(tagText);

        if (!(arr instanceof Array)) {
            throw new Error('/etc/gateway-tags.json is not a JSON array.');
        } else {
            return arr;
        }
    } catch (e) {
        if (e instanceof SyntaxError) {
            throw new Error('/etc/gateway-tags.json is not valid JSON.');
        } else {
            console.log('Could not read /etc/gateway-tags.json');
            return [];
        }
    }
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
	const groupKey = getConfig('groupKey');

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
	const groupKey = getConfig('groupKey');

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

module.exports = {
	getStartTime: getStartTime,
	getGatewayIp: getGatewayIp,
	getGatewayId: getGatewayId,
    getGatewayTags: getGatewayTags,
	getAdvertisementName: getAdvertisementName,
	getGatewayDetails: getGatewayDetails,
	getLinkGraph: getLinkGraph,
	sendGetRequest: sendGetRequest,
	sendPostRequest: sendPostRequest,
	getFreeCpuPercent: getFreeCpuPercent,
	getFreeMemoryMB: getFreeMemoryMB,
	getResourceUsage: getResourceUsage
};
