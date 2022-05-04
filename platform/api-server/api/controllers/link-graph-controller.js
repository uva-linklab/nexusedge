const request = require('request-promise');
const Queue = require('queue-fifo');
const utils = require("../../../utils/utils");
const queue = new Queue();

/**
 * Generates the link graph by traversing through the entire gateway network one neighbor at a time.
 * For each neighbor
 * @param req express request object
 * @param res express response object
 * @returns {Promise<*>} linkGraph in json response format
 */
exports.getLinkGraphData = async function(req, res) {
	console.time("linkgraph");
	const visited = new Set();
	const data = {};
	const graph = {};

	// pick up self's id and ip address and enqueue it first
	console.time("time for utils.getGatewayId() & utils.getGatewayIp()");
	const selfDetails = {id: utils.getGatewayId(), ip: utils.getGatewayIp()};
	console.timeEnd("time for utils.getGatewayId() & utils.getGatewayIp()");

	visited.add(selfDetails.id);
	queue.enqueue(selfDetails);

	console.time("while loop");
	while(!queue.isEmpty()) {
		const node = queue.dequeue();
		const neighborsOfNode = [];

		console.log(`dequeued ${node.id}`);

		// request for the neighbor data of a node is an API call made to that node's server
		console.time(`getNeighborData(${node.id})`);
		// TODO remove if node is unreachable
		const neighbors = await getPartialLinkGraphData(node.ip);
		console.timeEnd(`getNeighborData(${node.id})`);

		for(const neighborNode of neighbors) {
			const neighborId = neighborNode.id;
			const neighborIPAddress = neighborNode.ip;

			// Add this node to the traversal queue, if is not already traversed.
			// All traversed nodes are added as keys to the graph dictionary. So the key set can be used to check
			// if traversed or not.
			if(!visited.has(neighborId)) {
				visited.add(neighborId);
				queue.enqueue(neighborNode);
			}

			// add this to the neighbor list of current node
			neighborsOfNode.push(neighborId);
		}
		data[node.id] = {"ip": node.ip};
		graph[node.id] = neighborsOfNode;
	}
	console.timeEnd("while loop");

	for(const entry of Object.entries(data)) {
		const node = entry[0];
		const ip = entry[1].ip;

		console.time(`getDevices(${ip})`);
		data[node]["devices"] = await getDevices(ip);
		console.timeEnd(`getDevices(${ip})`);

		console.time(`getApps(${ip})`);
		data[node]["apps"] = await getApps(ip);
		console.timeEnd(`getApps(${ip})`);
	}

	const linkGraph = {"graph": graph, "data": data};
	console.timeEnd("linkgraph");
	return res.json(linkGraph);
};

async function isGatewayReachable(gatewayIP) {
	const execUrl = `http://${gatewayIP}:5000/gateway/status`;
	try {
		const body = await request({method: 'GET', uri: execUrl, timeout: 5000});
		const statusData = JSON.parse(body);
		return statusData["status"];
	} catch(e) {
		return false;
	}
}

/**
 * Uses the gateway API to query for the devices connected to a given gateway
 * @param gatewayIP IP address of the gateway
 * @returns {Promise<any>}
 */
async function getDevices(gatewayIP) {
	const execUrl = `http://${gatewayIP}:5000/gateway/devices`;
	const body = await request({method: 'GET', uri: execUrl});
	return JSON.parse(body);
}

/**
 * Uses the gateway API to query for the apps running on a given gateway
 * @param gatewayIP IP address of the gateway
 * @returns {Promise<any>}
 */
async function getApps(gatewayIP) {
	const execUrl = `http://${gatewayIP}:5000/gateway/apps`;
	const body = await request({method: 'GET', uri: execUrl});
	return JSON.parse(body);
}

/**
 * Uses the gateway API to query partial data for the link graph from a gateway
 * @param gatewayIP IP address of the gateway
 * @returns {Promise<any>} promise of a list of list of gateway_name and gateway_IP
 */
async function getPartialLinkGraphData(gatewayIP) {
	const execUrl = `http://${gatewayIP}:5000/gateway/link-graph-data`;
	const body = await request({method: 'GET', uri: execUrl});
	return JSON.parse(body);
}

/**
 * Renders a vis.js based visualization for the link graph data. Uses a nunjucks template stored in templates/ for the
 * render.
 * @param req
 * @param res
 */
exports.renderLinkGraph = async function(req, res) {
	//pick up self's ip address from utils rather than self db collection to save a db lookup.
	const ipAddress = utils.getGatewayIp();
	const data = {
		'ip_address': ipAddress
	};
	res.render('linkGraph.html', data);
};