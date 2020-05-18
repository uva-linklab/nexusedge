process.env.NOBLE_MULTI_ROLE = 1;

/*
use abandonware forks of noble and bleno because the original repos are not maintained and do not work with node.js
versions 8 and above.
https://github.com/noble/node-bluetooth-hci-socket/issues/84
*/
const noble = require('@abandonware/noble');
const bleno = require('@abandonware/bleno');
const fs = require('fs');
const debug = require('debug')('gateway-scanner');
const mongoClient = require('mongodb').MongoClient;
const aesCrypto = require("./aes-crypto");
const utils = require("../../utils");
const MessagingService = require('../messaging-service');

const mongoUrl = 'mongodb://localhost:27017';
const discoveryDbName = 'discovery';

const paramsFileName = "group-key.json";
const paramsFilePath = __dirname + "/" + paramsFileName;
let key = "";
let iv = "";

const serviceName = process.env.SERVICE_NAME;
const messagingService = new MessagingService(serviceName);

//Service and characteristic related
const TalkToManagerService = require('./talk-to-manager-service');
const talkToManagerService = new TalkToManagerService(messagingService, function onWriteRequestFinished() {
  debug("[BLE] onWriteRequest to MessageCharacteristic complete.");
  /*
  For some reason, noble scan on the peripheral disconnects after a device connects and writes to its characteristic.
  Reference: https://github.com/noble/noble/issues/223
  So we put a callback after a write is complete, and then restart noble scan.
   */
  debug("[BLE] Restarting Noble scan");
  startNobleScan();
});

const talkToManagerServiceUuid = '18338db15c5841cca00971c5fd792920';
const messageCharacteristicUuid = '18338db15c5841cca00971c5fd792921';

//Stores any pending messages that need to be sent to a peripheral via bluetooth.
//Type: ip-address -> [message]
const pendingMessages = {};

ipAddress = utils.getIPAddress();

if(!ipAddress) {
  console.log("No IP address found. Please ensure the config files are set properly.");
  process.exit(1);
}

const groupKeyParams = getGroupKeyParams();
if(!groupKeyParams) {
  console.log(`Group key params not found in ${paramsFilePath}. Please refer to setup instructions in the readme file.`);
  process.exit(1);
}

key = groupKeyParams.key;
iv = groupKeyParams.iv;

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

//start discovering BLE peripherals
noble.on('stateChange', handleNobleStateChange);
noble.on('discover', handleDiscoveredPeripheral);
noble.on('scanStop', function() {
  debug("[BLE Radio] Noble scan stopped");
});
noble.on('warning', function (message) {
  debug(`[BLE Radio] Noble warning:${message}`);
});

function getGroupKeyParams() {
  if (!fs.existsSync(paramsFilePath)) {
    return "";
  } else {
    var data = fs.readFileSync(paramsFilePath, 'utf-8');
    return JSON.parse(data);
  }
}

function handleBlenoStateChange(state) {
  if (state === 'poweredOn') {
    debug("[BLE Radio] BLE MAC Address = " + bleno.address);
    saveAddressesToDB(bleno.address, ipAddress);

    const encryptedIp = aesCrypto.encrypt(ipAddress, key, iv);

    bleno.startAdvertising(encryptedIp, [talkToManagerService.uuid], function(err) {
      if(err) {
        console.log(err);
      } else {
        debug(`[BLE Radio] Started Advertising with data = ${encryptedIp} and service UUID ${talkToManagerService.uuid}`);
        bleno.setServices([
          talkToManagerService
        ]);
      }
    });
  } else if (state === 'poweredOff') {
    bleno.stopAdvertising();
  } else {
    debug("[BLE Radio] bleno state changed to " + state);
  }
}

function handleNobleStateChange(state) {
  if (state === 'poweredOn') {
    startNobleScan();
    debug("[BLE Radio] Started peripheral discovery");
  } else if(state === 'poweredOff'){
    noble.stopScanning();
  } else {
    debug("[BLE Radio] noble state changed to " + state);
  }
}

function startNobleScan() {
  //only discover peripherals with the talkToManagerService, which would be gateways part of the platform
  noble.startScanning([talkToManagerService.uuid], true);
}

function handleDiscoveredPeripheral(peripheral) {
    const localName = peripheral.advertisement.localName;
    if(typeof localName !== "undefined") {
      const discoveredIp = aesCrypto.decrypt(localName.toString('utf8'), key, iv);
      debug("[BLE Radio] Peripheral discovered: " + peripheral.address);
      debug(`[BLE Radio] IP Address = ${discoveredIp}`);
      saveNeighborDataToDB(peripheral.address, discoveredIp);

      //check if there are any pending messages that need to be sent to this peripheral
      if(pendingMessages.hasOwnProperty(discoveredIp)) {
        /*
        If the peripheral scan continues while we are performing the write to the characteristic, there could be
        race conditions. So we stop the scan, perform the write requests and then restart the noble scan.
         */
        noble.stopScanning();

        debug(`[BLE Radio] There are pending messages to be sent for ${discoveredIp}`);
        //get the list of messages
        const messageList = pendingMessages[discoveredIp];

        peripheral.connect(function(err) {
          debug(`[BLE Radio] Connected to peripheral at ${discoveredIp}`);

          const serviceUUIDs = [talkToManagerServiceUuid];
          const characteristicUUIDs = [messageCharacteristicUuid];

          peripheral.discoverSomeServicesAndCharacteristics(serviceUUIDs, characteristicUUIDs,
              function (error, services, characteristics) {
                const messageCharacteristic = characteristics[0];

                messageList.forEach(message => {
                  const buff = Buffer.from(JSON.stringify(message), 'utf8');

                  debug("[BLE Radio] Writing message to characteristic");
                  messageCharacteristic.write(buff, false, function(err) {
                    if(!err) {
                      debug("[BLE Radio] Write complete");
                    } else {
                      debug("[BLE Radio] Write Error!");
                      debug(err);
                    }
                  });
                });
                //delete the messages for this peripheral
                debug("[BLE Radio] Delete messages for peripheral");
                delete pendingMessages[discoveredIp];

                //Restart noble scan once write requests are finished
                startNobleScan();
              }
          );
        })
      }
    }
}

function saveAddressesToDB(name, ip) {
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

//when gateway-scanner obtains a message to be passed on to another gateway, it adds it to pendingMessages.
messagingService.listenForEvent('talk-to-gateway', message => {
  const messageToSend = message.data;

  const gatewayIP = messageToSend["gateway-ip"];
  const payload = messageToSend["gateway-msg-payload"];

  //add to pendingMessages
  if(pendingMessages.hasOwnProperty(gatewayIP)) {
    pendingMessages[gatewayIP].append(payload);
  } else {
    pendingMessages[gatewayIP] = [payload];
  }
});