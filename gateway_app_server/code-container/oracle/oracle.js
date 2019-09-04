module.exports.register = register;
var callbackMap = {}
var initialized = false;

const fs = require("fs");
const mqtt = require("mqtt");

function __initialize() {
	const metadataFilePath = "./metadata.json";
	console.log(metadataFilePath);

	//check if the metadata file is present in local directory
	if (!fs.existsSync(metadataFilePath)){
		console.log("no metadata file in execution directory");
	 	process.exit(1);
	}

	//read the metadata into an object
	rawdata = fs.readFileSync(metadataFilePath);
	metadata = JSON.parse(rawdata);
	const mapping = metadata["sensorMapping"];

	//subscribe to mqtt
	const gateways = Object.keys(mapping);
	console.log(gateways);
	const mqttClients = gateways.map(gatewayIP => {
		return mqtt.connect('mqtt://' + gatewayIP);
	});
	for(var i=0; i<mqttClients.length; i++) {
		const client = mqttClients[i];
		const gatewayIP = gateways[i];
		const sensorIds = mapping[gatewayIP];

		client.on('connect', () => {
		  client.subscribe('gateway-data');
		  console.log(`client ${client.options.host} subbed to gateway-data`);
		});

		client.on('message', (topic, message) => {
		  if(topic === 'gateway-data') {
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

function register(sensorId, callback) {
	console.log(initialized);
	if(!initialized) {
		__initialize();
	}
	callbackMap[sensorId] = callback;
	console.log(`added callback for ${sensorId}`);
}