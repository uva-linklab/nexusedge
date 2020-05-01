const noble = require('@abandonware/noble');

const talkToManagerServiceUuid = '18338db15c5841cca00971c5fd792920';
const messageCharacteristicUuid = '18338db15c5841cca00971c5fd792921';

noble.on('stateChange', function(state) {
    if(state === 'poweredOn') {
        //
        // Once the BLE radio has been powered on, it is possible
        // to begin scanning for services. Pass an empty array to
        // scan for all services (uses more time and power).
        //
        console.log('scanning...');
        noble.startScanning([talkToManagerServiceUuid], false);
    } else {
        noble.stopScanning();
    }
});

let messageCharacteristic = null;

noble.on('discover', function(peripheral) {
    // we found a peripheral, stop scanning
    noble.stopScanning();

    //
    // The advertisment data contains a name, power level (if available),
    // certain advertised service uuids, as well as manufacturer data,
    // which could be formatted as an iBeacon.
    //
    console.log('found peripheral:', peripheral.advertisement);

    //
    // Once the peripheral has been discovered, then connect to it.
    //
    peripheral.connect(function(err) {
        console.log("connected to peripheral");
        //
        // Once the peripheral has been connected, then discover the
        // services and characteristics of interest.
        //
        // specify the services and characteristics to discover
        const serviceUUIDs = [talkToManagerServiceUuid];
        const characteristicUUIDs = [messageCharacteristicUuid];

        peripheral.discoverSomeServicesAndCharacteristics(
            serviceUUIDs,
            characteristicUUIDs,
            onServicesAndCharacteristicsDiscovered
        );
    })
});

function onServicesAndCharacteristicsDiscovered(error, services, characteristics) {
    console.log('Discovered services and characteristics');
    const messageCharacteristic = characteristics[0];

    const msg = {
        "_meta" : {
            "recipient": "manager-name-goes-here"
        },
        "data": {
            "ws-address": process.env.ws_address
        }
    };

    const buff = Buffer.from(JSON.stringify(msg), 'utf8');

    console.log("about to write to characteristic");
    messageCharacteristic.write(buff, false, function(err) {
        if(!err) {
            console.log("write complete. got callback.");
        } else {
            console.log('write error');
        }
    });
}