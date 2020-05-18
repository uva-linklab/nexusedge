//TODO: remove after test. Just to mock a sensor-stream-manager and test interaction with gateway-scanner.
const ipc = require('node-ipc');
const path = require("path");
const WebSocket = require('ws');
const fs = require("fs-extra");
const mqtt = require("mqtt");
const os = require('os');

const serviceName = process.env.SERVICE_NAME;
//TODO move all IPC related logic into a separate file

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
    if(ifname === "wlp0s20f3") {
        gatewayIp = iface.address;
        console.log(`gateway's ip is ${gatewayIp}`);
    }
  });
});

// ipc settings
// Reference:
// http://riaevangelist.github.io/node-ipc/#ipc-config
ipc.config.appspace = "gateway.";
ipc.config.socketRoot = path.normalize(`${__dirname}/../socket/`);
ipc.config.id = serviceName;
ipc.config.retry = 1500;
ipc.config.silent = true;

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

// Connect to platform manager
ipc.connectTo('platform', () => {
    ipc.of.platform.on('connect', () => {
        console.log(`${serviceName} connected to platform`);
        let message = {
            "meta": {
                "sender": serviceName,
            },
            "payload": `${serviceName} sent back the socket.`
        };
        ipc.of.platform.emit("register-socket", message);
    });
    ipc.of.platform.on('disconnect', () => {
        console.log(`${serviceName} disconnected from platform`);
    });
});

//TODO: remove test code

// setTimeout(function () {
//     console.log("send stuff to gateway-scanner");
//     const ipcPayload = {
//         "gateway-ip": "10.0.0.90",
//         "gateway-msg-payload": {
//             "_meta": {
//                 "recipient": "sensor-stream-manager",
//                 "event": "connect-to-socket"
//             },
//             "payload": {
//                 "ws-address": "ws://10.0.0.157:8080"
//             }
//         }
//     };
//     forwardMessage(serviceName, "gateway-scanner", "talk-to-gateway", ipcPayload);
// }, 10000);

/**
 * Forwards message via IPC to the recipient specified. Adds a layer of metadata to the payload with all of the
 * communication details.
 * @param sender service-name of self
 * @param recipient service to which message is to be forwarded
 * @param event the name of the event the recipient should be listening for
 * @param payload contents of the message
 */
function forwardMessage(sender, recipient, event, payload) {
    ipc.of.platform.emit("forward", {
        "meta": {
            "sender": sender,
            "recipient": recipient,
            "event": event
        },
        "payload": payload
    });
}

ipc.of.platform.on('connect-to-socket', message => {
    const payload = message.data;

    const wsAddress = payload["ws-address"];
    const ws = new WebSocket(wsAddress);

    ws.on('open', function open() {
        ws.send('something');
    });

    ws.on('message', function incoming(data) {
        console.log(data);
    });
});

// SSM receives application's process instance and metadata from app-manager
// this listener will store the application's topic and sensor stream requirement
ipc.of.platform.on('app-deployment', message => {
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
        console.log(sensorStream);
    }
});