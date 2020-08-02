/*
// TODO add which make of lighting sensors we are using
Parses BLE packets from Lighting Sensor
 */
const BleController = require('ble-controller');
const bleController = BleController.getInstance();

class LightingSensorHandler {
    constructor(handlerId) {
        this.handlerId = handlerId;
        this.deviceType = "Lighting Sensor";
        this.scanPaused = false;
    }

    start(platformCallback) {
        this.platformCallback = platformCallback;

        // TODO uncomment once the UUID for the lighting sensors are figured out
        // bleController.initialize().then(() => {
        //     bleController.subscribeToAdvertisements(..., this._handlePeripheral.bind(this));
        //     this._startScan();
        // });
    }

    //TODO: get actual data from the lighting sensors and not just its metadata
    _handlePeripheral(peripheral) {
        // handle peripherals only during the time periods define in startScan and stopScan
        if(this.scanPaused) {
            return;
        }

        const data = {};
        data["device"] = this.deviceType;
        data["id"] = peripheral.id;
        data["_meta"] = {
            "received_time": new Date().toISOString(),
            "device_id": peripheral.id,
            "receiver": "ble-peripheral-scanner",
            "gateway_id": bleController.getMacAddress()
        };

        this.platformCallback.deliver(this.handlerId, data);
    }

    _startScan() {
        this.scanPaused = false;
        setTimeout(this._stopScan.bind(this), 60000); // scan for 1min
        console.log("Start handling peripherals");
    }

    _stopScan() {
        this.scanPaused = true;
        setTimeout(this._startScan.bind(this), 180000); // scan every 3mins
        console.log("Stopped handling peripherals");
    }
}

module.exports = LightingSensorHandler;