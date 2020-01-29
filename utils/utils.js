module.exports.getIPAddress = getIPAddress;

const pcap = require('pcap');
const config = require('./config.json');

function getIPAddress() {
	const interface = config.network.interface;
	if(!interface) {
		console.log("interface not found in config file");
	}

	//regex to exclude ipv6 addresses and only capture ipv4 addresses. This doesn't ensure that the ipv4 octets are 0-255 but this would suffice. All we need is to exclude ipv6 addresses. 
	const regex = /^\d+\.\d+\.\d+\.\d+$/;
	return pcap.findalldevs()
				.find(elem => elem.name === interface)
				.addresses
				.find(addrElem => addrElem && regex.test(addrElem.addr))
				.addr;
}