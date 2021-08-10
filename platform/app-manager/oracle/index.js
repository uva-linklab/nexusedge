const EventEmitter = require('events');
const MqttController = require('./mqtt-controller');
const mqttController = MqttController.getInstance();
const httpUtils = require('./http-utils');

let gatewayDetails = undefined;

const deviceIdCallbackMap = {};
const deviceTypeCallbackMap = {};

class Oracle extends EventEmitter {
    constructor() {
        super();
        // this topic is used for disseminate and query apis
        const platformApiTopic = 'platform-data';

        // this topic is used for receiving the application's data streams
        // the topic name is received as an environment variable
        const applicationTopic = process.env.APP_DATA_TOPIC;

        if(!applicationTopic) {
            console.error("Application did not receive a topic from App Manager. Exiting.");
            process.exit(1);
        }

        // if new data is published in the topic for the app, oracle will provide this data based on how the app
        // requested for the data (specific deviceId, deviceType, or any device)
        mqttController.subscribe("localhost", applicationTopic, message => {
            const messageJson = JSON.parse(message.toString());
            const deviceId = messageJson['device_id'];
            const deviceType = messageJson['device_type'];

            if(deviceId in deviceIdCallbackMap) {
                deviceIdCallbackMap[deviceId](messageJson);
            }
            if(deviceType in deviceTypeCallbackMap) {
                deviceTypeCallbackMap[deviceType](messageJson);
            }
        });

        // if we receive any query or disseminate messages, emit them
        mqttController.subscribe("localhost", platformApiTopic, message => {
            const messageJson = JSON.parse(message.toString());
            const api = messageJson._meta.api;
            const tag = messageJson._meta.tag;
            this.emit(api, tag, messageJson);
        });
    }

    /**
     * Receive a callback when there's new data available for a specific device
     * @param deviceId id of the device of interest
     * @param callback
     */
    receive(deviceId, callback) {
        if(typeof callback === 'function') {
            deviceIdCallbackMap[deviceId] = callback;
            console.log(`[oracle] added callback for ${deviceId}`);
        } else {
            throw Error('callback not a function');
        }
    };

    /**
     * Receive a callback when there's new data available for any device of a specified type (for instance: "powerMeter")
     * @param deviceType the type of the devices of interest
     * @param callback
     */
    receiveType(deviceType, callback) {
        if(typeof callback === 'function') {
            deviceTypeCallbackMap[deviceType] = callback;
            console.log(`[oracle] added callback for ${deviceType}`);
        } else {
            throw Error('callback not a function');
        }
    }

    send(deviceId, data) {
        const execUrl = `http://localhost:5000/gateway/talk-to-manager`;
        const talkToManagerData = {
            "_meta": {
                "recipient": "app-manager",
                "event": "send-to-device"
            },
            "payload": {
                "device-id": deviceId,
                "send-api-data": data
            }
        };
        httpUtils.sendPostRequest(execUrl, talkToManagerData);
    };

    disseminateAll(tag, data) {
        this._getIPAddress()
            .then(ipAddress => {
                const metadata = {
                    "origin-address": ipAddress,
                    "api": "disseminate-all",
                    "tag": tag
                };
                const fullData = {"_meta": metadata, "data": data};
                httpUtils.sendPostRequest(`http://localhost:5000/platform/disseminate-all`, fullData);
            })
            .catch(err => {
                console.err(err);
            });
    };

    queryAll(tag, replyTag, data) {
        this._getIPAddress()
            .then(ipAddress => {
                const metadata = {
                    "origin-address": ipAddress,
                    "api": "query-all",
                    "tag": tag,
                    "reply-tag": replyTag
                };
                const fullData = {"_meta": metadata, "data": data};
                httpUtils.sendPostRequest(`http://localhost:5000/platform/query-all`, fullData);
            })
            .catch(err => {
                console.err(err);
            });
    };

    _getIPAddress() {
        return new Promise((resolve, reject) => {
            if(!gatewayDetails) {
                httpUtils.sendGetRequest('http://localhost:5000/gateway/details')
                    .then(res => res.json())
                    .then(selfDetailsJson => {
                        gatewayDetails = selfDetailsJson;
                        resolve(selfDetailsJson.ip);
                    })
                    .catch(err => {
                        reject(err)
                    });
            } else {
                resolve(gatewayDetails.ip);
            }
        })
    }
}

module.exports = Oracle;