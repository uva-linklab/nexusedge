var Request = require("request");
var noble = require("noble");
var bleno = require("bleno");
var fs = require('fs');
var aes_crypto = require("./aes_crypto");
const utils = require("../utils/utils")
const MongoClient = require('mongodb').MongoClient;

const scriptDir = __dirname;

register_url = process.argv[2];
ip_addr = utils.getIPAddress();

const mongo_url = 'mongodb://localhost:27017';
const discovery_dbName = 'discovery';

paramsFileName = "params.json"
paramsFilePath = scriptDir + "/" + paramsFileName;
ranging_key = "";
iv = "";

var black_list = [];

if(!register_url){
  console.log("Please provide register url");
  process.exit(1);
}

if(!ip_addr) {
  console.log("No IP address found. Please re-check the utils impl.");
  process.exit(1);
}

utils.logWithTs(`IP Address = ${ip_addr}`);

// Initialize connection once
var db;
MongoClient.connect(mongo_url, { useNewUrlParser: true }, function(err, client) {
  if(err) throw err;

  db = client.db(discovery_dbName);
});

bleno.on('stateChange', handleBlenoStateChange);

function handleBlenoStateChange(state) {
  if (state === 'poweredOn') {
    utils.logWithTs("[BLE Radio] BLE MAC Address = " + bleno.address);
    loadKeyParams(handleKeyParams);
    saveIPAddress(bleno.address, ip_addr);
    
    //start discovering BLE peripherals
    //we do noble's listener initialization here as there's a dependency on ranging key and iv
    noble.on('stateChange', handleNobleStateChange);
    noble.on('discover', handleDiscoveredPeripheral);
  } else if (state === 'poweredOff') {
    bleno.stopAdvertising();
  }
}

function handleNobleStateChange(state) {
  if (state === 'poweredOn') {
    noble.startScanning([], true);
    utils.logWithTs("[BLE Radio] Started peripheral discovery");
  } else {
    noble.stopScanning();
  }
}

function handleDiscoveredPeripheral(peripheral) {
  if(black_list.includes(peripheral.address)) {
    return;
  }

  if (!peripheral.advertisement.manufacturerData) {
    // console.log("[BLE Radio] Peripheral discovered: " + peripheral.address);
    
    const localName = peripheral.advertisement.localName;
    if(typeof localName === "undefined") {
      utils.logWithTs(`[BLE Radio] blacklisted ${peripheral.address}`);
      black_list.push(peripheral.address);
    } else {
      var data = localName.toString('utf8');
      // console.log(`[BLE Radio] Received advertisement data = ${data}`);
      var discovered_ip = aes_crypto.decrypt(data, ranging_key, iv);
      // console.log("[Ranging] Decrypted data = " + discovered_ip);
      if(isValidIPAddress(discovered_ip)) {
        utils.logWithTs("[BLE Radio] Peripheral discovered: " + peripheral.address);
        utils.logWithTs(`[Ranging] IP Address = ${discovered_ip}`);
        addToPartialLinkGraphDB(peripheral.address, discovered_ip);
      } else {
        utils.logWithTs(`[BLE Radio] blacklisted ${peripheral.address}`);
        black_list.push(peripheral.address);
      }
    }
  }
}

function isValidIPAddress(ipaddress) {  
  if (/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ipaddress)) {  
    return (true);  
  }  
  return (false);  
}

function loadKeyParams(callback) {
  if (!fs.existsSync(paramsFilePath)) {
    callback("")
  } else {
    fs.readFile(paramsFilePath, 'utf-8', function handleReadFile(err, data) {
      if (err) 
        throw err;
      key_params = JSON.parse(data);
      callback(key_params);
    });
  }
}

function registerWithServer(mac_address, user, pass) {
  var http_post_req_params = {
      "headers": { "content-type": "application/json" },
      "url": register_url,
      "body": JSON.stringify({
          "radioMACAddress": mac_address,
          "user": user,
          "pass": pass
      })
  };
  Request.post(http_post_req_params, handlePOSTResponse);
}

function handlePOSTResponse(error, response, body) {
  if(error) {
      return console.dir(error);
  }
  var key_params = JSON.parse(body);
  ranging_key = key_params.ranging_key;
  iv = key_params.iv;
  utils.logWithTs(`[Ranging] Received ranging key from registration server. Key = ${ranging_key}, IV = ${iv}`);
  fs.writeFile(paramsFilePath,  JSON.stringify(key_params), 'utf-8', handleWriteFileError);
  //start advertising once we have the key
  startAdvertising();
}

function handleWriteFileError(err) {
  if (err) throw err;
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
  encrypted_ip = aes_crypto.encrypt(ip_addr, ranging_key, iv);

  //create a buffer for the payload. 
  //buffer size = 2 bytes for length and AD type + byte size of the encrypted-ip 
  const bufferSize = 2 + encrypted_ip.length;
  var advertisementData = new Buffer(bufferSize); 

  //payload length = 1 byte for AD type + rest for the actual data. 
  const payloadLength = 1 + encrypted_ip.length;

  //Write it at the byte position 0 of the buffer. Since the length is stored in 1 byte, use writeUInt8
  advertisementData.writeUInt8(payloadLength, 0); 
  
  //AD type – 0x09 = complete local name
  advertisementData.writeUInt8(0x09, 1); 

  //write the actual data
  advertisementData.write(encrypted_ip, 2);

  bleno.startAdvertisingWithEIRData(advertisementData);
  utils.logWithTs(`[BLE Radio] Started Advertising with encrypted data = ${encrypted_ip}`);
}

function handleKeyParams(key_params){
  if(!key_params) {
    mac_address = bleno.address;
    registerWithServer(mac_address, "admin", "pass");
  } else {
    ranging_key = key_params.ranging_key;
    iv = key_params.iv;
    utils.logWithTs(`[Ranging] Reusing already obtained key = ${key_params.ranging_key}, IV = ${key_params.iv}`);
    startAdvertising();
  }
}

function saveIPAddress(name, ip) {
  db.collection('self').updateOne(
      { "_id" : name }, 
      { $set: { "_id": name, "IP_address": ip, "ts" : Date.now()} }, 
      { upsert: true },
      function(err, result) {
        utils.logWithTs("recorded id and IP of self to db");
      }
    );
}

function addToPartialLinkGraphDB(peripheral_name, peripheral_ip) {
  db.collection('partialLinkGraph').updateOne(
      { "_id" : peripheral_name }, 
      { $set: { "_id": peripheral_name, "IP_address": peripheral_ip, "ts" : Date.now()} }, 
      { upsert: true },
      function(err, result) {
        utils.logWithTs("datapoint stored to db");
      }
    );
}