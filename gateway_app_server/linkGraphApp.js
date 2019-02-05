const request = require('request-promise');
var Queue = require('queue-fifo');
var queue = new Queue();

module.exports.getLinkGraph = getLinkGraph;
'use strict';

const MongoClient = require('mongodb').MongoClient;
const mongo_url = 'mongodb://localhost:27017';

async function getLinkGraph() {

	//pick up self's id and ip address from mongo
	const self_details = await getSelfDetails();
	console.log(`self = ${self_details._id}, ${self_details.IP_address}`);
	var neighbors_dict = {};
	var data_dict = {};

	queue.enqueue({_id: self_details._id, IP_address: self_details.IP_address});

	while(!queue.isEmpty()) {
		const node = queue.dequeue();
		var neighbors_of_node = [];
		
		data_dict[node._id] = {"ip": node.IP_address};
		const plg = await getPartialLinkGraph(node.IP_address);
		
		plg.forEach(neighbor_node => {
			const neighbor_node_id = neighbor_node._id;
			neighbors_of_node.push(neighbor_node_id);
			if(!(Object.keys(neighbors_dict).includes(neighbor_node_id))) {
				queue.enqueue(neighbor_node)
			}
		});
		neighbors_dict[node._id] = neighbors_of_node;
	}
	const linkGraph = {"graph": neighbors_dict, "data": data_dict};
	return linkGraph;
}

//TODO: cache the app if for the ip addresses
function getPartialLinkGraphAppId(ip) {
	const appsUrl = `http://${ip}:5000/apps`;
	return request({method: 'GET', uri: appsUrl})
		.then(body => {
			return JSON.parse(body)
				.filter(app => app.app_name === "partialLinkGraph")[0].app_id;
		});
}

//returns a promise of a list of list of gateway_name and gateway_IP
async function getPartialLinkGraph(ip) {
	
    var response = [];
    if(ip === "localhost") {
    	const appId = await getPartialLinkGraphAppId(ip);
    	const execUrl = `http://${ip}:5000/execute/${appId}`;
    	const body = await request({method: 'GET', uri: execUrl})
    	response = JSON.parse(body);
    	// response = [ { _id: 'A', IP_address: '192.168.0.1' }, { _id: 'X', IP_address: '192.168.0.3' } ]
    } else if(ip === "192.168.0.1") {
    	response = [ { _id: 'B', IP_address: '192.168.0.2' } ]
    } else if(ip === '192.168.0.2') {
    	response = [ { _id: 'A', IP_address: '192.168.0.1' } ]
    } else if(ip === '172.168.0.3') {
    	response = [ { _id: 'this', IP_address: 'localhost' } ]
    }
    return response;
}

async function getSelfDetails() {
	const conn = await MongoClient.connect(mongo_url, { useNewUrlParser: true });
	const db = await conn.db("discovery");
	const self_details = await db.collection('self')
						.findOne({})
						.project({"timestamp":0});
	return self_details;
}