var noble = require('noble');
var aes_crypto = require('../gateway_code/aes_crypto');

var password = "95CFEF1B1F1F5FAAC6954BC1BD713081";
var iv = "6F2E2CEE52C1AB42";

noble.on('stateChange', function(state) {
  if (state === 'poweredOn') {
    noble.startScanning();
  } else {
    noble.stopScanning();
  }
});

noble.on('discover', handleDiscoveredPeripheral);

function handleDiscoveredPeripheral(peripheral) {
  console.log("Found " + peripheral.address);
  if (!peripheral.advertisement.manufacturerData) {
    console.log("no manufacturerData");
    
    const localName = peripheral.advertisement.localName;
    var data = localName.toString('utf8');
    console.log(data);
    var ip = aes_crypto.decrypt(data,password,iv);
    console.log("decrypted = " + ip);
    if(isValidIPAddress(ip)) {
      console.log("valid ip");
    } else {
      console.log("invalid ip");
    }
  }
}

function isValidIPAddress(ipaddress) {  
  if (/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ipaddress)) {  
    return (true);  
  }  
  return (false);  
}  