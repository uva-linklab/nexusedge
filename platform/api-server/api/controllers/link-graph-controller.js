const request = require('request-promise');
const Queue = require('queue-fifo');
const utils = require("../../../utils/utils");

/**
 * Generates the link graph by traversing through the entire gateway network one neighbor at a time.
 * For each neighbor
 * @param req express request object
 * @param res express response object
 * @returns {Promise<*>} linkGraph in json response format
 */
exports.getLinkGraphData = async function(req, res) {
	const queue = new Queue();
	const visited = new Set();
	const data = {};
	const graph = {};

	// pick up self's id and ip address and enqueue it first
	const selfDetails = {id: utils.getGatewayId(), ip: utils.getGatewayIp()};

	visited.add(selfDetails.id);
	queue.enqueue(selfDetails);

	while(!queue.isEmpty()) {
		const node = queue.dequeue();

		// request for the neighbor data of a node is an API call made to that node's server
		try {
			const partialLinkGraph = await getPartialLinkGraphData(node.ip);

			data[node.id] = {"ip": node.ip};
			data[node.id]["devices"] = partialLinkGraph["devices"];
			data[node.id]["apps"] = partialLinkGraph["apps"];
			graph[node.id] = partialLinkGraph["neighbors"].map(_ => _.id);

			for(const neighborNode of partialLinkGraph["neighbors"]) {
				const neighborId = neighborNode.id;
				const neighborIPAddress = neighborNode.ip;

				// Add this node to the traversal queue, if is not already traversed.
				// All traversed nodes are added as keys to the graph dictionary. So the key set can be used to check
				// if traversed or not.
				if(!visited.has(neighborId)) {
					visited.add(neighborId);
					queue.enqueue(neighborNode);
				}
			}
		} catch(err) {
			console.log(`${node.id} cannot be reached`);
			// remove this node from all other graph entries
			for (const [graphNode, graphNeighbors] of Object.entries(graph)) {
				graph[graphNode] = graphNeighbors.filter(neighbor => neighbor !== node.id);
			}
		}
	}
	const linkGraph = {"graph": graph, "data": data};
	return res.json(linkGraph);
};

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