/*
Parses BLE packets from Estimote Sensors and publishes to the gateway-data MQTT topic
 */
const BleController = require('ble-controller');
const bleController = BleController.getInstance();
const estimoteParser = require("./estimote-telemetry-parser");

// Packets from the estimote family (Telemetry, Connectivity, etc.) are broadcast with the Service UUID 'fe9a'
const ESTIMOTE_SERVICE_UUID = 'fe9a';

class EstimoteHandler {
    constructor(handlerId) {
        this.handlerId = handlerId;
        this.deviceType = "estimote";
        this.scanPaused = false;
    }

    start(platformCallback) {
        this.platformCallback = platformCallback;
        bleController.initialize().then(() => {
            bleController.subscribeToAdvertisements(ESTIMOTE_SERVICE_UUID, this._handlePeripheral.bind(this));
            this._startScan();
        });
    }

    _handlePeripheral(peripheral) {
        // handle peripherals only during the time periods define in startScan and stopScan
        if(this.scanPaused) {
            return;
        }

        // TODO check if this is needed
        const estimoteServiceData = peripheral.advertisement.serviceData.find(function(el) {
            return el.uuid === ESTIMOTE_SERVICE_UUID;
        });

        const data = {};
        if((estimoteServiceData !== undefined)) {
            const telemetryData = estimoteServiceData.data;
            const telemetryPacket = estimoteParser.parseEstimoteTelemetryPacket(telemetryData);

            if(!telemetryPacket)
                return;

            // deliver data to platform
            this.platformCallback.deliver(this.handlerId, telemetryPacket.shortIdentifier, this.deviceType, telemetryPacket);
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

module.exports = EstimoteHandler;
