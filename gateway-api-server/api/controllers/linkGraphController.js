const request = require('request-promise');
var Queue = require('queue-fifo');
var queue = new Queue();

var neighborDataController = require("./neighborDataController");
var sensorDataController = require("./sensorDataController");

const MongoClient = require('mongodb').MongoClient;
const mongo_url = 'mongodb://localhost:27017';

exports.getLinkGraphData = async function() {
	//pick up self's id and ip address from mongo
	const self_details = await getSelfDetails();
	var neighborsDict = {};
	var dataDict = {};

	queue.enqueue({_id: self_details._id, IP_address: self_details.IP_address});

	while(!queue.isEmpty()) {
		const node = queue.dequeue();
		var neighborsOfNode = [];
		
		dataDict[node._id] = {"ip": node.IP_address};
		const neighbors = await getNeighborData(node.IP_address);

		neighbors.forEach(neighborNode => {
			const neighborId = neighborNode._id;
			neighborsOfNode.push(neighborId);
			if(!(Object.keys(neighborsDict).includes(neighborId))) {
				queue.enqueue(neighborNode)
			}
		});
		neighborsDict[node._id] = neighborsOfNode;
	}

	for(const entry of Object.entries(dataDict)) {
		const node = entry[0];
		const ip = entry[1].ip;

		dataDict[node]["sensors"] = await getSensorData(ip);
	}

	return {"graph": neighborsDict, "data": dataDict};
};


/**
 * Uses the gateway API to query for the sensors connected to a given gateway
 * @param gatewayIP IP address of the gateway
 * @returns {Promise<any>}
 */
async function getSensorData(gatewayIP) {
	const execUrl = `http://${gatewayIP}:5000/sensors`;
	const body = await request({method: 'GET', uri: execUrl})
	return JSON.parse(body);
}

/**
 * Uses the gateway API to query for the neighbors of a given gateway
 * @param gatewayIP IP address of the gateway
 * @returns {Promise<any>} promise of a list of list of gateway_name and gateway_IP
 */
async function getNeighborData(gatewayIP) {
	const execUrl = `http://${gatewayIP}:5000/neighbors`;
	const body = await request({method: 'GET', uri: execUrl})
	return JSON.parse(body);

    // var response = [];
    // if(ip === "localhost") {
    // 	const appId = await getPartialLinkGraphAppId(ip);
    // 	const execUrl = `http://${ip}:5000/execute/${appId}`;
    // 	const body = await request({method: 'GET', uri: execUrl})
    // 	response = JSON.parse(body);
    // 	// response = [ { _id: 'A', IP_address: '192.168.0.1' }, { _id: 'X', IP_address: '192.168.0.3' } ]
    // } else if(ip === "192.168.0.1") {
    // 	response = [ { _id: 'B', IP_address: '192.168.0.2' } ]
    // } else if(ip === '192.168.0.2') {
    // 	response = [ { _id: 'A', IP_address: '192.168.0.1' } ]
    // } else if(ip === '172.168.0.3') {
    // 	response = [ { _id: 'this', IP_address: 'localhost' } ]
    // }
    // return response;
}

async function getSelfDetails() {
	const conn = await MongoClient.connect(mongo_url, { useNewUrlParser: true });
	const db = await conn.db("discovery");
	const selfDetails = await db.collection('self')
						.findOne({},{"timestamp":0});
	return selfDetails;
}

var utils = require("../../../utils");

exports.getLinkGraphVisual = function(req, res) {

	//TODO: this should be done in a different way!
	const ip_address = utils.getIPAddress();
	const data = {
		'ip_address': ip_address
	};
	res.render('linkGraph.html', data);
};