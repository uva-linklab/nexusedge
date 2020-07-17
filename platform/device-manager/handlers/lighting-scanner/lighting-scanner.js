/*
// TODO add which make of lighting sensors we are using
Parses BLE packets from Lighting Sensor and publishes to the gateway-data MQTT topic
 */
const MqttController = require('../../../../utils/mqtt-controller');

class LightingScanner {
    constructor(platformCallback) {
        this.deviceType = "Lighting Sensor";
        this.bleScanner = platformCallback;
        this.mqttController = MqttController.getInstance();
        this.scanPaused = false;

        // TODO uncomment once the UUID for the lighting sensors are figured out
        // this.bleScanner.subscribeToAdvertisements(..., this._handlePeripheral.bind(this));
        // this._startScan();

        console.log(`in lighting-scanner -> received platformCallback ${platformCallback}`);
    }

    //TODO: get actual data from the lighting sensors and not just its metadata
    handlePeripheral(peripheral) {
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
            "gateway_id": this.bleScanner.getMacAddress()
        };

        this.mqttController.publishToPlatformMqtt(JSON.stringify(data)); // publish to the platform's default MQTT topic
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

module.exports = LightingScanner;