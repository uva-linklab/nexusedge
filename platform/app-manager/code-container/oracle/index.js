const mqtt = require("mqtt");
const fetch = require('node-fetch');

let applicationTopic = undefined; // this is obtained from app-manager as an environment variable
let platformApiTopic = 'platform-data'; // this topic is used for disseminate and query apis

let selfDetails = undefined;
const callbackMap = {};

function __initialize() {
    applicationTopic = process.env.TOPIC; // receive the application's topic as an environment variable

    const mqttClient = mqtt.connect("mqtt://localhost");
    mqttClient.on('connect', () => {
        subscribeToMqttTopic(mqttClient, applicationTopic);
        subscribeToMqttTopic(mqttClient, platformApiTopic);
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
    if(!applicationTopic) {
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

exports.disseminateAll = function(tag, data) {
    getIPAddress().then(ipAddress => {
        const metadata = {
            "origin-address": ipAddress,
            "api": "disseminate-all",
            "tag": tag
        };
        const fullData = {"_meta": metadata, "data": data};
        sendPostRequest(`http://localhost:5000/platform/disseminate-all`, fullData);
    });
};

exports.queryAll = function(tag, replyTag, data) {
    getIPAddress().then(ipAddress => {
        const metadata = {
            "origin-address": ipAddress,
            "api": "query-all",
            "tag": tag,
            "reply-tag": replyTag
        };
        const fullData = {"_meta": metadata, "data": data};
        sendPostRequest(`http://localhost:5000/platform/query-all`, fullData);
    });
};

function subscribeToMqttTopic(mqttClient, topic) {
    mqttClient.subscribe(topic, (err) => {
        if (err) {
            console.error(`[oracle] MQTT client failed to subscribe "${topic}".`);
            console.error(err);
        } else {
            console.log(`[oracle] MQTT client subscribed "${topic}" successfully.`)
        }
    });
}

function sendGetRequest(url) {
    return fetch(url, {
        method: 'GET'
    });
}

function sendPostRequest(url, data) {
    fetch(url, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {'Content-Type': 'application/json'},
        timeout: 5000
    }).then(res => {
        if(res.status === 200) {
            console.log(`[oracle] Request to ${url} completed successfully!`);
        } else {
            console.log(`[oracle] Request to ${url} failed. HTTP status code = ${res.status}`);
        }
    }).catch(err => {
        console.error(`[oracle] Failed request for url ${url}.`);
        console.error(err);
    });
}

module.exports.getIPAddress = function() {
    return new Promise((resolve, reject)  => {
        if(!selfDetails) {
            sendGetRequest('http://localhost:5000/gateway/self-details')
                .then(response => {
                    if(response.status === 200) {
                        resolve(response.body.IP_address);
                    } else {
                        reject(`Received jabaa`);
                    }
                });
        } else {
            resolve(selfDetails.IP_address);
        }
    })
};