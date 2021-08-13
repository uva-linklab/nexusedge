const path = require('path');
const fs = require('fs-extra');
const mqtt = require('mqtt');

class SIFCloudPublisher {
    constructor() {
    }

    initialize() {
        // read the config file
        const config = fs.readJsonSync(path.join(__dirname, './config.json'));

        this.cloudIpAddress = config['cloud_ip_address'];
        this.mqttTopic = config['ingest_mqtt_topic'];
        this.forwardedTopic = config['forwarded_topic'];

        this.mqttClient = mqtt.connect(`mqtt://${this.cloudIpAddress}`);
    }

    onData(data) {
        const formattedData = this._getCloudFormattedData(data);
        console.log(JSON.stringify(formattedData));
        // this.mqttClient.publish(this.mqttTopic, JSON.stringify(formattedData));
    }

    /**
     * Returns a JSON object in the format expected by the SIF cloud
     * @param sensorData data in the nexusedge data format
     */
    _getCloudFormattedData(sensorData) {
        const formattedData = {};
        formattedData['topic'] = this.forwardedTopic;
        formattedData['app_id'] = sensorData['device_id'];
        formattedData['counter'] = 0;

        const payloadFields = {};
        for(const [fieldName, value] of Object.entries(sensorData['device_data'])) {
            payloadFields[fieldName] = {
                "displayName": fieldName,
                "unit": "",
                "value": value
            };
        }
        formattedData["metadata"] = {
            "time": new Date().toISOString(),
            "handler_id": sensorData["_meta"]["handler_id"],
            "controller_id": sensorData["_meta"]["controller_id"],
            "gateway_address": sensorData["_meta"]["gateway_address"],
            "deviceType": sensorData["device_type"]
        };
        formattedData["payload_fields"] = payloadFields;
        return formattedData;
    }
}

module.exports = SIFCloudPublisher;
