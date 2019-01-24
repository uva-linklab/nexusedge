const request = require('request');
var Queue = require('queue-fifo');
var queue = new Queue();

module.exports.getLinkGraph = getLinkGraph;
'use strict';

function getLinkGraph(gateway_name, gateway_ip) {
	var neighbors_dict = {};
	var ip_dict = {}
	queue.enqueue(gateway_name);

	while(!queue.isEmpty()) {
		var node = queue.dequeue();
		getPartialLinkGraph(gateway_ip, function (neighbors) {
			neighbors_dict[node] = neighbors;
			for(var i = 0; i < neighbors.length; i++) {
				if(!(neighbors[i] in neighbors_dict))
					queue.enqueue(neighbors[i]);
			}
			console.log(neighbors_dict);
		});
	}
}

function getPartialLinkGraphAppId(ip, callback) {
	const appsUrl = `http://${ip}:5000/apps`;
	request({method: 'GET', uri: appsUrl}, function (error, response, body) {
      var apps = JSON.parse(body);
      var appId = "";
      for(var i=0; i<apps.length; i++) {
      	// console.log(apps[i]);
      	if(apps[i].app_name === "partialLinkGraph") {
      		appId = apps[i].app_id;
      		break;
      	}
      }
      // console.log(appId);
      callback(appId);
    });
}

function getPartialLinkGraph(ip, callback) {
	getPartialLinkGraphAppId(ip, function(appId) {
		console.log(appId);
		const execUrl = `http://${ip}:5000/execute/${appId}`;
		console.log(execUrl);
		request({method: 'GET', uri: execUrl}, function (error, response, body) {
	      var partialLinkGraph = JSON.parse(body);
	      console.log(partialLinkGraph);
	      var neighbors = [];
	      for(var i=0; i<partialLinkGraph.length; i++) {
	      	neighbors.push(partialLinkGraph[i].gatewayName);
	      }
	      callback(neighbors);
	    });
	});
}

getLinkGraph("X", "192.168.0.3");