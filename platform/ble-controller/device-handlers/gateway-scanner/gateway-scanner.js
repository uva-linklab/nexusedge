const utils = require("../../../../utils");

const talkToManagerServiceUuid = require('../../services/talk-to-manager-service/talk-to-manager-service').uuid;
const messageCharacteristicUuid = require('../../services/talk-to-manager-service/message-characteristic').uuid;

// Stores any pending messages that need to be sent to a peripheral via BLE.
// Type: ip-address -> [message]
const pendingMessages = {};

class GatewayScanner {
    constructor(bleScanner, groupKey) {
        this.deviceType = "Gateway";
        this.groupKey = groupKey;
        this.bleScanner = bleScanner;

        this.bleScanner.subscribeToAdvertisements(talkToManagerServiceUuid, this._handlePeripheral.bind(this))
    }

    _handlePeripheral(peripheral) {
        const localName = peripheral.advertisement.localName;
        if(typeof localName !== "undefined") {
            const discoveredIp = utils.decryptAES(localName.toString('utf8'), this.groupKey.key, this.groupKey.iv);
            console.log("[gateway-scanner] Gateway discovered: " + peripheral.address);
            console.log(`[gateway-scanner] IP Address = ${discoveredIp}`);

            this.saveNeighborDataToDB(peripheral.address, discoveredIp);

            // //check if there are any pending messages that need to be sent to this peripheral
            if(pendingMessages.hasOwnProperty(discoveredIp)) {
                console.log(`[gateway-scanner] There are pending messages to be sent for ${discoveredIp}`);

                //get the list of messages
                const messageList = pendingMessages[discoveredIp];
                /*
                Remove the "head" of the list and returns it
                Not the best performing. O(n). Since the queue size is small, it's reasonable.
                Reference: https://stackoverflow.com/a/1590262/445964
                 */
                const message = messageList.shift();

                this.bleScanner.connectToPeripheral(peripheral, (err) => {
                    console.log(`[gateway-scanner] Connected to peripheral at ${discoveredIp}`);

                    const serviceUUIDs = [talkToManagerServiceUuid];
                    const characteristicUUIDs = [messageCharacteristicUuid];

                    this.bleScanner.discoverServicesAndCharacteristics(peripheral, serviceUUIDs, characteristicUUIDs,
                        (err, services, characteristics) => {
                            const messageCharacteristic = characteristics[0];

                            this.bleScanner.writeCharacteristic(messageCharacteristic, JSON.stringify(message));

                            if(messageList.length === 0) {
                                delete pendingMessages[discoveredIp];
                                console.log("[BLE Radio] Deleted messages for peripheral");
                            }
                        });
                })
            }
        }
    }

    connectToDevice(gatewayIP, data) {
        // add to pendingMessages
        if(pendingMessages.hasOwnProperty(gatewayIP)) {
            pendingMessages[gatewayIP].push(data);
        } else {
            pendingMessages[gatewayIP] = [data];
        }
    }

    // TODO do we need to have one single DB handler somewhere else?
    saveNeighborDataToDB(peripheralName, peripheralIp) {
        // db.collection('neighbors').updateOne(
        //     { "_id" : peripheralName },
        //     { $set: { "_id": peripheralName, "IP_address": peripheralIp, "ts" : Date.now()} },
        //     { upsert: true },
        //     function(err, result) {
        //         console.log("datapoint stored to db");
        //     }
        // );
        // console.log("[gateway-scanner] data point stored to db");
    }
}

module.exports = GatewayScanner;