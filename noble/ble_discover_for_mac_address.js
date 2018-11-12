var noble = require('noble');
var aes_crypto = require('../gateway_code/aes_crypto');

mac_address = process.argv[2];
var password = "95CFEF1B1F1F5FAAC6954BC1BD713081";
var iv = "6F2E2CEE52C1AB42";

noble.on('stateChange', function(state) {
  if (state === 'poweredOn') {
    noble.startScanning();
  } else {
    noble.stopScanning();
  }
});

noble.on('discover', function(peripheral) {
  //console.log(peripheral.address);
  if(peripheral.address === mac_address) {
    console.log('peripheral discovered (' + peripheral.id +
              ' with address <' + peripheral.address +  ', ' + peripheral.addressType + '>,' +
              ' connectable ' + peripheral.connectable + ',' +
              ' RSSI ' + peripheral.rssi + ':');
    console.log('\thello my local name is:');
    console.log('\t\t' + peripheral.advertisement.localName);
    console.log('\tcan I interest you in any of the following advertised services:');
    console.log('\t\t' + JSON.stringify(peripheral.advertisement.serviceUuids));

    var serviceData = peripheral.advertisement.serviceData;
    if (serviceData && serviceData.length) {
      console.log('\there is my service data:');
      for (var i in serviceData) {
        console.log('\t\t' + JSON.stringify(serviceData[i].uuid) + ': ' + JSON.stringify(serviceData[i].data.toString('hex')));
      }
    }
    if (peripheral.advertisement.manufacturerData) {
      console.log('\there is my manufacturer data:');
      var data = peripheral.advertisement.manufacturerData.toString('utf8');
      console.log(data);
      console.log("decrypted = " + aes_crypto.decrypt(data,password,iv));

    }
    if (peripheral.advertisement.txPowerLevel !== undefined) {
      console.log('\tmy TX power level is:');
      console.log('\t\t' + peripheral.advertisement.txPowerLevel);
    }

    console.log();
  }
});
