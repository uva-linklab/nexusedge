/*
use abandonware forks of noble and bleno because the original repos are not maintained and do not work with node.js
versions 8 and above.
https://github.com/noble/node-bluetooth-hci-socket/issues/84
*/
const noble = require('@abandonware/noble');

// uuid -> callback function
const subscriberCallbackMap = {};

// This stores pending connection requests if BLE is already connected to a peripheral.
const connectionQueue = []; // [peripheral]

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
    /**
     * Obtain the MAC address of the ble chip
     * @returns MAC address of the BLE chip
     */
    getMacAddress() {
        return noble.address;
    }

    /**
     * Start the BLE scan if the scanner is already initialized. If not, performs initialization, and then starts scan.
     */
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

    /**
     * Get a callback when there is an advertisement for the specified UUID
     * @param uuid
     * @param callback
     */
    subscribeToAdvertisements(uuid, callback) {
        if(!subscriberCallbackMap.hasOwnProperty(uuid)) {
            subscriberCallbackMap[uuid] = callback;
        }
    }

    /**
     * Connect to a specified peripheral. If BLE is already connected to a peripheral, add this peripheral to a queue.
     * @param peripheral
     * @returns {Promise<void>} Returns a promise which resolves after a connection is established
     */
    connectToPeripheralAsync(peripheral) {
        return new Promise( (resolve, reject) => {
            // check if the ble module is already connected to a peripheral
            if(!this.isConnectedToPeripheral) {
                this.isConnectedToPeripheral = true;

                /*
                If the peripheral scan continues while we are performing operations on characteristics, there could be
                race conditions. So we stop the scan, perform the operations and then restart the noble scan.
                */
                console.log("[ble-scanner] Stopping noble scan before connect.");
                this.stopScanning();

                peripheral.connect(err => {
                   if(err) {
                       reject(err);
                   } else {
                       resolve();
                   }
                });

                /*
                Generally after a write request completes, the connection automatically disconnects after 1-2 seconds.
                So we wait till the disconnection event occurs, and then connect to a peripheral that is in queue.
                If there are no peripherals in queue, we resume BLE scanning.
                */
                peripheral.once('disconnect', () => {
                    console.log("[ble-scanner] Peripheral disconnected");
                    this.isConnectedToPeripheral = false;

                    // check if there are other peripheral connection requests
                    if(connectionQueue.length > 0) {
                        // TODO check if this is a bottleneck
                        const nextPeripheral = connectionQueue.shift(); // get next peripheral
                        console.log("[ble-scanner] Picked up next peripheral to connect to.");
                        return this.connectToPeripheral(nextPeripheral);
                    } else {
                        // resume noble scan after disconnect
                        console.log("[ble-scanner] No pending connection requests. Resuming noble scan after disconnect.");
                        this.startScanning();
                    }
                });
            } else {
                // If already connected, add to the connectionQueue. Process next peripheral when there is a disconnection.
                connectionQueue.push(peripheral);
                console.log("[ble-scanner] BLE already connected to some peripheral. Added to connectionQueue");
            }
        });
    }

    /**
     * Disconnects the peripheral
     * @param peripheral
     * @returns {Promise<void>}
     */
    disconnectPeripheral(peripheral) {
        return peripheral.disconnectAsync();
    }

    /**
     * Discover services for the peripheral with specified service UUIDs
     * @param peripheral
     * @param uuids
     * @returns {Promise<Service[]>}
     */
    discoverServices(peripheral, uuids) {
        return peripheral.discoverServicesAsync(uuids);
    }

    /**
     * Discover services and characteristics for the peripheral with the specified service and characteristic UUIDs
     * @param peripheral
     * @param serviceUUIDs
     * @param characteristicUUIDs
     * @returns {Promise<ServicesAndCharacteristics>} type -> {services: [], characteristics: []}
     */
    discoverServicesAndCharacteristics(peripheral, serviceUUIDs, characteristicUUIDs) {
        return peripheral.discoverSomeServicesAndCharacteristicsAsync(serviceUUIDs, characteristicUUIDs);
    }

    /**
     * Discover characteristics for a given service
     * @param service
     * @param uuids
     * @returns {Promise<Characteristic[]>}
     */
    discoverCharacteristics(service, uuids) {
        return service.discoverCharacteristicsAsync(uuids);
    }

    /**
     * Read the given characteristic and return the value
     * @param characteristic
     * @returns {Promise<value[]>}
     */
    readCharacteristic(characteristic) {
        return characteristic.readAsync()
            .then(buffer => Array.prototype.slice.call(buffer)); // convert buffer to array
        // Reference: https://stackoverflow.com/a/42953533
    }

    /**
     * Writes data to the specified characteristic
     * @param characteristic
     * @param data
     */
    writeCharacteristic(characteristic, data) {
        // Note: For some reason, this promise never gets resolved. So we do not want to wait for the resolution.
        characteristic.writeAsync(Buffer.from(data, 'utf8'), false);
    }
}

module.exports = BleScanner;