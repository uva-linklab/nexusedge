/*
Handler to parse SIF ASSIST EKG beacon data.
 */
const BleController = require('ble-controller');
const bleController = BleController.getInstance();

const ASSIST_BEACON_COMPANY_ID = 0xFFFF;
const ASSIST_BEACON_MANUFACTURER_DATA_LENGTH = 26;

class EstimoteHandler {
    constructor(handlerId) {
        this.handlerId = handlerId;
        this.deviceType = "estimote";
    }

    start(platformCallback) {
        this.platformCallback = platformCallback;
        bleController.initialize().then(() => {
            bleController.getPeripheralsWithPredicate(peripheral => {
                const manufacturerData = peripheral.advertisement.manufacturerData;
                if(!manufacturerData)
                    return false;

                // this does not include the length and AD Type bytes. so first two bytes would be company id
                const companyId = manufacturerData.readUInt16LE(0);

                // filter beacons based on company id and manufacturer data length
                return companyId === ASSIST_BEACON_COMPANY_ID && manufacturerData.length === ASSIST_BEACON_MANUFACTURER_DATA_LENGTH;
            }, this._handlePeripheral.bind(this));
        });
    }

    _handlePeripheral(peripheral) {
        const manufacturerData = peripheral.advertisement.manufacturerData;
        let bufferIndex = 0;

        // this does not include the length and AD Type bytes. so first two bytes would be company id
        const companyId = manufacturerData.readUInt16LE(bufferIndex);
        bufferIndex+=2;
        const version = manufacturerData.readUInt8(bufferIndex++);
        const sensorType = manufacturerData.readUInt8(bufferIndex++);
        const sequenceNumber = manufacturerData.readUInt16LE(bufferIndex);
        bufferIndex+=2;

        const payloadBuffer = manufacturerData.slice(bufferIndex);

        /* TODO: 1. split each byte out of this as a single EKG sample
                 2. convert to a voltage value by scaling based on reference voltage
                 3. assign timestamps latest sample with current time and backdate other ones
         */

    }
}

module.exports = EstimoteHandler;
