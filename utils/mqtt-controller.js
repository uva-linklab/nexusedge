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
            const messageStr = message.toString();

            if(subscriberCallbackMap.hasOwnProperty(topic)) {
                subscriberCallbackMap[topic]
                    .forEach(callback => callback(messageStr));
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
     * publishes a message to the specified topic
     * @param topic
     * @param message message in string format
     */
    publish(topic, message) {
        this.mqttClient.publish(topic, message);
    }

    /**
     * publishes message to the PLATFORM_MQTT_TOPIC
     * @param message message in string format
     */
    publishToPlatformMqtt(message) {
        this.publish(PLATFORM_MQTT_TOPIC, message);
    }

    /**
     * receive callback when there is new data on a specified MQTT topic
     * @param topic
     * @param callback
     */
    subscribe(topic, callback) {
        if(subscriberCallbackMap.hasOwnProperty(topic)) {
            subscriberCallbackMap[topic].append(callback);
        } else {
            subscriberCallbackMap[topic] = [callback];
            this.mqttClient.subscribe(topic);
        }
    }

    /**
     * subscribe to the PLATFORM_MQTT_TOPIC
     * @param callback
     */
    subscribeToPlatformMqtt(callback) {
        this.subscribe(PLATFORM_MQTT_TOPIC, callback);
    }
}

module.exports = MqttController;