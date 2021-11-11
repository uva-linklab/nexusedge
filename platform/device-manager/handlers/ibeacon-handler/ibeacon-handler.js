/*
Handler to parse iBeacons.
 */
const BleController = require('ble-controller');
const bleController = BleController.getInstance();

// standard iBeacon values
const EXPECTED_MANUFACTURER_DATA_LENGTH = 25;
const APPLE_COMPANY_IDENTIFIER = 0x004c;
const IBEACON_TYPE = 0x02;
const EXPECTED_IBEACON_DATA_LENGTH = 0x15;

class IBeaconHandler {
    constructor(handlerId) {
        this.handlerId = handlerId;
        this.deviceType = "iBeacon";
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
                return (manufacturerData &&
                    EXPECTED_MANUFACTURER_DATA_LENGTH <= manufacturerData.length &&
                    APPLE_COMPANY_IDENTIFIER === manufacturerData.readUInt16LE(0) &&
                    IBEACON_TYPE === manufacturerData.readUInt8(2) &&
                    EXPECTED_IBEACON_DATA_LENGTH === manufacturerData.readUInt8(3));

            }, this._handlePeripheral.bind(this));
        });
    }

    _handlePeripheral(peripheral) {
        const manufacturerData = peripheral.advertisement.manufacturerData;

        const uuid = manufacturerData.slice(4, 20).toString('hex');
        const major = manufacturerData.readUInt16BE(20);
        const minor = manufacturerData.readUInt16BE(22);
        const measuredPower = manufacturerData.readInt8(24);

        console.log(peripheral.advertisement.localName);

        const data = {
            "uuid": uuid,
            "major": major,
            "minor": minor,
            "measuredPower": measuredPower
        };
        this.platformCallback.deliver(this.handlerId, peripheral.id, this.deviceType, data);
    }
}

module.exports = IBeaconHandler;
