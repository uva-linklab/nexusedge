const mqtt = require("mqtt");

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

exports.register = function(sensorId, callback) {
    if(!mqttTopic) {
        __initialize();
    }
    callbackMap[sensorId] = callback;
    console.log(`added callback for ${sensorId}`);
};