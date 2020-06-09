const mqtt = require('mqtt');
const PLATFORM_MQTT_TOPIC = 'gateway-data';

/**
 * This is a singleton class which is used to operate on MQTT.
 * Singleton reference: https://blog.logrocket.com/design-patterns-in-node-js/
 *
 * Usage:
 * const MqttController = require(“./mqtt-controller”)
 * const mqttController = MqttController.getInstance();
 * mqttController.publish(data);
 * mqttController.subscribe(topic, (message) => {});
 */

let instance = null;

// topic -> [callback1, callback2, ...]
const subscriberCallbackMap = {};

class MqttController {

    constructor() {
        this.mqttClient = mqtt.connect('mqtt://localhost');

        this.mqttClient.on('message', (topic, message) => {
            const data = JSON.parse(message.toString());

            if(subscriberCallbackMap.hasOwnProperty(topic)) {
                subscriberCallbackMap[topic]
                    .forEach(callback => callback(data));
            }
        });
    }

    static getInstance() {
        if(!instance) {
            instance = new MqttController();
        }
        return instance;
    }

    /**
     * publishes a data object to the topic specified.
     * @param topic defaults to the gateway-data MQTT topic
     * @param data
     */
    publish(topic = PLATFORM_MQTT_TOPIC, data) {
        this.mqttClient.publish(topic, JSON.stringify(data));
    }

    /**
     * receive callback when there is new data on a specified MQTT topic
     * @param topic defaults to the gateway-data MQTT topic
     * @param callback
     */
    subscribe(topic = PLATFORM_MQTT_TOPIC, callback) {
        if(subscriberCallbackMap.hasOwnProperty(topic)) {
            subscriberCallbackMap[topic].append(callback);
        } else {
            subscriberCallbackMap[topic] = [callback];
            this.mqttClient.subscribe(topic);
        }
    }
}

module.exports = MqttController;