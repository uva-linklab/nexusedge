var Queue = require('queue-fifo');
var queue = new Queue();

function getPartialLinkGraph(node) {
	if(node == "A")
		return ["B","C","D"];
	else if(node == "B")
		return ["A","D"];
	else if(node == "C")
		return ["A","E"];
	else if(node == "D")
		return ["A","B"];
	else if(node == "E")
		return ["C"];
}

const start_node = "E";
var neighbors_dict = {};

queue.enqueue(start_node);

while(!queue.isEmpty()) {
	var node = queue.dequeue();
	var neighbors = getPartialLinkGraph(node);
	neighbors_dict[node] = neighbors;
	for(var i = 0; i < neighbors.length; i++) {
		if(!(neighbors[i] in neighbors_dict))
			queue.enqueue(neighbors[i]);
	}
}
console.log(neighbors_dict);