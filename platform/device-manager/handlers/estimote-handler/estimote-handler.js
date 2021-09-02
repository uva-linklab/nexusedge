/*
Handler to parses BLE packets from estimote sensors and deliver it to platform.
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
    }

    start(platformCallback) {
        this.platformCallback = platformCallback;
        bleController.initialize().then(() => {
            bleController.getPeripheralsWithUuid(ESTIMOTE_SERVICE_UUID,
                this._handlePeripheral.bind(this));
        });
    }

    _handlePeripheral(peripheral) {
        const estimoteServiceData = peripheral.advertisement.serviceData.find(function(el) {
            return el.uuid === ESTIMOTE_SERVICE_UUID;
        });

        if((estimoteServiceData !== undefined)) {
            const telemetryData = estimoteServiceData.data;
            const telemetryPacket = estimoteParser.parseEstimoteTelemetryPacket(telemetryData);

            if(!telemetryPacket)
                return;

            // deliver data to platform
            this.platformCallback.deliver(this.handlerId, telemetryPacket.shortIdentifier, this.deviceType, telemetryPacket);
        }
    }
}

module.exports = EstimoteHandler;
