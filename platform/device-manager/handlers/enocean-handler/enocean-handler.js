/*
Handler to parses BLE packets from estimote sensors and deliver it to platform.
 */
const EnOceanController = require('enocean-controller');
const enoceanController = EnOceanController.getInstance();

class EnOceanHandler {
    constructor(handlerId) {
        this.handlerId = handlerId;
    }

    start(platformCallback) {
        this.platformCallback = platformCallback;

        enoceanController.initialize().then(() => {
           enoceanController.subscribe(this._handleData.bind(this));
        });
    }

    _handleData(data) {
        const deviceId =  data.sensor.id;
        const deviceType = data.sensor.eepType;
        const deviceData = {};

        if (data.rssi) {
            deviceData.rssi = data.rssi;
        }

        Object.keys(data.data).forEach(shortName => {
            const item = data.data[shortName];
            // Skip any information about the learn bit.
            if (shortName.indexOf('LRN') !== -1 || item.name.indexOf('Learn') !== -1) {
                return;
            }

            // Otherwise add this to the packet.
            let key = item.name;
            if (item.unit) {
                key += '_' + item.unit;
            }

            deviceData[key] = item.value;
        });

        this.platformCallback.deliver(this.handlerId, deviceId, deviceType, deviceData);
    }
}

module.exports = EnOceanHandler;
