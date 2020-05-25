const fs = require("fs-extra");
const mqtt = require("mqtt");
const utils = require("../../utils");
const fetch = require('node-fetch');

// TODO: add mqtt-data-collector logic to SSM.
const MessagingService = require('../messaging-service');

class SensorStreamManager {
    constructor() {
        this.gatewayIp = this._getGatewayIp();

        // sensorStream stores the sensor id and application topic mapping
        // the key is sensor id and the value is an object
        // with the key is gateway ip and the value is an array of application's topics
        // sensor-stream-manager uses sensorStream to publish sensor stream data
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
        this.sensorStream = {};

        // TODO: policy
        this.policy = {};

        // mqttClients = {
        //     "gateway-ip": client
        // }
        this.mqttClients = {};

        this.registerMQTTClient("localhost", "gateway-data");
    }

    /* ===== public functions ===== */

    /**
     * This function registers topic for local sensors.
     * @param {string} ip - gateway' ip
     * @param {string[]} sensorIds - an array of sensor id
     * @param {string} topic
     */
    registerLocalGatewayTopic(ip, sensorIds, topic) {
        for(const id of sensorIds) {
            if(!this.sensorStream[id]) {
                this.sensorStream[id] = {};
            }
            if(!this.sensorStream[id][ip]) {
                this.sensorStream[id][ip] = [];
            }
            this.sensorStream[id][ip].push(topic);
        }
    }

    /**
     * This function sends sensor requirement to the remote gateway.
     * @param {string} ip -remote gateway's ip
     * @param {string[]} sensorIds - an array of sensor id
     * @param {string} topic
     */
    registerRemoteGatewayTopic(ip, sensorIds, topic) {
        // Remote gateway's register-topic url
        const gatewayUrl = `http://${ip}:5000/gateway/register-app-sensor-reqruirement`;
        // Request body
        const body = {
            ip: this.gatewayIp,
            sensors: sensorIds,
            topic: topic,
        };
        // Send application's sensor requirement to remote gateway
        fetch(gatewayUrl, {
            method: 'POST',
            body: JSON.stringify(body),
            headers: {'Content-Type': 'application/json'},
            timeout: 5000
        }).then(res => {
            if(res.status === 200) {
                console.log(`[INFO] Sent "${topic}" to ${ip} successfully!`);
            } else {
                console.error(`[ERROR] Failed to send "${topic}" to ${ip} with status ${res.status}.`);
            }
        }).catch(err => {
            console.error(`[ERROR] Failed to send "${topic}" to ${ip}.`);
            console.error(err);
        });
    }

    /**
     * This function register MQTT clients.
     * @param {string} ip - MQTT broker's ip
     * @param {string} mqttTopic
     */
    registerMQTTClient(ip, mqttTopic) {
        // Check if the MQTT client exists
        if(ip === "localhost") ip = this.gatewayIp;
        if(!this.mqttClients[ip]) {
            this.mqttClients[ip] = this._connectToMQTTBroker(ip, mqttTopic);
        }
    }

    /* ===== internal use functions ===== */

    /**
     * This function gets the gateway's ip.
     * @returns {string} - gateway's ip
     */
    _getGatewayIp() {
        let ip = utils.getIPAddress();
        if(!ip) {
            console.error("[ERROR] No IP address found. Please ensure the config files are set properly.");
            process.exit(1);
        }
        console.log(`[INFO] Gateway's ip address is ${ip}`);
        return ip;
    }

    /**
     * This function publishes data to application's topic.
     * @param {string} ip - MQTT broker's ip
     * @param {string} topic
     * @param {string} data - sensor data
     */
    _publishData(ip, topic, data) {
        // Check if the MQTT client exists
        if(!this.mqttClients[ip]) {
            console.error(`[ERROR] ${ip} has not been registered.`);
            return;
        }
        const client = this.mqttClients[ip];
        client.publish(topic, data, {}, err => {
            if(err) {
                console.error(`[ERROR] Failed to publish to ${ip}.`);
                console.error(err);
            }
        });
    }

    /**
     * This function publishes data to application's topic.
     * @param {string} ip - MQTT broker's ip
     * @param {string} mqttTopic
     * @returns {Object} - MQTT client
     */
    _connectToMQTTBroker(ip, mqttTopic) {
        const url = `mqtt://${ip}`;
        // Connect to mqtt broker
        const client = mqtt.connect(url);
        client.on('connect', () => {
            // Only when connecting to local MQTT broker goes into the condition
            // This condition makes the client
            //      1. subscribes "gateway-data" topic and
            //      2. publishes sensor stream data to the target topics
            if(typeof mqttTopic != "undefined") {
                // Subscribe to mqtt topic
                client.subscribe(mqttTopic, (err) => {
                    if (err) {
                        console.error(`[ERROR] Failed to subscribe "${mqttTopic}".`);
                        console.error(err);
                    } else {
                        console.log(`[INFO] Subscribed to "${mqttTopic}" topic successfully!`);
                    }
                });
                // when sensor stream data is published to "gateway-data" topic
                // sensor-stream-manager will check policy and
                // publish the data to application's topic
                client.on('message', (t, message) => {
                    const payload = JSON.parse(message.toString());
                    const sensorId = payload["_meta"]["device_id"];
                    if(sensorId in this.sensorStream) {
                        for(const gatewayIp in this.sensorStream[sensorId]) {
                            const topics = this.sensorStream[sensorId][gatewayIp];
                            for(const topic of topics) {

                                // TODO: check policy

                                // Publish to application's topic
                                this._publishData(gatewayIp, topic, JSON.stringify(payload));
                            }
                        }
                    }
                });
            }
            console.log(`[INFO] Connected to MQTT broker at ${ip} successfully!`);
        });
        client.on('disconnect', () => {
            console.log(`[INFO] Disconnected to MQTT broker at ${ip}.`);
        });
        return client;
    }
}

console.log("[INFO] Initialize app-manager...");
const serviceName = process.env.SERVICE_NAME;
const messagingService = new MessagingService(serviceName);

const sensorStreamManager = new SensorStreamManager();

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
            if(ip === sensorStreamManager.gatewayIp) {
                sensorStreamManager.registerLocalGatewayTopic(ip, sensorIds, topic);
            } else {
                sensorStreamManager.registerRemoteGatewayTopic(ip, sensorIds, topic);
            }
        }
        console.log(`[INFO] Registered application "${topic}" successfully!`);
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
        const ip = appData["app"]["ip"];
        sensorStreamManager.registerMQTTClient(ip);
        sensorStreamManager.registerLocalGatewayTopic(ip, sensorIds, topic);
    }
});