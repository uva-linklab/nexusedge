const discoveryModel = require('../model/discoveryModel');

exports.getSensors = async function(req, res) {
	//return the sensors connected in the last 5 mins
	const sensorData = await discoveryModel.getSensorData(300000);
	return res.json(sensorData);
};