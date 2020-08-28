/*
Parser for Eddystone beacons.
Code taken from:
https://github.com/sandeepmistry/node-eddystone-beacon-scanner/blob/master/lib/eddystone-beacon-scanner.js
 */
// force reporting all HCI events on Linux
process.env['NOBLE_REPORT_ALL_HCI_EVENTS'] = 1;

const urlDecode = require('eddystone-url-encoding').decode;

const SERVICE_UUID = 'feaa';

const UID_FRAME_TYPE = 0x00;
const URL_FRAME_TYPE = 0x10;
const TLM_FRAME_TYPE = 0x20;

let instance = null;

class EddystoneBeaconParser {
    constructor() {
        this._discovered = {};
    }

    static getInstance() {
        if(!instance) {
            instance = new EddystoneBeaconParser();
        }
        return instance;
    }

    parse(peripheral) {
        let beacon = null;
        if(this._isBeacon(peripheral)) {
            beacon = this._parseBeacon(peripheral);
            beacon.lastSeen = Date.now();

            const oldBeacon = this._discovered[peripheral.id];

            if (!oldBeacon) {
                // TODO
                // this.emit('found', beacon);
            } else {
                let toCopy;

                if (beacon.type === 'tlm') {
                    toCopy = ['type', 'url', 'namespace', 'instance'];
                } else {
                    toCopy = ['tlm'];
                }

                toCopy.forEach(function(property) {
                    if (oldBeacon[property] !== undefined) {
                        beacon[property] = oldBeacon[property];
                    }
                });
            }

            this._discovered[peripheral.id] = beacon;
            // TODO
            // this.emit('updated', beacon);
        }
        return beacon;
    }

    _isBeacon(peripheral) {
        const serviceData = peripheral.advertisement.serviceData;

        // make sure service data is present, with the expected uuid and data length
        return ( serviceData &&
            serviceData.length > 0 &&
            serviceData[0].uuid === SERVICE_UUID &&
            serviceData[0].data.length > 2
        );
    };

    _parseBeacon(peripheral) {
        const data = peripheral.advertisement.serviceData[0].data;
        const frameType = data.readUInt8(0);

        let beacon = {};
        let type = 'unknown';
        const rssi = peripheral.rssi;

        switch (frameType) {
            case UID_FRAME_TYPE:
                type = 'uid';
                beacon = this._parseUidData(data);
                break;

            case URL_FRAME_TYPE:
                type = 'url';
                beacon = this._parseUrlData(data);
                break;

            case TLM_FRAME_TYPE:
                type = 'tlm';
                beacon = this._parseTlmData(data);
                break;

            default:
                break;
        }

        beacon.id = peripheral.id;
        beacon.type = type;
        beacon.rssi = rssi;

        const txPower = beacon.txPower;
        if (txPower !== undefined) {
            beacon.distance = this._calculateDistance(txPower, rssi);
        }

        return beacon;
    };

    _parseUidData(data) {
        return {
            txPower: data.readInt8(1),
            namespace: data.slice(2, 12).toString('hex'),
            instance: data.slice(12, 18).toString('hex'),
        };
    }

    _parseUrlData(data) {
        return {
            txPower: data.readInt8(1),
            url: urlDecode(data.slice(2))
        };
    }

    _parseTlmData(data) {
        return {
            tlm: {
                version: data.readUInt8(1),
                vbatt: data.readUInt16BE(2),
                temp: data.readInt16BE(4) / 256,
                advCnt: data.readUInt32BE(6),
                secCnt: data.readUInt32BE(10)
            }
        };
    }

    _calculateDistance(txPower, rssi) {
        return Math.pow(10, ((txPower - rssi) - 41) / 20.0);
    }
}

module.exports = EddystoneBeaconParser;