/*
use abandonware forks of noble and bleno because the original repos are not maintained and do not work with node.js
versions 8 and above.
https://github.com/noble/node-bluetooth-hci-socket/issues/84
*/
const bleno = require('@abandonware/bleno');
const daoHelper = require('../dao/dao-helper');
const utils = require("../../utils");
const TalkToManagerService = require('./services/talk-to-manager-service/talk-to-manager-service').Service;
const talkToManagerServiceUuid = require('./services/talk-to-manager-service/talk-to-manager-service').uuid;

class BleAdvertiser {
    constructor(groupKey, ipAddress, messagingService, bleScanner) {
        this.groupKey = groupKey;
        this.ipAddress = ipAddress;
        this.messagingService = messagingService;
        this.bleScanner = bleScanner;

        /*
         bleScanner is required here because if a central writes to this gateway's characteristic, then the noble scan
         stops.
         Reference: https://github.com/noble/noble/issues/223
         So as a workaround, the bleAdvertiser will ask the bleScanner to restart noble scan.
         */
    }

    startAdvertising() {
        bleno.on('stateChange', (state) => {
            if(state === 'poweredOn') {
                console.log("[BLE Radio] BLE MAC Address = " + bleno.address);
                daoHelper.selfDao.upsertAddresses(bleno.address, this.ipAddress); // upsert to database

                const encryptedIp = utils.encryptAES(this.ipAddress, this.groupKey.key, this.groupKey.iv);
                const talkToManagerService = new TalkToManagerService(this.messagingService, () => {
                    // restart ble scan once the write to the characteristic is complete
                    this.bleScanner.startScanning();
                });

                bleno.startAdvertising(encryptedIp, [talkToManagerServiceUuid], function(err) {
                    if(err) {
                        console.log(err);
                    } else {
                        console.log(`[BLE Radio] Started Advertising with data = ${encryptedIp}`);

                        bleno.setServices([
                            talkToManagerService
                        ]);
                    }
                });
            } else if(state === 'poweredOff') {
                bleno.stopAdvertising();
            } else {
                console.log("[BLE Radio] bleno state changed to " + state);
            }
        });
        bleno.on('advertisingStop', function() {
            console.log("[BLE Radio] Bleno advertisement stopped");
        });
        bleno.on('advertisingStartError', function(error) {
            console.log("[BLE Radio] Bleno advertisingStartError:");
        });
    }
}

module.exports = BleAdvertiser;