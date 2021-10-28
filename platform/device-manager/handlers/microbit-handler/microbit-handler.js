/*
Handler to parse cps1 microbit beacons.
 */
const BleController = require('ble-controller');
const bleController = BleController.getInstance();
const debug = require('debug')('microbit-handler');

const MICROBIT_BEACON_COMPANY_ID = 0xcb51;

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
        // console.log(`[microbit-handler] discovered a peripheral with address = ${peripheral.id}`);
        // if it has a localName, add it as metadata
        const localName = peripheral.advertisement.localName;

        const manufacturerData = peripheral.advertisement.manufacturerData;
        let bufferIndex = 0;

        // this does not include the length and AD Type bytes. so first two bytes would be company id
        const companyId = manufacturerData.slice(0, 2).toString('hex');
        bufferIndex+=2;

        // convert rest of the payload buffer to string
        const payloadBuffer = manufacturerData.slice(bufferIndex).toString('hex');
        const data = {
            "manufacturer_data": payloadBuffer, // will go as payload
            "local_name": localName, // this will end up as metadata,
            "company_id": companyId
        };

        this.platformCallback.deliver(this.handlerId,
            peripheral.id,
            this.deviceType,
            data);
    }
}

module.exports = MicrobitHandler;

