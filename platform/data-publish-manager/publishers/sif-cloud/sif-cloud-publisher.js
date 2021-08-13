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
        const metadataFields = {};

        // set the directly available metadata fields
        metadataFields["time"] = new Date().toISOString();
        metadataFields["handler_id"] = sensorData["_meta"]["handler_id"];
        metadataFields["controller_id"] = sensorData["_meta"]["controller_id"];
        metadataFields["gateway_address"] = sensorData["_meta"]["gateway_address"];
        metadataFields["deviceType"] = sensorData["device_type"];

        /*
        OpenTSDB only supports integer or floating point metric values.
        reference: http://opentsdb.net/docs/build/html/user_guide/writing/index.html
        so we divide some of the device_data fields into payload fields and metadata fields
        based on their datatype. we also flatten nested objects.
        this conversion is explained in the jsdoc for _getOpenTsdbFriendlyFields.
         */

        const fields = this._getOpenTsdbFriendlyFields("", sensorData['device_data']);
        for(const [key, value] of Object.entries(fields.payload)) {
            payloadFields[key] = {
                "displayName": key,
                "unit": "",
                "value": value
            };
        }
        for(const [key, value] of Object.entries(fields.metadata)) {
            metadataFields[key] = value;
        }
        formattedData["payload_fields"] = payloadFields;
        formattedData["metadata"] = metadataFields;
        return formattedData;
    }

    // reference: https://www.codegrepper.com/code-examples/javascript/javascript+check+if+string+is+number
    _isNumeric(str) {
        // Check if input is string
        if (typeof str != "string")
            return false;
        return !isNaN(str) && !isNaN(parseFloat(str))
    }

    /**
     * for a given key-value pair, returns the set of payload fields and metadata fields based on
     the type of the value
     - if value is a number (int/float), add to payload fields
     - if value is a string, add as a metadata field (tag)
     - if value is an object, recursively get fields for each key and append each key of the object to the external key
        * eg: for "acceleration": {"x": 5, "y": 10, "unit": "mph"}
            payload fields -> "acceleration_x": 5, "acceleration_y": 10
            metadata fields -> "acceleration_unit": "mph"
        * if there are nested objects, then do this recursively
     - if value is a boolean, convert to int
     * @param key
     * @param value
     * @return {{metadata: {}, payload: {}}}
     * @private
     */
    _getOpenTsdbFriendlyFields(key, value) {
        const output = {
            "payload": {},
            "metadata": {}
        };

        switch(typeof value) {
            case 'number':
                // add to payload fields
                output["payload"][key] = value;
                break;
            case 'string':
                // check if this can be type converted to a number
                if(this._isNumeric(value)) {
                    // then convert it!
                    output["payload"][key] = parseFloat(value);
                } else {
                    // if not, add it as a metadata field
                    output["metadata"][key] = value;
                }
                break;
            case 'boolean':
                // convert to int and add to payload field
                output["payload"][key] = value ? 1 : 0;
                break;
            case 'object':
                if(value !== null) {
                    // iterate over each key-value pair and recursively obtain the payload and metadata fields
                    for(const [innerKey, innerValue] of Object.entries(value)) {
                        const innerOutput = getFields(innerKey, innerValue);
                        // append the key to each payload/metadata field in innerOutput
                        for(const [payloadField, payloadValue] of Object.entries(innerOutput.payload)) {
                            const newKey = key === '' ? payloadField : `${key}_${payloadField}`;
                            output["payload"][newKey] = payloadValue;
                        }
                        for(const [metadataField, metadataValue] of Object.entries(innerOutput.metadata)) {
                            const newKey = key === '' ? metadataField : `${key}_${metadataField}`;
                            output["metadata"][newKey] = metadataValue;
                        }
                    }
                    break;
                }
        }
        return output;
    }
}

module.exports = SIFCloudPublisher;
