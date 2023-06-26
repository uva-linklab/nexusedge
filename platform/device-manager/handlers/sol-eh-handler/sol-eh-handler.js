/*
Handler to parse SOL sensors.
 */
const BleController = require('ble-controller');
const bleController = BleController.getInstance();

// standard iBeacon values
const SOL_EH_COMPANY_ID = 0xA154;

class SolEhHandler {
    constructor(handlerId) {
        this.handlerId = handlerId;
        this.deviceType = "SOL";
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
                return companyId === SOL_EH_COMPANY_ID;
            }, this._handlePeripheral.bind(this));
        });
    }

    _handlePeripheral(peripheral) {
        const manufacturerData = peripheral.advertisement.manufacturerData;
        let bufferIndex = 0;

        // this does not include the length and AD Type bytes. so first two bytes would be company id
        const companyId = manufacturerData.readUInt16LE(bufferIndex);
        bufferIndex+=2;
        // APP_ADV_DATA_LENGTH - 1 byte
        // DEVICE_ID - 1 byte
        // APP_ID - 1 byte
        // SD - 1 byte
        // SAMPLING_FREQUENCY - 1 byte
        // DATA_FLAG - 1 byte
        // FEATURE1 - 4 bytes
        // FEATURE2 - 4 bytes
        // FEATURE3 - 4 bytes
        // FEATURE4 - 4 bytes
        // LABEL - 1 byte
        // PACKET_COUNT - 1 byte

        const length = manufacturerData.readUInt8(bufferIndex++);
        const deviceId = manufacturerData.readUInt8(bufferIndex++);
        const appId = manufacturerData.readUInt8(bufferIndex++);
        const sd = manufacturerData.readUInt8(bufferIndex++);
        const samplingFreq = manufacturerData.readUInt8(bufferIndex++);
        const dataFlag = manufacturerData.readUInt8(bufferIndex++);
        const feature1 = manufacturerData.readFloatBE(bufferIndex);
        bufferIndex+=4;
        const feature2 = manufacturerData.readFloatBE(bufferIndex);
        bufferIndex+=4;
        const feature3 = manufacturerData.readFloatBE(bufferIndex);
        bufferIndex+=4;
        const feature4 = manufacturerData.readFloatBE(bufferIndex);
        bufferIndex+=4;
        const label = manufacturerData.readUInt8(bufferIndex++);
        const packetCount = manufacturerData.readUInt8(bufferIndex++);

        const data = {
            "length": length,
            "deviceId": deviceId,
            "appId": appId,
            "sd": sd,
            "samplingFreq": samplingFreq,
            "dataFlag": dataFlag,
            "feature1": feature1,
            "feature2": feature2,
            "feature3": feature3,
            "feature4": feature4,
            "label": label,
            "packetCount": packetCount
        };
        this.platformCallback.deliver(this.handlerId, peripheral.id, this.deviceType, data);
    }
}

module.exports = SolEhHandler;
