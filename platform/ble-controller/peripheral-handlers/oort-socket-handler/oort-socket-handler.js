/*
Connects and controls the OORT/WiTenergy Smart Socket
 */

const OORT_SERVICE_INFO_UUID = '180a';
const OORT_SERVICE_SENSOR_UUID = '0000fee0494c4f474943544543480000';

const OORT_CHAR_SYSTEMID_UUID = '2a23';

const OORT_CHAR_CLOCK_UUID = '0000fee3494c4f474943544543480000';
const OORT_CHAR_SENSOR_UUID = '0000fee1494c4f474943544543480000';
const OORT_CHAR_CONTROL_UUID = '0000fee2494c4f474943544543480000';

class OortSocketHandler {
    constructor() {
        this.onDiscoveredPeripheral = null;
        this.onDisconnect = null;
        this.isConnecter = true;
        this.data = null;
    }

    handlePeripheral(peripheral) {
        if(peripheral.advertisement.serviceUuids.includes(OORT_SERVICE_SENSOR_UUID)) {

            console.log(peripheral);
            // peripheral.connect(function (err) {
            //     if (err) {
            //         console.log('Unable to connect to peripheral ' + err);
            //     } else {
            //         console.log('OORT: connected');
            //         peripheral.discoverServices(this.peripheral, [OORT_SERVICE_INFO_UUID, OORT_SERVICE_SENSOR_UUID]);
            //     }
            // })

            // trying the async version of noble
            // peripheral.connectAsync()
            //     .then(_ => {
            //         peripheral.discoverServicesAsync([OORT_SERVICE_INFO_UUID, OORT_SERVICE_SENSOR_UUID])
            //             .then(services => {
            //
            //             })
            //     });
        }
    }

    connectToPeripheral(data, onDiscoveredPeripheral, onDisconnect) {
        this.onDiscoveredPeripheral = onDiscoveredPeripheral;
        this.onDisconnect = onDisconnect;

        // understand what to do with the peripheral
        /*
        {
            "power": "on"
        }
         */
        const powerOn = (data["power"] === "on");

        if(powerOn) {

        }
    }
}

module.exports = OortSocketHandler;