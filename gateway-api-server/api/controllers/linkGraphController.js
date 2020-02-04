const request = require('request-promise');
var Queue = require('queue-fifo');
var queue = new Queue();

var neighborDataController = require("./neighborDataController");
var sensorDataController = require("./sensorDataController");

const MongoClient = require('mongodb').MongoClient;
const mongo_url = 'mongodb://localhost:27017';

/**
 * Generates the link graph by traversing through the entire gateway network one neighbor at a time.
 * For each neighbor
 * @param req express request object
 * @param res express response object
 * @returns {Promise<*>} linkGraph in json response format
 */
exports.getLinkGraphData = async function(req, res) {
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

	const linkGraph = {"graph": neighborsDict, "data": dataDict};
	return res.json(linkGraph);
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
	const body = await request({method: 'GET', uri: execUrl});
	return JSON.parse(body);
}

async function getSelfDetails() {
	const conn = await MongoClient.connect(mongo_url, { useNewUrlParser: true });
	const db = await conn.db("discovery");
	const selfDetails = await db.collection('self')
						.findOne({},{"timestamp":0});
	return selfDetails;
}

var utils = require("../../../utils");

/**
 * Renders a vis.js based visualization for the link graph data. Uses a nunjucks template stored in templates/ for the
 * render.
 * @param req
 * @param res
 */
exports.getLinkGraphVisual = function(req, res) {
	//TODO: this should be done in a different way!
	const ipAddress = utils.getIPAddress();
	const data = {
		'ip_address': ipAddress
	};
	res.render('linkGraph.html', data);
};