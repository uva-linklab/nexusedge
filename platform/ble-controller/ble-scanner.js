/*
use abandonware forks of noble and bleno because the original repos are not maintained and do not work with node.js
versions 8 and above.
https://github.com/noble/node-bluetooth-hci-socket/issues/84
*/
const noble = require('@abandonware/noble');

// uuid -> callback function
const subscriberCallbackMap = {};

// This stores pending connection requests when the ble device is already connected to a peripheral.
// We store (peripheral, callback) pairs in a Map, as Maps remember the insertion order. So they can be used as a
// "queue" without needing an external module.
const connectionQueue = new Map();

class BleScanner {
    constructor() {
        this._initializeNoble();
        this.isConnectedToPeripheral = false;
    }

    _initializeNoble() {
        noble.on('stateChange', function (state) {
            console.log('BLE state change: ' + state);
            if (state === 'poweredOn') {
                this._startNobleScan();
            } else if (state === 'poweredOff') {
                console.log('BLE appears to be disabled.');
            } else {
                console.log('Unable to use BLE.');
            }
        }.bind(this));

        noble.on('discover', function (peripheral) {
            const serviceUuids = peripheral.advertisement.serviceUuids;
            if(serviceUuids) {
                Object.keys(subscriberCallbackMap) // get all UUIDs of the subscribers
                    .filter(uuid => serviceUuids.includes(uuid)) // check if current advertisement matches a subscriber's
                    .forEach(uuid => subscriberCallbackMap[uuid](peripheral)); // if so, call the callback function
            }
        });
    }

    _startNobleScan() {
        noble.startScanning([], true);
    }

    _stopNobleScan() {
        noble.stopScanning();
    }

    subscribeToAdvertisements(uuid, callback) {
        if(!subscriberCallbackMap.hasOwnProperty(uuid)) {
            subscriberCallbackMap[uuid] = callback;
        }
    }

    connectToPeripheral(peripheral, callback) {
        // check if the ble module is already connected to a peripheral
        if(!this.isConnectedToPeripheral) {
            this.isConnectedToPeripheral = true;

            // For some reason, noble scan stops after a device connects and writes to a peripheral's characteristic.
            // Reference: https://github.com/noble/noble/issues/223
            // So turn off noble scan before connecting. Resume scan after peripheral disconnects.
            console.log("stop noble scan before connect");
            this._stopNobleScan();
            peripheral.connectAsync()
                .then(err => callback(err));
        } else {
            // If already connected, add to the connectionQueue. Process next peripheral when there is a disconnection.
            connectionQueue.set(peripheral, callback);
        }
    }

    disconnectPeripheral(peripheral) {
        peripheral.disconnectAsync()
            .then(_ => {
                this.isConnectedToPeripheral = false;

                // check if there are other peripheral connection requests
                if(connectionQueue.size > 0) {
                    const nextEntry = connectionQueue.entries().next().value; // get next [peripheral, callback]
                    connectionQueue.delete(nextEntry[0]); // remove from queue
                    this.connectToPeripheral(nextEntry[0], nextEntry[1]);
                } else {
                    // resume noble scan after disconnect
                    console.log("No pending connection requests. Resuming noble scan after disconnect.");
                    this._startNobleScan();
                }
            });
    }

    discoverServices(peripheral, uuids) {
        return peripheral.discoverServicesAsync(uuids);
    }

    discoverServicesAndCharacteristics(peripheral, serviceUUIDs, characteristicUUIDs) {
        return peripheral.discoverSomeServicesAndCharacteristicsAsync(serviceUUIDs, characteristicUUIDs);
    }

    discoverCharacteristics(service, uuids) {
        return service.discoverCharacteristicsAsync(uuids);
    }

    // TODO check if this works
    readCharacteristic(characteristic) {
        return characteristic.readAsync()
            .then(buffer => Array.prototype.slice.call(buffer));
    }

    writeCharacteristic(characteristic, data) {
        return characteristic.writeAsync(new Buffer(data), false);
    }
}

module.exports = BleScanner;