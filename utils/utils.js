module.exports.logWithTs = logWithTs;
module.exports.getIPAddress = getIPAddress;
//const ip = require('ip');
const pcap = require('pcap');
const config = require('./config/client.json');

function logWithTs(log) {
	console.log(`[${getCurrentDateTime()}] ${log}`);
}

function getCurrentDateTime() {
	return new Date().toLocaleString("en-US", {timeZone: "America/New_York"});
}

//function getIPAddress() {
//	return ip.address();
//}

function getIPAddress() {
	const interface = config.network.interface;
	if(!interface) {
		logWithTs("interface not found in config file");
	}
	return pcap.findalldevs()
				.filter(entry => entry.name === interface)[0]
				.addresses
				.filter(entry => entry.addr != "")[0]
				.addr;
}