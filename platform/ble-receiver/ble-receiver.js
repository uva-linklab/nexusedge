// TODO: check if this is acutally of use. add documentation if yes.
process.env.NOBLE_MULTI_ROLE = 1;

/*
use abandonware forks of noble and bleno because the original repos are not maintained and do not work with node.js
versions 8 and above.
https://github.com/noble/node-bluetooth-hci-socket/issues/84
*/
const noble = require('@abandonware/noble');
const bleno = require('@abandonware/bleno');
const fs = require('fs');
const debug = require('debug')('ble-receiver');
const utils = require("../../utils");
const MessagingService = require('../messaging-service');

// initialize the IPC messaging service
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

// get the group key for scanning and advertising the gateway as part of the platform
const keyFileName = "group-key.json";
const keyFilePath = __dirname + "/" + keyFileName;

const groupKey = getGroupKey();
if(!groupKey) {
    console.log(`Group key not found in ${keyFilePath}. Please refer to setup instructions in the readme file.`);
    process.exit(1);
}

const ipAddress = utils.getIPAddress();

if(!ipAddress) {
    console.log("No IP address found. Please ensure the config files are set properly.");
    process.exit(1);
}

// lists the peripheral handlers that are registered to handle peripherals
// TODO: each handler should have a specific method called xxx which handles a discovered peripheral
const GatewayScanner = require("./peripheral-handlers/gateway-scanner");
const gatewayScanner = new GatewayScanner(groupKey);

const peripheralHandlers = [gatewayScanner];

// start discovering BLE peripherals
noble.on('stateChange', handleNobleStateChange);
noble.on('discover', handleDiscoveredPeripheral);
noble.on('scanStop', function() {
    debug("[BLE Radio] Noble scan stopped");
});
noble.on('warning', function(message) {
    debug(`[BLE Radio] Noble warning:${message}`);
});

bleno.on('stateChange', handleBlenoStateChange);
bleno.on('advertisingStop', function() {
    console.log("[BLE Radio] Bleno advertisement stopped");
});
bleno.on('advertisingStartError', function(error) {
    console.log("[BLE Radio] Bleno advertisingStartError:");
});

/**
 * Reads the group key from the specified key file.
 * @returns {string|any} Return JSON object with two fields "key" and "iv". If key file is not valid, returns "".
 */
function getGroupKey() {
    if (!fs.existsSync(keyFilePath)) {
        return "";
    } else {
        const data = fs.readFileSync(keyFilePath, 'utf-8');
        return JSON.parse(data);
    }
}

function handleNobleStateChange(state) {
    if(state === 'poweredOn') {
        startNobleScan();
        debug("[BLE Radio] Started peripheral discovery");
    } else if(state === 'poweredOff') {
        stopNobleScan();
    } else {
        debug("[BLE Radio] noble state changed to " + state);
    }
}

function startNobleScan() {
    noble.startScanning([], true);
}

function stopNobleScan() {
    noble.stopScanning();
}

function handleDiscoveredPeripheral(peripheral) {
    peripheralHandlers.forEach(handler => {
        // assumption: handlers do not modify the peripheral objects
        handler.handlePeripheral(peripheral);
    });
}

function handleBlenoStateChange(state) {
    if (state === 'poweredOn') {
        console.log("[BLE Radio] BLE MAC Address = " + bleno.address);
        saveAddressesToDB(bleno.address, ipAddress);

        const encryptedIp = utils.encryptAES(ipAddress, groupKey.key, groupKey.iv);

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

// TODO: move this to the ble-receiver
// //check if there are any pending messages that need to be sent to this peripheral
// if(pendingMessages.hasOwnProperty(discoveredIp)) {
//     /*
//     If the peripheral scan continues while we are performing the write to the characteristic, there could be
//     race conditions. So we stop the scan, perform the write requests and then restart the noble scan.
//      */
//     noble.stopScanning();
//
//     debug(`[BLE Radio] There are pending messages to be sent for ${discoveredIp}`);
//     //get the list of messages
//     const messageList = pendingMessages[discoveredIp];
//
//     peripheral.connect(function(err) {
//         debug(`[BLE Radio] Connected to peripheral at ${discoveredIp}`);
//
//         const serviceUUIDs = [talkToManagerServiceUuid];
//         const characteristicUUIDs = [messageCharacteristicUuid];
//
//         peripheral.discoverSomeServicesAndCharacteristics(serviceUUIDs, characteristicUUIDs,
//             function (error, services, characteristics) {
//                 const messageCharacteristic = characteristics[0];
//
//                 messageList.forEach(message => {
//                     const buff = Buffer.from(JSON.stringify(message), 'utf8');
//
//                     debug("[BLE Radio] Writing message to characteristic");
//                     messageCharacteristic.write(buff, false, function(err) {
//                         if(!err) {
//                             debug("[BLE Radio] Write complete");
//                         } else {
//                             debug("[BLE Radio] Write Error!");
//                             debug(err);
//                         }
//                     });
//                 });
//                 //delete the messages for this peripheral
//                 debug("[BLE Radio] Delete messages for peripheral");
//                 delete pendingMessages[discoveredIp];
//
//                 //Restart noble scan once write requests are finished
//                 startNobleScan();
//             }
//         );
//     })
// }

// TODO: fix this
function saveAddressesToDB(name, ip) {
    // db.collection('self').updateOne(
    //     { "_id" : name },
    //     { $set: { "_id": name, "IP_address": ip, "ts" : Date.now()} },
    //     { upsert: true },
    //     function(err, result) {
    //         debug("recorded id and IP of self to db");
    //     }
    // );
    console.log("save address to db");
}

// TODO: add ipc stuff here