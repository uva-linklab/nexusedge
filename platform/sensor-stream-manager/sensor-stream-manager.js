const fs = require("fs-extra");
const mqtt = require("mqtt");
const utils = require("../../utils");

// TODO: add mqtt-data-collector logic to SSM.
const MessagingService = require('../messaging-service');

console.log("[INFO] Initialize app-manager...");
const serviceName = process.env.SERVICE_NAME;
const messagingService = new MessagingService(serviceName);

// get gateway's ip
const gatewayIp = utils.getIPAddress();
if(!gatewayIp) {
  console.error("[ERROR] No IP address found. Please ensure the config files are set properly.");
  process.exit(1);
}
console.log(`[INFO] Gateway's ip address is ${gatewayIp}`);


// sensorStream stores the sensor id and application topic mapping
// the key is sensor id and the value is an array of application's topics
// SSM will use sensorStream to push data
// check the example below
// sensorStream = {
//     "sensor1-id": [ '5ec23c4a30802a720dfea97d' ],
//     "sensor2-id": [ '5ec23c4a30802a720dfea97d' ]
// }
const sensorStream = {};

// TODO: policy
const policy = {};

// connect to localhost mqtt broker
const mqttClient = mqtt.connect("mqtt://localhost");
mqttClient.on('connect', () => {
    // subscribe to localhost "gateway-data" topic
    mqttClient.subscribe("gateway-data", (err) => {
        if (err) {
            console.error(`[ERROR] MQTT client failed to subscribe ${mqttTopic}.`);
            console.error(err);
        } else {
            console.log(`[INFO] MQTT client subscribed to "gateway-data" topic successfully!`);
        }
    });
});

// when sensor stream data is published to "gateway-data" topic
// SSM will check policy and publish the data to application's topic
mqttClient.on('message', (topic, message) => {
    const payload = JSON.parse(message.toString());
    const sensorId = payload["_meta"]["device_id"];
    if(sensorId in sensorStream) {
        for(let topic of sensorStream[sensorId]) {
            // TODO: check policy

            // publish to application's topic
            mqttClient.publish(topic, JSON.stringify(payload));
        }
    }
});

messagingService.listenForEvent('connect-to-socket', (message) => {
    const payload = message.data;
    const wsAddress = payload["ws-address"];
});

// SSM receives application's process instance and metadata from app-manager
// this listener will store the application's topic and sensor stream requirement
messagingService.listenForEvent('app-deployment', message => {
    // appData = {
    //     "app": {
    //         "app": newApp, // instance of process,
    //         "pid": newApp.pid,
    //         "_id": appId,
    //         "appPath": newAppPath,
    //         "metadataPath": appData.metadataPath
    //     }
    // };
    let appData = message.data;
    if(appData["app"]) {
        // load application's metadata
        let metadata = fs.readJsonSync(appData["app"]["metadataPath"]);
        metadata = metadata["sensorMapping"];
        let topic = appData["app"]["_id"];
        // store application's sensor stream requirement in sensorStream
        for(let ip in metadata) {
            // store the sensor connected to local gateway
            if(ip === gatewayIp) {
                for(let id of metadata[ip]) {
                    if(id in sensorStream) {
                        sensorStream[id].push(topic);
                    } else {
                        sensorStream[id] = [topic];
                    }
                }
            } else {
                // TODO: send application's topic and sensor stream requirement to target gateway
            }
        }
        console.log(`[INFO] Register application "${topic}" successfully!`);
    }
});