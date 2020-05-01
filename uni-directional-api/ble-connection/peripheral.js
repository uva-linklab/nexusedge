var bleno = require('@abandonware/bleno');

var TalkToManagerService = require('./talk-to-manager-service');

//TODO move to gateway-scanner
var name = 'TalkToManager';
var talkToManagerService = new TalkToManagerService();

//
// Wait until the BLE radio powers on before attempting to advertise.
// If you don't have a BLE radio, then it will never power on!
//
bleno.on('stateChange', function(state) {
    if(state === 'poweredOn') {
        //
        // We will also advertise the service ID in the advertising packet,
        // so it's easier to find.
        //
        console.log("here");

        bleno.startAdvertising(name, [talkToManagerService.uuid], function(err) {
            if(err) {
                console.log(err);
            }
        });
    } else {
        bleno.stopAdvertising();
    }
});

bleno.on('advertisingStart', function(err) {
    if(!err) {
        console.log('advertising...');
        //
        // Once we are advertising, it's time to set up our services,
        // along with our characteristics.
        //

        /*
        Note: make sure you stop the bluetooth service and then power up the adapter. Otherwise the peripheral does
        not accept connections for BlueZ >= 5.14.

        sudo systemctl stop bluetooth
        sudo hciconfig hci0 up

        https://github.com/noble/bleno/issues/24
         */

        bleno.setServices([
            talkToManagerService
        ]);
    }
});