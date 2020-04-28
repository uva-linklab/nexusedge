
var noble = require('@abandonware/noble');

var pizzaServiceUuid = '13333333333333333333333333333337';
var pizzaCrustCharacteristicUuid = '13333333333333333333333333330001';

noble.on('stateChange', function(state) {
    if (state === 'poweredOn') {
        //
        // Once the BLE radio has been powered on, it is possible
        // to begin scanning for services. Pass an empty array to
        // scan for all services (uses more time and power).
        //
        console.log('scanning...');
        noble.startScanning([pizzaServiceUuid], false);
    }
    else {
        noble.stopScanning();
    }
});

var pizzaService = null;
var pizzaCrustCharacteristic = null;

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
        peripheral.discoverServices([], function(err, services) {

            console.log("discovered services:");
            console.log(services);

            services.forEach(function(service) {
                //
                // This must be the service we were looking for.
                //
                console.log('found service:', service.uuid);

                //
                // So, discover its characteristics.
                //
                service.discoverCharacteristics([], function(err, characteristics) {

                    characteristics.forEach(function(characteristic) {
                        //
                        // Loop through each characteristic and match them to the
                        // UUIDs that we know about.
                        //
                        console.log('found characteristic:', characteristic.uuid);

                        if (pizzaCrustCharacteristicUuid === characteristic.uuid) {
                            pizzaCrustCharacteristic = characteristic;
                        }
                    });

                    //
                    // Check to see if we found all of our characteristics.
                    //
                    if (pizzaCrustCharacteristic) {
                        //
                        // We did, so bake a pizza!
                        //
                        bakePizza();
                    }
                    else {
                        console.log('missing characteristics');
                    }
                })
            })
        })
    })
});

function bakePizza() {
    var buff = Buffer.from('abcdef');

    console.log("about to write to characteristic");
    console.log(pizzaCrustCharacteristic);
    pizzaCrustCharacteristic.write(buff, false, function(err) {
        if (!err) {
            console.log("write complete. got callback.")
        }
        else {
            console.log('write error');
        }
    });
}