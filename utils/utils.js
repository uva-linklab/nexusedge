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

	//regex to exclude ipv6 addresses and only capture ipv4 addresses. This doesn't ensure that the ipv4 octets are 0-255 but this would suffice. All we need is to exclude ipv6 addresses. 
	const regex = /^\d+\.\d+\.\d+\.\d+$/;
	return pcap.findalldevs()
				.find(elem => elem.name === interface)
				.addresses
				.find(addrElem => addrElem && regex.test(addrElem.addr))
				.addr;
}