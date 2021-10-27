const path = require('path');
const fs = require('fs-extra');
const mqtt = require('mqtt');
const AmazonCognitoIdentity = require("amazon-cognito-identity-js");

const configPath = path.join(__dirname, './sif-cloud.json');

class SIFCloudPublisher {
    constructor() {
    }

    initialize() {
        try{
            // read the config file
            const config = fs.readJsonSync(configPath);
            this.cloudIpAddress = config['server_ip_address'];
            this.port = config['port'];
            this.mqttTopic = config['mqtt_topic'];
            this.mqttClient = mqtt.connect(`mqtt://${this.cloudIpAddress}:${this.port}`);
            this.credentials = {
                "username": config['username'],
                "password": config['password'],
                "userPoolId": config['userPoolId'],
                "clientId": config['clientId']
            };

            this._obtainTokenAndScheduleNext();

        } catch (e) {
            console.error(`[sif-cloud-publisher] unable to read config file at ${configPath}`);
            process.exit(1);
        }
    }

    _obtainTokenAndScheduleNext() {
        this._getCognitoToken().then(result => {
            console.log(`[sif-cloud-publisher] obtained access token`);

            this.token = result.token;
            const expirationTimeSec = result.expirationTimeSec;

            // schedule the renewal
            const currentTimeSec = Math.round(Date.now() / 1000);

            // renew 1min before the expiration time
            const scheduledRenewalTimeSec = expirationTimeSec - currentTimeSec - 60;

            setTimeout(() => {
                this._obtainTokenAndScheduleNext();
            }, scheduledRenewalTimeSec * 1000);

        }).catch(error => {
            console.error(`[sif-cloud-publisher] unable to obtain access token`);
            console.error(error);
            process.exit(1);
        });
    }

    _getCognitoToken() {
        const authDetails = new AmazonCognitoIdentity.AuthenticationDetails({
            Username: this.credentials.username,
            Password: this.credentials.password
        });

        const cognitoUser = new AmazonCognitoIdentity.CognitoUser({
            Username: this.credentials.username,
            Pool: new AmazonCognitoIdentity.CognitoUserPool({
                UserPoolId: this.credentials.userPoolId,
                ClientId: this.credentials.clientId
            })
        });

        return new Promise((resolve, reject) => {
            cognitoUser.authenticateUser(
                authDetails,
                {
                    onSuccess: function(result) {
                        const accessToken = result.getAccessToken().getJwtToken();
                        const expirationTimeSec = result.getAccessToken().payload.exp;

                        resolve({
                            "token": accessToken,
                            "expirationTimeSec": expirationTimeSec
                        });
                    },
                    onFailure: function(error) {
                        reject(error);
                    }
                }
            );
        });
    }

    onData(data) {
        if(this.token && this.token.length > 0) {
            if(data['device_type'] === 'microbit') {
                console.log("skipped microbit data publish to sif");
                return;
            }
            const formattedData = this._getCloudFormattedData(data, this.token);
            this.mqttClient.publish(this.mqttTopic, JSON.stringify(formattedData));
        }
    }

    /**
     * Returns a JSON object in the format expected by the SIF cloud
     * @param sensorData data in the nexusedge data format
     * @param token access token required by the SIF cloud
     */
    _getCloudFormattedData(sensorData, token) {
        // construct the data object
        const dataObject = {};
        dataObject["app_name"] = sensorData["device_id"];
        dataObject["time"] = sensorData["_meta"]["received_time"];

        const payloadFields = {};
        const metadataFields = {};

        // set the directly available metadata fields
        metadataFields["handler_id"] = sensorData["_meta"]["handler_id"];
        metadataFields["controller_id"] = sensorData["_meta"]["controller_id"];
        metadataFields["gateway_id"] = sensorData["_meta"]["gateway_id"];
        metadataFields["device_type"] = sensorData["device_type"];

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
                "unit": "na",
                "value": value
            };
        }
        for(const [key, value] of Object.entries(fields.metadata)) {
            metadataFields[key] = value;
        }
        dataObject["payload_fields"] = payloadFields;
        dataObject["metadata"] = metadataFields;

        return {
            "app_name": sensorData["device_id"],
            "token": token,
            "data": dataObject
        };
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
                        const innerOutput = this._getOpenTsdbFriendlyFields(innerKey, innerValue);
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
                }
                break;
        }
        return output;
    }
}

module.exports = SIFCloudPublisher;
