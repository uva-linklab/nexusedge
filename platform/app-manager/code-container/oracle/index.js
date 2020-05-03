const fs = require("fs-extra");
const path = require("path");
const mqtt = require("mqtt");

let mqttTopic = undefined;
let callbackMap = {};

function __initialize() {
	const metadataFilePath = path.join(__dirname, '../metadata.json');
	// TODO: The topic will be customized after the sensor-stream-manager is completed.
	// mqttTopic = process.env.TOPIC;
	mqttTopic = 'gateway-data';

	//check if the metadata file is present in local directory
	if (!fs.existsSync(metadataFilePath)){
		console.error("no metadata file in execution directory");
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
	for(let i = 0; i < mqttClients.length; i++) {
		const client = mqttClients[i];
		const gatewayIP = gateways[i];
		const sensorIds = mapping[gatewayIP];

		client.on('connect', () => {
			client.subscribe(mqttTopic);
		  console.log(`subbed to mqtt topic gateway-data at ${client.options.host}`);
		});

		client.on('message', (topic, message) => {
		  if(topic === mqttTopic) {
		  		let data = JSON.parse(message.toString());
		  		let sensorId = data["_meta"]["device_id"];
		  		if(sensorIds.includes(sensorId)) {
		  			callbackMap[sensorId](data);
				}
			}
		});
	}
}

exports.register = function(sensorId, callback) {
	if(!mqttTopic) {
		__initialize();
	}
	callbackMap[sensorId] = callback;
	console.log(`added callback for ${sensorId}`);
};