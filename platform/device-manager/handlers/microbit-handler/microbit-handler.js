/*
Handler to parse SIF ASSIST EKG beacon data.
 */
const BleController = require('ble-controller');
const bleController = BleController.getInstance();
const debug = require('debug')('microbit-handler');

const MICROBIT_BEACON_COMPANY_ID = 0xFFEE;

class MicrobitHandler {
    constructor(handlerId) {
        this.handlerId = handlerId;
        this.deviceType = "microbit";
    }

    start(platformCallback) {
        console.log(`[microbit-handler] started microbit-handler`);
        this.platformCallback = platformCallback;
        bleController.initialize().then(() => {
            bleController.getPeripheralsWithPredicate(peripheral => {
                const manufacturerData = peripheral.advertisement.manufacturerData;
                if(!manufacturerData)
                    return false;

                // this does not include the length and AD Type bytes. so first two bytes would be company id
                const companyId = manufacturerData.readUInt16LE(0);

                // filter beacons based on company id and manufacturer data length
                return companyId === MICROBIT_BEACON_COMPANY_ID;
            }, this._handlePeripheral.bind(this));
        });
    }

    _handlePeripheral(peripheral) {
        console.log(`[microbit-handler] discovered a peripheral with address = ${peripheral.address}`);
        // if it has a localName, add it as metadata
        const localName = peripheral.advertisement.localName;

        const manufacturerData = peripheral.advertisement.manufacturerData;
        let bufferIndex = 0;

        // this does not include the length and AD Type bytes. so first two bytes would be company id
        const companyId = manufacturerData.readUInt16LE(bufferIndex);

        // convert rest of the payload buffer to string
        const payloadBuffer = manufacturerData.slice(bufferIndex).toString();
        const data = {
            "manufacturer_data": payloadBuffer
        };

        // TODO: what to do with id? for now using the ble hardware address
        this.platformCallback.deliver(this.handlerId,
            peripheral.address,
            this.deviceType,
            data);
    }
}

module.exports = MicrobitHandler;
