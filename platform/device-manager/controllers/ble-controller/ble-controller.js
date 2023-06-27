// For noble and bleno to work in tandem
// Reference: https://github.com/noble/noble#bleno-compatibility
process.env.NOBLE_MULTI_ROLE = 1;

/*
use abandonware forks of noble and bleno because the original repos are not maintained and do not work with node.js
versions 8 and above.
https://github.com/noble/node-bluetooth-hci-socket/issues/84
*/
const bleno = require('@abandonware/bleno');
const noble = require('@nabeeln7/noble');
const debug = require('debug')('ble-controller');
const EddystoneBeaconParser = require('./edystone-beacon-parser');
const eddystoneBeaconParser = EddystoneBeaconParser.getInstance();

let subscriberCount = 0;
class Subscriber {
    constructor(id, predicateFn, callbackFn) {
        this.id = id;
        this.predicateFn = predicateFn;
        this.callbackFn = callbackFn;
    }
}
let subscribers = [];

// This stores pending connection requests if BLE is already connected to a peripheral.
const connectionQueue = []; // [peripheral]

const initializeQueue = [];

let instance = null;

class BleController {
    constructor() {
        this._initialized = false;
        this._initializing = false;
    }

    static getInstance() {
        if(!instance) {
            instance = new BleController();
        }
        return instance;
    }

    _initializeBleno() {
        return new Promise(resolve => {
            bleno.on('stateChange', (state) => {
                if(state === 'poweredOn') {
                    debug('[ble-scanner] BLE powered on. Bleno initialized.');
                    resolve();
                } else if(state === 'poweredOff') {
                    debug('[ble-scanner] BLE appears to be disabled.');
                    bleno.stopAdvertising();
                } else {
                    debug("[BLE Radio] bleno state changed to " + state);
                }
            });
        });
    }

    _initializeNoble() {
        return new Promise(resolve => {
            noble.on('stateChange', state => {
                if(state === 'poweredOn') {
                    debug('[ble-scanner] BLE powered on. Noble initialized.');
                    this.startScanning();

                    noble.on('discover', function(peripheral) {
                        // TODO: some optimization needed? keeps on applying predicate fns
                        //  to peripherals
                        if(peripheral && peripheral.advertisement) {
                            subscribers.forEach(subscriber => {
                                if(subscriber.predicateFn(peripheral)) {
                                    subscriber.callbackFn(peripheral);
                                }
                            });
                        }
                    });

                    resolve();
                } else if(state === 'poweredOff') {
                    debug('[ble-scanner] BLE appears to be disabled.');
                    this.stopScanning();
                } else if(state === 'scanStop') {
                    debug('[ble-scanner] BLE scan stopped.');
                } else if(state === 'scanStart') {
                    debug('[ble-scanner] BLE scan started.');
                }
            });
        });
    }

    /**
     * Async function to initialize bleno and noble modules to advertise and scan over BLE
     * @return {Promise<unknown>}
     */
    initialize() {
        return new Promise(resolve => {
            // if initialized, then return immediately
            if(this._initialized) {
                resolve();
            } else if(this._initializing) { // if initialization underway, then wait in queue
                initializeQueue.push(resolve);
            } else {
                this._initializing = true;
                this._initializeBleno().then(() => this._initializeNoble().then(() => {
                    resolve();
                    this._initializing = false;
                    this._initialized = true;

                    // resolve all pending promises
                    initializeQueue.forEach(resolveFn => resolveFn());
                }))
            }
        })
    }

    advertise(localName, serviceUuids, services) {
        debug("started advertising");
        bleno.startAdvertising(localName, serviceUuids, function(err) {
            if(err) {
                debug(err);
            } else {
                bleno.setServices(services);
                debug("set services");
            }
        });
    }

    stopAdvertisingAndScanning() {
        bleno.stopAdvertising();
        this.stopScanning();
    }

    // noble related

    // TODO rather than picking up the gateway address from ble-scanner
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
        noble.startScanning([], true);
    }

    stopScanning() {
        noble.stopScanning();
    }

    /**
     * Get notified about BLE peripherals using a custom predicate function to filter
     * There are some handy functions built on top of this which can filter based on uuid,
     * name, etc.
     * @param predicateFn Custom function of the type peripheral -> {true|false}
     * @param callback function of the type peripheral -> void
     */
    getPeripheralsWithPredicate(predicateFn, callback) {
        // check if the types are proper
        if(typeof predicateFn === 'function' && typeof callback === 'function') {
            // generate a new subscriber object for this subscriber
            const subscriber = new Subscriber(subscriberCount++, predicateFn, callback);

            // keep track of this subscriber
            subscribers.push(subscriber);
        }
    }

    /**
     * Get notified about BLE peripherals that have a specific service UUID
     * @param uuid
     * @param callback
     */
    getPeripheralsWithUuid(uuid, callback) {
        this.getPeripheralsWithPredicate(peripheral => {
            const serviceUuids = peripheral.advertisement.serviceUuids;
            return serviceUuids && serviceUuids.includes(uuid);
        }, callback);
    }

    /**
     * Get notified about BLE peripherals that have a specific local name
     * @param name
     * @param callback
     */
    getPeripheralsWithName(name, callback) {
        this.getPeripheralsWithPredicate(peripheral => {
            const localName = peripheral.advertisement.localName;
            return localName === name;
        }, callback);
    }

    /**
     * Get notified about BLE peripherals which use the Eddystone beacon format
     * @param callback provides the beacon and peripheral objects
     */
    getEddystonePeripherals(callback) {
        this.getPeripheralsWithUuid('feaa', peripheral => {
            const beacon = eddystoneBeaconParser.parse(peripheral);
            if(beacon != null) {
                callback(beacon, peripheral);
            }
        });
    }

    /**
     * Connect to a specified peripheral. If BLE is already connected to a peripheral, add this peripheral to a queue.
     * @param peripheral
     * @returns {Promise<void>} Returns a promise which resolves after a connection is established
     */
    connectToPeripheralAsync(peripheral) {
        return new Promise((resolve, reject) => {
            // check if the ble module is already connected to a peripheral
            if(!this.isConnectedToPeripheral) {
                this.isConnectedToPeripheral = true;

                /*
                If the peripheral scan continues while we are performing operations on characteristics, there could be
                race conditions. So we stop the scan, perform the operations and then restart the noble scan.
                */
                debug("[ble-scanner] Stopping noble scan before connect.");
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
                    debug("[ble-scanner] Peripheral disconnected");
                    this.isConnectedToPeripheral = false;

                    // check if there are other peripheral connection requests
                    if(connectionQueue.length > 0) {
                        // TODO check if this is a bottleneck
                        const nextPeripheral = connectionQueue.shift(); // get next peripheral
                        debug("[ble-scanner] Picked up next peripheral to connect to.");
                        return this.connectToPeripheralAsync(nextPeripheral);
                    } else {
                        // resume noble scan after disconnect
                        debug("[ble-scanner] No pending connection requests. Resuming noble scan after disconnect.");
                        this.startScanning();
                    }
                });
            } else {
                // If already connected, add to the connectionQueue. Process next peripheral when there is a disconnection.
                connectionQueue.push(peripheral);
                debug("[ble-scanner] BLE already connected to some peripheral. Added to connectionQueue");
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

    discoverAllServicesAndCharacteristics(peripheral) {
        return peripheral.discoverAllServicesAndCharacteristicsAsync();
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
     * Subscribe for notifications/indications from a characteristic
     * @param characteristic
     * @return {Promise<void>}
     */
    subscribeToCharacteristic(characteristic) {
        return characteristic.subscribeAsync();
    }

    /**
     * Unsubscribe from notifications/indications from a characteristic
     * @param characteristic
     * @return {Promise<void>}
     */
    unsubscribeFromCharacteristic(characteristic) {
        return characteristic.unsubscribeAsync();
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

    /**
     * Writes specified data to a writeCharacteristic and returns a promise based on
     * the response received as a notification from a reply characteristic.
     * @param data array containing the UTF-8 bytes
     * @param writeCharacteristic characteristic to write to
     * @param replyCharacteristic characteristic which gives a notification after the write
     * @return {Promise<void>}
     */
    async writeAndAwaitNotification(data, writeCharacteristic, replyCharacteristic) {
        return new Promise((resolve, reject) => {
            replyCharacteristic.once('read', function(replyData, isNotification) {
                resolve();
            });
            // instead of awaiting on writeAsync, we wait for the replyCharacteristic notification
            writeCharacteristic.writeAsync(Buffer.from(data, 'utf8'), false);
        });
    }
}

module.exports = BleController;