module.exports.logWithTs = logWithTs;
module.exports.getIPAddress = getIPAddress;
//const ip = require('ip');
const pcap = require('pcap');

function logWithTs(log) {
	console.log(`[${getCurrentDateTime()}] ${log}`);
}

function getCurrentDateTime() {
	return new Date().toLocaleString("en-US", {timeZone: "America/New_York"});
}

//function getIPAddress() {
//	return ip.address();
//}

//TODO move the wlan0 harcoding to a config file
function getIPAddress() {
	return pcap.findalldevs().filter(entry => entry.name === "wlan0")[0].addresses.filter(entry => entry.addr != "")[0].addr;
}
