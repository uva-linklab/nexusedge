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
                debug(`[BLE Radio] There are pending messages to be sent for ${discoveredIp}`);

                //get the list of messages
                const messageList = pendingMessages[discoveredIp];

                this.bleScanner.connectToPeripheral((err) => {
                    debug(`[BLE Radio] Connected to peripheral at ${discoveredIp}`);

                    const serviceUUIDs = [talkToManagerServiceUuid];
                    const characteristicUUIDs = [messageCharacteristicUuid];

                    this.bleScanner.discoverServicesAndCharacteristics(peripheral, serviceUUIDs, characteristicUUIDs)
                        .then((services, characteristics) => {
                            const messageCharacteristic = characteristics[0];

                            messageList.map(message => {
                                const buff = Buffer.from(JSON.stringify(message), 'utf8');

                                debug("[BLE Radio] Writing message to characteristic");
                                return this.bleScanner.writeCharacteristic(messageCharacteristic, buff);
                            });

                            // TODO add documentation
                            Promise.all(messageList).then((values) => {
                                // delete the messages for this peripheral
                                debug("[BLE Radio] Delete messages for peripheral");
                                delete pendingMessages[discoveredIp];

                                // disconnect peripheral once write requests are finished
                                this.bleScanner.disconnectPeripheral(peripheral);
                            });
                        })
                })
            }
        }
    }

    connectToDevice(gatewayIP, data) {
        // add to pendingMessages
        if(pendingMessages.hasOwnProperty(gatewayIP)) {
            pendingMessages[gatewayIP].append(data);
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
        //         debug("datapoint stored to db");
        //     }
        // );
        console.log("[gateway-scanner] data point stored to db");
    }
}

module.exports = GatewayScanner;