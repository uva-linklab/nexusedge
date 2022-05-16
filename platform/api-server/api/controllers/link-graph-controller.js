const request = require('request-promise');
const Queue = require('queue-fifo');
const utils = require("../../../utils/utils");

class Gateway {
	constructor(id, ip, neighbors, devices, apps) {
		this.id = id;
		this.ip = ip;
		this.neighbors = neighbors;
		this.devices = devices;
		this.apps = apps;
	}
}

/**
 * Generates the link graph by traversing through the entire gateway network one neighbor at a time.
 * For each neighbor
 * @param req express request object
 * @param res express response object
 * @returns {Promise<*>} linkGraph in json response format
 */
exports.getLinkGraphData = async function(req, res) {
	const visited = new Set();
	const data = {};
	const graph = {};
	const queue = new Queue(); // queue of Gateways

	// get self's id and ip address
	const selfId = utils.getGatewayId();
	const selfIp = utils.getGatewayIp();

	// get self's partial link graph (neighbors, devices, apps)
	const partialLinkGraph = await getPartialLinkGraphData(selfIp);
	const self = new Gateway(selfId,
		selfIp,
		partialLinkGraph.neighbors,
		partialLinkGraph.devices,
		partialLinkGraph.apps);

	visited.add(self.id);
	queue.enqueue(self);

	while(!queue.isEmpty()) {
		const node = queue.dequeue();

		// request for the neighbor data of a node is an API call made to that node's server
		data[node.id] = {"ip": node.ip};
		data[node.id]["devices"] = partialLinkGraph["devices"];
		data[node.id]["apps"] = partialLinkGraph["apps"];

		for(const neighbor of partialLinkGraph["neighbors"]) {
			const neighborId = neighbor.id;
			const neighborIp = neighbor.ip;

			// Add this node to the traversal queue, if is not already traversed.
			// All traversed nodes are added as keys to the graph dictionary. So the key set can be used to check
			// if traversed or not.
			if(!visited.has(neighborId)) {
				try{
					const partialLinkGraph = await getPartialLinkGraphData(neighborIp);
					// augment additional information about this neighbor
					const neighborGateway = new Gateway(neighborId,
						neighborIp,
						partialLinkGraph.neighbors,
						partialLinkGraph.devices,
						partialLinkGraph.apps);

					// add this neighbor to this node's list of reachable neighbors (the graph)
					if(!node.id in graph) {
						graph[node.id] = [neighborId];
					} else {
						graph[node.id].push(neighborId);
					}

					// queue this neighbor
					queue.enqueue(neighborGateway);
				} catch(e) {
					console.log(`couldn't reach ${neighborId} (${neighborIp}) while generating the link graph. skipping.`);
				} finally {
					// mark the neighbor node as visited, regardless of whether we could reach it or not
					visited.add(neighborId);
				}
			}
		}
	}
	const linkGraph = {"graph": graph, "data": data};
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
 * @returns {Promise<any>} { "neighbors": [{id: xx, ip: yy}, ..], "devices": [], "apps": [] }
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