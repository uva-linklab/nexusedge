module.exports.getGatewayStatus = getGatewayStatus;
'use strict';

function getGatewayStatus() {
	const
	    { spawnSync } = require( 'child_process' ),
	    uptime = spawnSync( 'uptime' ),
		packetsSent = spawnSync( 'cat', ['/sys/class/net/wlan0/statistics/rx_packets']),
		packetsRcv = spawnSync( 'cat', ['/sys/class/net/wlan0/statistics/tx_packets']);

	var data={}
	if(uptime.status == 0)
		data["uptime"] = uptime.stdout.toString().trim();

	if(packetsSent.status == 0)
		data["packetsSent"] = parseInt(packetsSent.stdout.toString());

	if(packetsRcv.status == 0)
		data["packetsRcv"] = parseInt(packetsRcv.stdout.toString());

	var status = {"uptime": !uptime.status, "packetsSent": !packetsSent.status, "packetsRcv": !packetsRcv.status};

	var response = {};
	response["status"] = status;
	response["data"] = data;
	return response;
}