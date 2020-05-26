const mqtt = require("mqtt");
const request = require('request-promise');

let mqttTopic = undefined;
const callbackMap = {};

function __initialize() {
    mqttTopic = process.env.TOPIC;

    // connect to mqtt broker
    const mqttClient = mqtt.connect("mqtt://localhost");
    mqttClient.on('connect', () => {
        // subscribe to application's topic
        mqttClient.subscribe(mqttTopic, (err) => {
            if (err) {
                console.error(`[ERROR] MQTT client failed to subscribe "${mqttTopic}".`);
                console.error(err);
            } else {
                console.log(`[INFO] MQTT client subscribed "${mqttTopic}" succesfully.`)
            }
        });
    });

    // if a new data is published in the topic,
    // oracle wil check if the application listens to the topic or not
    // if so, oracle will send the payload to the callback function
    mqttClient.on('message', (topic, message) => {
        const payload = JSON.parse(message.toString());
        const sensorId = payload["_meta"]["device_id"];
        if(sensorId in callbackMap) {
            callbackMap[sensorId](payload);
        }
    });
}

exports.receive = function(sensorId, callback) {
    if(!mqttTopic) {
        __initialize();
    }
    callbackMap[sensorId] = callback;
    console.log(`added callback for ${sensorId}`);
};

exports.send = function(deviceId, data) {
    const execUrl = `http://localhost:5000/gateway/talk-to-manager`;
    const talkToManagerData = {
        "_meta" : {
            "recipient": "ble-controller",
            "event": "send-to-device"
        },
        "payload": {
            "device-id": deviceId,
            "send-api-data": data
        }
    };
    sendPostRequest(execUrl, talkToManagerData);
};

function sendPostRequest(url, data) {
    const options = {
        method: 'POST',
        uri: url,
        body: data,
        json: true // Automatically stringifies the body to JSON
    };
    request(options);
}