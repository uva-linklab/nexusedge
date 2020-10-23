/*
Handler to parses BLE packets from estimote sensors and deliver it to platform.
 */
const EnOceanController = require('enocean-controller');
const enoceanController = EnOceanController.getInstance();
const utils = require('../../../utils/utils');

const gatewayIpAddress = utils.getGatewayIp();

const deviceMapping = {'172.27.44.124': [
        '050d68bf',
        '050d69ce',
        '050d6990',
        '05083a3c'],
    '172.27.44.92': [
        '0580b1cd',
        '051087b1',
        '050d8c55',
        '050d7773',
        '00880cc5',
        '05073696'],
    '172.27.45.130': ['0512871d'],
    '172.27.45.26': [
        '050d5e42',
        '0197303a',
        '00888e93']};


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

        let shouldDeliver = true;
        Object.entries(deviceMapping).forEach(entry => {
            const [ip, deviceIdList] = entry;
            if(deviceIdList.includes(deviceId)) {
                if(ip === gatewayIpAddress) { // i'm expected to deliver
                    // add a new field
                    deviceData['xxxStartTs'] = Date.now();
                } else { // i shouldn't deliver
                    shouldDeliver = false;
                }
            }
        });

        if(shouldDeliver) {
            this.platformCallback.deliver(this.handlerId, deviceId, deviceType, deviceData);
        }
    }
}

module.exports = EnOceanHandler;
