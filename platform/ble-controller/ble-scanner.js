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
        this.initialized = false;
        this.isConnectedToPeripheral = false;
    }

    _initialize() {
        noble.on('stateChange', state => {
            console.log('[ble-scanner] BLE state change: ' + state);
            if(state === 'poweredOn') {
                console.log('[ble-scanner] BLE is powered on.');
                this.startScanning();
            } else if(state === 'poweredOff') {
                console.log('[ble-scanner] BLE appears to be disabled.');
            } else if(state === 'scanStop') {
                console.log('[ble-scanner] BLE scan stopped.');
            } else if(state === 'scanStart') {
                console.log('[ble-scanner] BLE scan started.');
            }
        });

        noble.on('discover', function(peripheral) {
            const serviceUuids = peripheral.advertisement.serviceUuids;
            if(serviceUuids) {
                Object.keys(subscriberCallbackMap) // get all UUIDs of the subscribers
                    .filter(uuid => serviceUuids.includes(uuid)) // check if current advertisement matches a subscriber's
                    .forEach(uuid => subscriberCallbackMap[uuid](peripheral)); // if so, call the callback function
            }
        });

        this.initialized = true;
    }

    // TODO this does not work if initialize is not complete. Also, rather than picking up the gateway address from ble-scanner
    //  for the gateway address, the handlers should be asking the platform directly
    getMacAddress() {
        return noble.address;
    }

    startScanning() {
        if(!this.initialized) {
            this._initialize(); // initializes noble and starts scanning once the noble state changes to poweredOn
        } else {
            noble.startScanning([], true);
        }
    }

    stopScanning() {
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

            /*
            If the peripheral scan continues while we are performing operations on characteristics, there could be
            race conditions. So we stop the scan, perform the operations and then restart the noble scan.
            */
            console.log("[ble-scanner] Stopping noble scan before connect.");
            this.stopScanning();

            peripheral.connect(callback);

            /*
            Generally after a write request completes, the connection automatically disconnects after 1-2 seconds.
            So we wait till the disconnection event occurs, and then connect to a peripheral that is in queue.
            If there are no peripherals in queue, we resume BLE scanning.
            */
            peripheral.once('disconnect', () => {
                console.log("[ble-scanner] Peripheral disconnected");
                this.isConnectedToPeripheral = false;

                // check if there are other peripheral connection requests
                if(connectionQueue.size > 0) {
                    const nextEntry = connectionQueue.entries().next().value; // get next [peripheral, callback]
                    connectionQueue.delete(nextEntry[0]); // remove from queue
                    this.connectToPeripheral(nextEntry[0], nextEntry[1]);

                    console.log("[ble-scanner] Picked up next peripheral to connect to.");
                } else {
                    // resume noble scan after disconnect
                    console.log("[ble-scanner] No pending connection requests. Resuming noble scan after disconnect.");
                    this.startScanning();
                }
            });
        } else {
            console.log("[ble-scanner] BLE already connected to some peripheral. Added to connectionQueue");

            // If already connected, add to the connectionQueue. Process next peripheral when there is a disconnection.
            connectionQueue.set(peripheral, callback);
        }
    }

    disconnectPeripheral(peripheral, callback) {
        peripheral.disconnectAsync()
            .then(callback);
    }

    discoverServices(peripheral, uuids, callback) {
        peripheral.discoverServicesAsync(uuids)
            .then(callback);
    }

    discoverServicesAndCharacteristics(peripheral, serviceUUIDs, characteristicUUIDs, callback) {
        peripheral.discoverSomeServicesAndCharacteristics(serviceUUIDs, characteristicUUIDs, callback);
    }

    discoverCharacteristics(service, uuids, callback) {
        service.discoverCharacteristicsAsync(uuids)
            .then(callback);
    }

    // TODO only async implementation. check if this works.
    readCharacteristic(characteristic) {
        return characteristic.readAsync()
            .then(buffer => Array.prototype.slice.call(buffer));
    }

    writeCharacteristic(characteristic, data) {
        // this callback is used only if the notify flag is set to true
        characteristic.write(Buffer.from(data, 'utf8'), false, () => {
        });
    }
}

module.exports = BleScanner;