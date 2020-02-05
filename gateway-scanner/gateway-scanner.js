process.env.NOBLE_MULTI_ROLE = 1;

var noble = require('noble');
var bleno = require('bleno');
var fs = require('fs');
var debug = require('debug')('gateway-scanner');
var mongoClient = require('mongodb').MongoClient;
var aesCrypto = require("./aes-crypto");
var utils = require("../utils/utils");

ipAddress = utils.getIPAddress();

const mongoUrl = 'mongodb://localhost:27017';
const discoveryDbName = 'discovery';

paramsFileName = "group-key.json";
paramsFilePath = __dirname + "/" + paramsFileName;
key = "";
iv = "";

var blackList = [];

if(!ipAddress) {
  console.log("No IP address found. Please ensure the config files are set properly.");
  process.exit(1);
}

debug(`IP Address = ${ipAddress}`);

// Initialize db connection once
var db;
mongoClient.connect(mongoUrl, { useNewUrlParser: true }, function(err, client) {
  if(err) throw err;

  db = client.db(discoveryDbName);
});

bleno.on('stateChange', handleBlenoStateChange);
bleno.on('advertisingStop', function() {
  debug("[BLE Radio] Bleno advertisement stopped");
});
bleno.on('advertisingStartError', function(error) {
  debug("[BLE Radio] Bleno advertisingStartError:");
});

function getGroupKeyParams() {
  if (!fs.existsSync(paramsFilePath)) {
    return "";
  } else {
    var data = fs.readFileSync(paramsFilePath, 'utf-8');
    var keyParams = JSON.parse(data);
    return keyParams;
  }
}

function handleBlenoStateChange(state) {
  if (state === 'poweredOn') {
    debug("[BLE Radio] BLE MAC Address = " + bleno.address);
    var groupKeyParams = getGroupKeyParams();
    if(!groupKeyParams) {
      console.log(`Group key params not found in ${paramsFilePath}. Please refer to setup instructions in the readme file.`);
      process.exit(1);
    }

    key = groupKeyParams.key;
    iv = groupKeyParams.iv;
    startAdvertising();

    saveIPAddress(bleno.address, ipAddress);

    //start discovering BLE peripherals
    //we do noble's listener initialization here as there's a dependency on key and iv
    noble.on('stateChange', handleNobleStateChange);
    noble.on('discover', handleDiscoveredPeripheral);
    noble.on('scanStop', function() {
      debug("[BLE Radio] Noble scan stopped");
    });
    noble.on('warning', function (message) {
      debug(`[BLE Radio] Noble warning:${message}`);
    });
  } else if (state === 'poweredOff') {
    bleno.stopAdvertising();
  } else {
    debug("[BLE Radio] bleno state changed to " + state);
  }
}

function handleNobleStateChange(state) {
  if (state === 'poweredOn') {
    noble.startScanning([], true);
    debug("[BLE Radio] Started peripheral discovery");
  } else if(state === 'poweredOff'){
    noble.stopScanning();
  } else {
    debug("[BLE Radio] noble state changed to " + state);
  }
}

function handleDiscoveredPeripheral(peripheral) {
  if(blackList.includes(peripheral.address)) {
    return;
  }

  if (!peripheral.advertisement.manufacturerData) {
    const localName = peripheral.advertisement.localName;
    if(typeof localName === "undefined") {
      debug(`[BLE Radio] blacklisted ${peripheral.address}`);
      blackList.push(peripheral.address);
    } else {
      var data = localName.toString('utf8');
      var discoveredIp = aesCrypto.decrypt(data, key, iv);
      if(isValidIPAddress(discoveredIp)) {
        debug("[BLE Radio] Peripheral discovered: " + peripheral.address);
        debug(`[BLE Radio] IP Address = ${discoveredIp}`);
        saveNeighborDataToDB(peripheral.address, discoveredIp);
      } else {
        debug(`[BLE Radio] blacklisted ${peripheral.address}`);
        blackList.push(peripheral.address);
      }
    }
  }
}

function isValidIPAddress(ipaddress) {
  return (/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ipaddress));
}

/*
The advertisement data payload consists of several AD structures.
Each AD structure has a length field (1 byte), AD Type (1 byte), and the data corresponding to the AD type.
Length => Number of bytes for the AD type and the actual data (excluding the length byte itself).
AD type =>
As defined here: https://www.bluetooth.com/specifications/assigned-numbers/generic-access-profile/

Packet format:
https://www.libelium.com/forum/libelium_files/bt4_core_spec_adv_data_reference.pdf
*/
function startAdvertising() {
  var encryptedIp = aesCrypto.encrypt(ipAddress, key, iv);

  //create a buffer for the payload.
  //buffer size = 2 bytes for length and AD type + byte size of the encrypted-ip
  const bufferSize = 2 + encryptedIp.length;
  var advertisementData = new Buffer(bufferSize);

  //payload length = 1 byte for AD type + rest for the actual data.
  const payloadLength = 1 + encryptedIp.length;

  //Write it at the byte position 0 of the buffer. Since the length is stored in 1 byte, use writeUInt8
  advertisementData.writeUInt8(payloadLength, 0);

  //AD type – 0x09 = complete local name
  advertisementData.writeUInt8(0x09, 1);

  //write the actual data
  advertisementData.write(encryptedIp, 2);

  bleno.startAdvertisingWithEIRData(advertisementData);
  debug(`[BLE Radio] Started Advertising with encrypted data = ${encryptedIp}`);
}

function saveIPAddress(name, ip) {
  db.collection('self').updateOne(
      { "_id" : name },
      { $set: { "_id": name, "IP_address": ip, "ts" : Date.now()} },
      { upsert: true },
      function(err, result) {
        debug("recorded id and IP of self to db");
      }
    );
}

function saveNeighborDataToDB(peripheralName, peripheralIp) {
  db.collection('neighbors').updateOne(
      { "_id" : peripheralName },
      { $set: { "_id": peripheralName, "IP_address": peripheralIp, "ts" : Date.now()} },
      { upsert: true },
      function(err, result) {
        debug("datapoint stored to db");
      }
    );
}