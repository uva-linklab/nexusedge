/*
use abandonware forks of noble and bleno because the original repos are not maintained and do not work with node.js
versions 8 and above.
https://github.com/noble/node-bluetooth-hci-socket/issues/84
*/
const bleno = require('@abandonware/bleno');
const mongoClient = require('mongodb').MongoClient;
const utils = require("../../utils");
const TalkToManagerService = require('./services/talk-to-manager-service/talk-to-manager-service').Service;
const talkToManagerServiceUuid = require('./services/talk-to-manager-service/talk-to-manager-service').uuid;

class BleAdvertiser {
    constructor(groupKey, ipAddress, messagingService) {
        this.groupKey = groupKey;
        this.ipAddress = ipAddress;
        this.messagingService = messagingService;

        // TODO move to common file
        this._initializeMongo();
    }

    advertise() {
        bleno.on('stateChange', (state) => {
            if(state === 'poweredOn') {
                console.log("[BLE Radio] BLE MAC Address = " + bleno.address);
                this._saveAddressesToDB(bleno.address, this.ipAddress);

                const encryptedIp = utils.encryptAES(this.ipAddress, this.groupKey.key, this.groupKey.iv);

                bleno.startAdvertising(encryptedIp, [talkToManagerServiceUuid], function(err) {
                    if(err) {
                        console.log(err);
                    } else {
                        console.log(`[BLE Radio] Started Advertising with data = ${encryptedIp} and service 
                        UUID ${talkToManagerServiceUuid}`);
                        const talkToManagerService = new TalkToManagerService(this.messagingService);
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

    _saveAddressesToDB(macAddress, ipAddress) {
        this.db.collection('self').updateOne(
            {"_id": macAddress},
            {$set: {"_id": macAddress, "IP_address": ipAddress, "ts": Date.now()}},
            {upsert: true},
            function(err, result) {
                console.log("recorded mac address and IP of self to db");
            }
        );
    }

    _initializeMongo() {
        const mongoUrl = 'mongodb://localhost:27017';
        const discoveryDbName = 'discovery';

        // Initialize db connection once
        mongoClient.connect(mongoUrl, {useNewUrlParser: true}, (err, client) => {
            if(err) throw err;
            this.db = client.db(discoveryDbName);
        });
    }
}

module.exports = BleAdvertiser;