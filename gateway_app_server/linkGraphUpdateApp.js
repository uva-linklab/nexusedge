module.exports.updateLinkGraph = updateLinkGraph;
'use strict';
const request = require('request-promise');
const MongoClient = require('mongodb').MongoClient;

const mongo_url = 'mongodb://localhost:27017';
const dbName = 'discovery';

// //returns a promise object for a partial link graph
// function getPartialLinkGraph() {
// 	console.log(`looking for time > ${Date.now() - 900000}`)
// 	return MongoClient.connect(mongo_url)
// 		.then(conn => {
// 			return conn.db(dbName)
// 				.collection('partial_link_graph')
// 				// .find({ts: {$gt: Date.now() - 900000}}) //devices present in the last 15mins
// 				.find({})
// 				.toArray()
// 		});
// }

function updateLinkGraph(node, linkGraph) {
	const lgCollection = 'linkGraph';
	MongoClient.connect(mongo_url)
		.then(conn => {
			conn.db(dbName)
				.collection(lgCollection)
				.findOne({})
				.then(document => {
					const id = document._id;
					const currentLinkGraph = document.linkGraph;
					console.log(id);

					// const linkGraph = addSelfToGraph(linkGraph);
					console.log(currentLinkGraph);
					console.log(linkGraph);
					
					if(!isLinkGraphEqual(currentLinkGraph, linkGraph)) {
						//add the new linkGraph to DB
						conn.db(dbName)
							.collection(lgCollection)
							.updateOne(
							  { "_id" : id },
						      { $set: { "linkGraph" : linkGraph} }, 
						      { upsert: true });
						//send http post requests
						//get all the neighbors and their ips
						//send requests
						const graph = linkGraph.graph;
						const data = linkGraph.data;

						// graph.
					}
				}); 
		});
}

function isLinkGraphEqual(lg1, lg2) {
	const lg1Graph = lg1.graph;
	const lg2Graph = lg2.graph;

	const lg1Data = lg1.data;
	const lg2Data = lg2.data;

	//check if both the graphs have same nodes
	const lg1Nodes = Object.keys(lg1.graph);
	const lg2Nodes = Object.keys(lg2.graph);

	if(!isEqual(lg1Nodes,lg2Nodes))
		return false;

	//check if neighbors and IP address of corresponding nodes are same
	for(var i=0;i<lg1Nodes.length;i++) {
		const node1 = lg1Nodes[i];
		const node2 = lg2Nodes[i];
		
		const neighborsArr1 = lg1Graph[node1];
		const neighborsArr2 = lg2Graph[node2];

		if(!isEqual(neighborsArr1, neighborsArr2)) 
			return false;

		const ipAddress1 = lg1Data[node1]["IP"];
		const ipAddress2 = lg2Data[node2]["IP"];

		if(ipAddress1 != ipAddress2)
			return false;
	}
	return true;
}

function isEqual(arr1, arr2) {
	if(arr1.length != arr2.length)
		return false;

	const arr1Sorted = arr1.sort();
	const arr2Sorted = arr2.sort();

	for(var i=0;i<arr1.length;i++) {
		if(arr1Sorted[i] != arr2Sorted[i])
			return false;
	}
	return true;
}

const x = { graph: { A: [ 'B', 'C' ], B: [ 'C' ], C: [ 'B' ] },
  data: 
   { A: { IP: '192.168.0.4' },
     B: { IP: '192.168.0.2' },
     C: { IP: '192.168.0.3' } } }

// updateLinkGraph("A",x);
// console.log(isLinkGraphEqual(x,y));