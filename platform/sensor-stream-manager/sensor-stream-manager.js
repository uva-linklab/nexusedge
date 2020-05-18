
const path = require("path");
const fs = require("fs-extra");
const mqtt = require("mqtt");
const os = require('os');

//TODO: add mqtt-data-collector logic to SSM.
const MessagingService = require('../messaging-service');

const serviceName = process.env.SERVICE_NAME;
const messagingService = new MessagingService(serviceName);

// get the gateway's ip address
const ifaces = os.networkInterfaces();
let gatewayIp = undefined;
Object.keys(ifaces).forEach((ifname) => {
  ifaces[ifname].forEach((iface) => {
    if ('IPv4' !== iface.family || iface.internal) {
      // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
      return;
    }
    // the default wifi interface is wlan0 in Artik and RPi 4
    if(ifname === "wlan0") {
        gatewayIp = iface.address;
        console.log(`gateway's ip is ${gatewayIp}`);
    }
  });
});


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
            console.error(`mqtt client subscribe ${mqttTopic} failed.`);
            console.error(err);
        } else {
            console.log(`subscribe to "gateway-data" topic successfully!`);
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
    //         "app": process-instance,
    //         "topic": "app-topic",
    //         "path": "app-path"
    //     },
    //     "metadataPath": "metadata-path"
    // };
    let appData = message.data;
    if(appData["app"] && appData["metadataPath"]) {
        // load application's metadata
        let metadata = fs.readJsonSync(appData["metadataPath"]);
        metadata = metadata["sensorMapping"];
        let topic = appData["app"]["topic"];
        // store application's sensor stream requirement in sensorStream
        for(let ip in metadata) {
            // store the sensor connected to local gateway
            if(ip === gatewayIp) {
                if(Array.isArray(metadata[ip])) {
                    for(let id of metadata[ip]) {
                        if(id in sensorStream) {
                            sensorStream[id].push(topic);
                        } else {
                            sensorStream[id] = [topic];
                        }
                    }
                } else {
                    if(metadata[ip] in sensorStream) {
                        sensorStream[metadata[ip]].push(topic);
                    } else {
                        sensorStream[metadata[ip]] = [topic];
                    }
                }
            } else {
                // TODO: send application's topic and sensor stream requirement to target gateway
            }
        }
        console.log(`register application '${topic}' successfully!`);
    }
});