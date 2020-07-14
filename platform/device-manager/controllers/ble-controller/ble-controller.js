const bleno = require('@abandonware/bleno');

let instance = null;

class BleController {
    constructor() {
        this.blenoInitialized = false;
        this.nobleInitialized = false;
    }

    static getInstance() {
        if(!instance) {
            instance = new BleController();
        }
        return instance;
    }

    _initializeBleno() {
        return new Promise(resolve => {
            if(this.blenoInitialized) {
                resolve();
            } else {
                bleno.on('stateChange', (state) => {
                    if(state === 'poweredOn') {
                        this.blenoInitialized = true;
                        resolve();
                    } else if(state === 'poweredOff') {
                        bleno.stopAdvertising();
                    } else {
                        console.log("[BLE Radio] bleno state changed to " + state);
                    }
                });
            }
        });
    }

    _initializeNoble() {
        return new Promise(resolve => {
            if(this.nobleInitialized) {
                resolve();
            } else {
                noble.on('stateChange', state => {
                    if(state === 'poweredOn') {
                        console.log('[ble-scanner] BLE is powered on.');
                        this.nobleInitialized = true;
                        resolve();
                    } else if(state === 'poweredOff') {
                        console.log('[ble-scanner] BLE appears to be disabled.');
                    } else if(state === 'scanStop') {
                        console.log('[ble-scanner] BLE scan stopped.');
                    } else if(state === 'scanStart') {
                        console.log('[ble-scanner] BLE scan started.');
                    }
                });
            }
        });
    }

    initialize() {
        return this._initializeBleno().then(() => {
            return this._initializeNoble()
        });
    }

    advertise(name, serviceUuids, services) {
        console.log("started advertising");
        bleno.startAdvertising(name, serviceUuids, function(err) {
            if(err) {
                console.log(err);
            } else {
                bleno.setServices(services);
                console.log("set services");
            }
        });
    }
}

module.exports = BleController;