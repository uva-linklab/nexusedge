const fs = require("fs-extra");
const mqtt = require("mqtt");
const utils = require("../../utils");
const fetch = require('node-fetch');

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
//     "sensor1-id": {
//         "gateway1-ip": [ "app1-topic", "app2-topic" ],
//         "geteway2-ip": [ "app3-topic"]
//     },
//     "sensor2-id": {
//         "gateway1-ip": [ "app1-topic" ],
//         "geteway2-ip": [ "app3-topic"]
//     }
// }
const sensorStream = {};

// TODO: policy
const policy = {};

// mqttClients = {
//     "gateway-ip": client
// }
const mqttClients = {};

function publishData(ip, topic, data) {
    if(!mqttClients[ip]) {
        console.error(`[ERROR] ${ip} has not been registered.`);
        return;
    }
    const client = mqttClients[ip];
    client.publish(topic, data, {}, err => {
        if(err) {
            console.error(`[ERROR] Failed to publish to ${ip}.`);
            console.error(err);
        }
    });
}

function connectToMQTTBroker(ip, mqttTopic) {
    const url = `mqtt://${ip}`;
    const client = mqtt.connect(url);
    // connect to mqtt broker
    client.on('connect', () => {
        // subscribe to mqtt topic
        if(typeof mqttTopic != "undefined") {
            client.subscribe(mqttTopic, (err) => {
                if (err) {
                    console.error(`[ERROR] MQTT client failed to subscribe "${mqttTopic}".`);
                    console.error(err);
                } else {
                    console.log(`[INFO] MQTT client subscribed to "${mqttTopic}" topic successfully!`);
                }
            });
            // when sensor stream data is published to "gateway-data" topic
            // SSM will check policy and publish the data to application's topic
            client.on('message', (topic, message) => {
                const payload = JSON.parse(message.toString());
                const sensorId = payload["_meta"]["device_id"];
                if(sensorId in sensorStream) {
                    for(const gatewayIp in sensorStream[sensorId]) {
                        const topics = sensorStream[sensorId][gatewayIp];
                        for(const topic of topics) {
                            // TODO: check policy

                            // publish to application's topic
                            publishData(gatewayIp, topic, JSON.stringify(payload));
                        }
                    }
                }
            });
        }
        console.log(`[INFO] Connected to ${ip} successfully`);
    });
    return client;
}

const localMQTTClient = connectToMQTTBroker("localhost", "gateway-data");
mqttClients[gatewayIp] = localMQTTClient;

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
    const appData = message.data;
    if(appData["app"]) {
        // load application's metadata
        let metadata = fs.readJsonSync(appData["app"]["metadataPath"]);
        metadata = metadata["sensorMapping"];
        const topic = appData["app"]["_id"];
        // store application's sensor stream requirement in sensorStream
        for(const ip in metadata) {
            const sensorIds = metadata[ip];
            // store the sensor connected to local gateway
            if(ip === gatewayIp) {
                for(const id of sensorIds) {
                    if(!sensorStream[id]) {
                        sensorStream[id] = {};
                    }
                    if(!sensorStream[id][ip]) {
                        sensorStream[id][ip] = [];
                    }
                    sensorStream[id][ip].push(topic);
                }
            } else {
                const gatewayUrl = `http://${ip}:5000/gateway/register-app-sensor-reqruirement`;
                fetch(gatewayUrl, {
                    method: 'POST',
                    body: {
                        "topic": topic,
                        "ip": gatewayIp,
                        "sensors": sensorIds
                    },
                    timeout: 5000
                }).catch(err => {
                    console.error(`[ERROR] Failed to send "${topic} to ${ip}.`);
                    console.error(err);
                });
            }
        }
        console.log(`[INFO] Register application "${topic}" successfully!`);
    }
});

messagingService.listenForEvent("register-topic", message => {
    // appData = {
    //     "app": {
    //         "topic": topic,
    //         "ip": ip,
    //         "sensors": sensorIds
    //     }
    // }
    const appData = message.data;
    if(appData["app"]) {
        const sensorIds = appData["app"]["sensors"];
        const topic = appData["app"]["topic"];
        for(const id of sensorIds) {
            if(id in sensorStream) {
                sensorStream[id].push(topic);
            } else {
                sensorStream[id] = [topic];
            }
        }
    }
})