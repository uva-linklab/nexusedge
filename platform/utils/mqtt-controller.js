const mqtt = require('mqtt');
const PLATFORM_MQTT_TOPIC = 'gateway-data';

/**
 * MqttController is a singleton that maintains state of multiple MQTT clients.
 * It ensures that only one MQTT client object is created for a connection with an MQTT broker.
 * Singleton reference: https://blog.logrocket.com/design-patterns-in-node-js/
 *
 * Usage:
 * const MqttController = require(“./mqtt-controller”)
 * const mqttController = MqttController.getInstance();
 * mqttController.publish(data);
 * mqttController.subscribe(topic, (message) => {});
 */

let instance = null;

class MqttController {

    constructor() {
        // mapping from an ip address to the corresponding MQTT client object
        this.mqttClientMap = {}; // ip -> client

        // mapping from an ip address to the corresponding callbackMap
        // The callbackMap for a given ip address is a mapping from topic -> [callback1, callback2, ..]
        this.callbackMapDirectory = {}; // ip -> callbackMap
    }

    static getInstance() {
        if(!instance) {
            instance = new MqttController();
        }
        return instance;
    }

    /**
     * publishes a message to the specified topic on a broker at the specified ip
     * @param ip mqtt broker's ip
     * @param topic
     * @param message message in string format
     */
    publish(ip, topic, message) {
        const client = this._getMqttClient(ip);
        client.publish(topic, message);
    }

    /**
     * publishes message to the localhost's PLATFORM_MQTT_TOPIC
     * @param message message in string format
     */
    publishToPlatformMqtt(message) {
        this.publish("localhost", PLATFORM_MQTT_TOPIC, message);
    }

    /**
     * receive callback when there is new data on a specified MQTT topic at a given ip address
     * @param ip broker's ip address
     * @param topic mqtt topic
     * @param callback callback function
     */
    subscribe(ip, topic, callback) {
        const client = this._getMqttClient(ip);

        const callbackMap = this._getCallbackMap(ip);

        // if there is a callback list for the topic, append this callback to it
        if(callbackMap.hasOwnProperty(topic)) {
            callbackMap[topic].push(callback);
        } else {
            // otherwise, add a new callback list
            callbackMap[topic] = [callback];

            // subscribe to the mqtt topic
            client.subscribe(topic);
        }
    }

    /**
     * subscribe to the localhost's PLATFORM_MQTT_TOPIC
     * @param callback
     */
    subscribeToPlatformMqtt(callback) {
        this.subscribe("localhost", PLATFORM_MQTT_TOPIC, callback);
    }

    /**
     * unsubscribe from the specified topic
     * @param ip
     * @param topic
     */
    unsubscribe(ip, topic) {
        const client = this._getMqttClient(ip);

        const callbackMap = this._getCallbackMap(ip);

        // if there is a callback list for the topic, append this callback to it
        if(callbackMap.hasOwnProperty(topic)) {
            // TODO this does not work if there are multiple subscribers to this topic.
            //  currently, we don't have a way to differentiate between callbacks. So there is no way to ascertain
            //  which callback we're trying to remove when there are multiple subscribers.
            //  maybe during subscription, return a subscriptionId ?
            delete callbackMap[topic];

            // unsubscribe from the mqtt topic
            client.unsubscribe(topic);
        }
    }

    /**
     * Internal method to return the MQTT client object for the specified ip.
     * If the ip address is not present, creates a new mqtt client object.
     * @param ip
     * @return {mqttClient}
     * @private
     */
    _getMqttClient(ip) {
        // if there is no mqtt client already present, create a new client
        if(!this.mqttClientMap.hasOwnProperty(ip)) {
            this._createMqttClient(ip);
        }
        return this.mqttClientMap[ip];
    }

    /**
     * connect to the mqtt broker at the ip address specified and add it to the mqttClientMap
     * @param ip broker's ip address
     * @private
     */
    _createMqttClient(ip) {
        const client = mqtt.connect(`mqtt://${ip}`);

        // add the client to the mqttClient map
        this.mqttClientMap[ip] = client;

        // for that client, notify listeners for any messages
        client.on('message', (topic, message) => {
            const messageStr = message.toString();

            const callbackMap = this._getCallbackMap(ip);
            if(callbackMap.hasOwnProperty(topic)) {
                callbackMap[topic]
                    .forEach(callback => callback(messageStr));
            }
        });
    }

    /**
     * returns the callbackMap for a given ip address.
     * @param ip
     * @return {*}
     * @private
     */
    _getCallbackMap(ip) {
        if(!this.callbackMapDirectory.hasOwnProperty(ip)) {
            // if there is no callback map for ip, add a new entry in the directory
            this.callbackMapDirectory[ip] = {};
        }
        return this.callbackMapDirectory[ip];
    }
}

module.exports = MqttController;