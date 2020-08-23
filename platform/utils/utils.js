const crypto = require('crypto');
const config = require('./config.json');
const fetch = require('node-fetch');
const { networkInterfaces } = require('os');

exports.getGatewayIp = function() {
	const interfaceInConfig = config.network.interface;
	if(!interfaceInConfig) {
		throw new Error('interface not defined in utils/config.json');
	}
	const interfaces = networkInterfaces();
	if(interfaces.hasOwnProperty(interfaceInConfig)) {
		const sysInterface = interfaces[interfaceInConfig].find(elem => elem.family === 'IPv4');
		if(sysInterface) {
			return sysInterface.address;
		} else {
			throw new Error(`no IPv4 address found for ${interfaceInConfig} interface defined in utils/config.json`);
		}
	} else {
		throw new Error(`interface ${interfaceInConfig} defined in utils/config.json is not valid`);
	}
};

exports.getGatewayId = function() {
	const interfaceInConfig = config.network.interface;
	if(!interfaceInConfig) {
		throw new Error('interface not defined in utils/config.json');
	}
	const interfaces = networkInterfaces();
	if(interfaces.hasOwnProperty(interfaceInConfig)) {
		const sysInterface = interfaces[interfaceInConfig].find(elem => elem.family === 'IPv4');
		if(sysInterface) {
			return sysInterface.mac;
		} else {
			throw new Error(`${interfaceInConfig} interface defined in utils/config.json is not an IPv4 interface`);
		}
	} else {
		throw new Error(`interface ${interfaceInConfig} defined in utils/config.json is not valid`);
	}
};

const algorithm = 'aes-256-ctr';

exports.encryptAES = function(text, password, iv) {
	const cipher = crypto.createCipheriv(algorithm, password, iv);
	let encrypted = cipher.update(text, 'utf8', 'base64');
	encrypted += cipher.final('base64');
	return encrypted;
};

exports.decryptAES = function(encrypted, password, iv) {
	const decipher = crypto.createDecipheriv(algorithm, password, iv);
	let dec = decipher.update(encrypted, 'base64', 'utf8');
	dec += decipher.final('utf8');
	return dec;
};

/**
 * Obtain the Link Graph by sending a request on the api-server.
 * @return {Promise<linkGraphJson>}
 */
exports.getLinkGraph = function() {
	const execUrl = 'http://localhost:5000/platform/link-graph-data';
	return fetch(execUrl, {method: 'GET'})
		.then(body => body.json());
};

exports.sendGetRequest = function(url) {
	return fetch(url, {
		method: 'GET'
	});
};

exports.sendPostRequest = function(url, data) {
	return fetch(url, {
		method: 'POST',
		body: JSON.stringify(data),
		headers: {'Content-Type': 'application/json'},
		timeout: 5000
	});
};
