module.exports.register = register;
const fs = require("fs");
const path = require("path");
const mqtt = require("mqtt");

const mqttTopic = 'gateway-data';
var callbackMap = {};
var initialized = false;

function __initialize() {
	const metadataFilePath = path.join(__dirname, '../metadata.json');

	//check if the metadata file is present in local directory
	if (!fs.existsSync(metadataFilePath)){
		console.log("no metadata file in execution directory");
	 	process.exit(1);
	}

	//read the metadata into an object
	const rawData = fs.readFileSync(metadataFilePath);
	const metadata = JSON.parse(rawData);
	const mapping = metadata["sensorMapping"];

	//subscribe to mqtt
	const gateways = Object.keys(mapping);
	const mqttClients = gateways.map(gatewayIP => {
		return mqtt.connect('mqtt://' + gatewayIP);
	});
	for(var i=0; i<mqttClients.length; i++) {
		const client = mqttClients[i];
		const gatewayIP = gateways[i];
		const sensorIds = mapping[gatewayIP];

		client.on('connect', () => {
			client.subscribe(mqttTopic);
		  console.log(`subbed to mqtt topic gateway-data at ${client.options.host}`);
		});

		client.on('message', (topic, message) => {
		  if(topic === mqttTopic) {
		  		var data = JSON.parse(message.toString());
		  		var sensorId = data["_meta"]["device_id"];
		  		if(sensorIds.includes(sensorId)) {
		  			callbackMap[sensorId](data);
				}
			}
		});
	}
	initialized = true;		
}

exports.register = function(sensorId, callback) {
	if(!initialized) {
		__initialize();
	}
	callbackMap[sensorId] = callback;
	console.log(`added callback for ${sensorId}`);
};