/*
Connects and controls the OORT/WiTenergy Smart Socket
 */

const OORT_SERVICE_INFO_UUID = '180a';
const OORT_SERVICE_SENSOR_UUID = '0000fee0494c4f474943544543480000';

const OORT_CHAR_SYSTEMID_UUID = '2a23';

const OORT_CHAR_CLOCK_UUID = '0000fee3494c4f474943544543480000';
const OORT_CHAR_SENSOR_UUID = '0000fee1494c4f474943544543480000';
const OORT_CHAR_CONTROL_UUID = '0000fee2494c4f474943544543480000';

let oortSensorCharacteristic = null;
let oortClockCharacteristic = null;

class OortSocketHandler {
    constructor() {
        this.deviceId = null;
        this.onDiscoveredPeripheral = null;
        this.onFinish = null;
        this.isConnecter = true;
        this.scanPaused = false;
        this.socketState = false;
    }

    async handlePeripheral(peripheral) {
        if(this.scanPaused) {
            return;
        }

        if(peripheral.advertisement.serviceUuids.includes(OORT_SERVICE_SENSOR_UUID) && peripheral.id === this.deviceId) {
            this.scanPaused = true;

            // notify the ble-controller that you have discovered the peripheral
            this.onDiscoveredPeripheral();

            // set the socket state to the one conveyed by ble-controller
            await this._setOortState(peripheral, this.socketState);

            // notify ble-controller that you've finished
            this.onFinish();

            this.scanPaused = false;
        }
    }

    connectToPeripheral(deviceId, data, onDiscoveredPeripheral, onFinish) {
        this.deviceId = deviceId;
        this.onDiscoveredPeripheral = onDiscoveredPeripheral;
        this.onFinish = onFinish;
        // understand what to do with the peripheral
        /*
        {
            "state": "on"
        }
         */
        // keep track of which state the device needs to be in
        this.socketState = (data["state"] === "on");
    }

    async _initializeOortSocket(peripheral) {
        await peripheral.connectAsync();
        console.log("OORT connected");
        const services = await peripheral.discoverServicesAsync([OORT_SERVICE_INFO_UUID, OORT_SERVICE_SENSOR_UUID]);

        // parse through the services and figure out the "info" and "sensor" service indices
        let infoIndex = -1;
        let sensorIndex = -1;
        for (let i = 0; i < services.length; i++) {
            if (services[i].uuid === OORT_SERVICE_INFO_UUID) {
                infoIndex = i;
            } else if (services[i].uuid === OORT_SERVICE_SENSOR_UUID) {
                sensorIndex = i;
            }
        }

        if (infoIndex === -1) {
            console.error('Could not find a device info service. Can\'t set date.');
            throw 'Could not find a device info service. Can\'t set date.';
        }

        if (sensorIndex === -1) {
            console.error('Could not find sensor service for OORT.');
            throw 'Could not find sensor service for OORT.';
        }

        //get the info characteristics
        const infoChars = await services[infoIndex].discoverCharacteristicsAsync([OORT_CHAR_SYSTEMID_UUID]);

        if (infoChars.length === 0) {
            console.error('Could not get the System ID characteristic.');
            throw 'Could not get the System ID characteristic.';
        }

        const systemId = await infoChars[0].readAsync();
        console.log(systemId);

        // Get the characteristics of the sensor service
        const sensorChars = await services[sensorIndex]
            .discoverCharacteristicsAsync([OORT_CHAR_CLOCK_UUID, OORT_CHAR_SENSOR_UUID]);

        for (let i = 0; i < sensorChars.length; i++) {
            if (sensorChars[i].uuid === OORT_CHAR_CLOCK_UUID) {
                oortClockCharacteristic = sensorChars[i];
            } else if (sensorChars[i].uuid === OORT_CHAR_SENSOR_UUID) {
                oortSensorCharacteristic = sensorChars[i];
            }
        }

        // Upon connection, the clock has to be set in order for the OORT to not call disconnect on the connection
        const now = new Date();
        const dataToSend = [0x03];

        dataToSend.push(now.getFullYear() & 0xFF);
        dataToSend.push((now.getFullYear() >> 8) & 0xFF);
        dataToSend.push(now.getMonth() + 1);
        dataToSend.push(now.getDate());
        dataToSend.push(now.getHours());
        dataToSend.push(now.getMinutes());
        dataToSend.push(now.getSeconds());

        // Calculate this weird unique thing we have to send in order for the device to accept our date.
        const checkSum =
            ('i'.charCodeAt(0) ^ systemId[0]) +
            ('L'.charCodeAt(0) ^ systemId[1]) +
            ('o'.charCodeAt(0) ^ systemId[2]) +
            ('g'.charCodeAt(0) ^ systemId[5]) +
            ('i'.charCodeAt(0) ^ systemId[6]) +
            ('c'.charCodeAt(0) ^ systemId[7]);
        dataToSend.push(checkSum & 0xFF);
        dataToSend.push((checkSum >> 8) & 0xFF);

        // var data = new Buffer([0x03, 0xdf, 0x07, 0x05, 0x1c, 0x16, 0x10, 0x2f, 0x8c, 0x03]);
        // Set the clock on the device
        await oortClockCharacteristic.writeAsync(new Buffer(dataToSend), false);
        console.log('Successfully set the OORT clock.');
    }

    async _setOortState(peripheral, state) {
        await this._initializeOortSocket(peripheral);

        if (oortSensorCharacteristic == null) {
            throw 'No connected OORT. Cannot write.';
        }

        const val = (state) ? 0x1 : 0x0;
        await oortClockCharacteristic.writeAsync(new Buffer([0x4, val]), false);
        console.log(`wrote ${state} to oort`);
    }
}

module.exports = OortSocketHandler;