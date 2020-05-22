/*
// TODO add which make of lighting sensors we are using
Parses BLE packets from Estimote and Lighting Sensors and publishes to the gateway-data MQTT topic
 */
const mqtt  = require('mqtt');
const MQTT_TOPIC_NAME = 'gateway-data';
const estimoteParser = require("./estimote-telemetry-parser");

// Packets from the estimote family (Telemetry, Connectivity, etc.) are broadcast with the Service UUID 'fe9a'
const ESTIMOTE_SERVICE_UUID = 'fe9a';

class LightingEstimoteScanner {
    constructor() {
        this.mqttClient = mqtt.connect('mqtt://localhost');
        this.scanPaused = false;

        this._startScan();
    }

    //TODO: get actual data from the lighting sensors and not just its metadata
    handlePeripheral(peripheral) {
        // handle peripherals only during the time periods define in startScan and stopScan
        if(this.scanPaused) {
            return;
        }

        // detect lighting sensors
        const localName = peripheral.advertisement.localName;
        const isLightingSensor = localName && localName.includes("$L$");

        // detect estimotes
        const estimoteServiceData = peripheral.advertisement.serviceData.find(function(el) {
            return el.uuid === ESTIMOTE_SERVICE_UUID;
        });
        const isEstimote = (estimoteServiceData !== undefined);

        const data = {};

        if(isLightingSensor) {
            data["device"] = "Lighting Sensor";
            data["id"] = peripheral.id;
            data["_meta"] = {
                "received_time": new Date().toISOString(),
                "device_id": peripheral.id,
                "receiver": "ble-peripheral-scanner",
                "gateway_id": noble.address
            };
        } else if(isEstimote) {
            const telemetryData = estimoteServiceData.data;
            const telemetryPacket = estimoteParser.parseEstimoteTelemetryPacket(telemetryData);

            if(!telemetryPacket)
                return;

            data["device"] = "Estimote";
            data["id"] = telemetryPacket.shortIdentifier;
            data["_meta"] = {
                "received_time": new Date().toISOString(),
                "device_id": telemetryPacket.shortIdentifier,
                "receiver": "ble-peripheral-scanner",
                "gateway_id": noble.address
            };

            //concatenate data and telemetry packet objects
            Object.assign(data, telemetryPacket);
        }

        if(Object.keys(data).length !== 0) {
            this.mqttClient.publish(MQTT_TOPIC_NAME, JSON.stringify(data));
        }
    }

    _startScan() {
        this.scanPaused = false;
        setTimeout(this._stopScan.bind(this), 60000); // scan for 1min
        console.log("Start handling peripherals");
    }

    _stopScan() {
        this.scanPaused = true;
        setTimeout(this._startScan.bind(this), 180000); // scan every 3mins
        console.log("Stopped handling peripherals");
    }
}

module.exports = LightingEstimoteScanner;