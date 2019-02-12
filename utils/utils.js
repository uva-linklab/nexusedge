module.exports.logWithTs = logWithTs;
module.exports.getIPAddress = getIPAddress;
const ip = require('ip');

function logWithTs(log) {
	console.log(`[${getCurrentDateTime()}] ${log}`);
}

function getCurrentDateTime() {
	return new Date().toLocaleString("en-US", {timeZone: "America/New_York"});
}

function getIPAddress() {
	return ip.address();
}