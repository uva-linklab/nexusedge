const discoveryModel = require('../model/discoveryModel');

exports.getNeighbors = async function(req, res) {
	//return the neighbors connected in the last 5 mins
	const neighborData = await discoveryModel.getNeighborData(300000);
	return res.json(neighborData);
};