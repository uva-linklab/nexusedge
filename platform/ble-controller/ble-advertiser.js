/*
use abandonware forks of noble and bleno because the original repos are not maintained and do not work with node.js
versions 8 and above.
https://github.com/noble/node-bluetooth-hci-socket/issues/84
*/
const bleno = require('@abandonware/bleno');
const mongoClient = require('mongodb').MongoClient;
const utils = require("../../utils");
const talkToManagerService = require('./services/talk-to-manager-service/talk-to-manager-service').Service;

class BleAdvertiser {
    constructor(groupKey, ipAddress) {
        this.groupKey = groupKey;
        this.ipAddress = ipAddress;
        // TODO move to common file
        this._initializeMongo();
    }

    advertise() {
        bleno.on('stateChange', (state) => {
            if(state === 'poweredOn') {
                console.log("[BLE Radio] BLE MAC Address = " + bleno.address);
                this._saveAddressesToDB(bleno.address, this.ipAddress);

                const encryptedIp = utils.encryptAES(this.ipAddress, this.groupKey.key, this.groupKey.iv);

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
            } else if(state === 'poweredOff') {
                bleno.stopAdvertising();
            } else {
                debug("[BLE Radio] bleno state changed to " + state);
            }
        });
        bleno.on('advertisingStop', function() {
            console.log("[BLE Radio] Bleno advertisement stopped");
        });
        bleno.on('advertisingStartError', function(error) {
            console.log("[BLE Radio] Bleno advertisingStartError:");
        });
    }

    _saveAddressesToDB(name, ip) {
        this.db.collection('self').updateOne(
            { "_id" : name },
            { $set: { "_id": name, "IP_address": ip, "ts" : Date.now()} },
            { upsert: true },
            function(err, result) {
                debug("recorded id and IP of self to db");
            }
        );
    }

    _initializeMongo() {
        const mongoUrl = 'mongodb://localhost:27017';
        const discoveryDbName = 'discovery';

        // Initialize db connection once
        mongoClient.connect(mongoUrl, { useNewUrlParser: true }, (err, client) => {
            if(err) throw err;
            this.db = client.db(discoveryDbName);
        });
    }
}

module.exports = BleAdvertiser;