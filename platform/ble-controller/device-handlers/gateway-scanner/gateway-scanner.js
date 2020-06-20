const utils = require("../../../../utils");
const daoHelper = require('../../../dao/dao-helper');

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

    async _handlePeripheral(peripheral) {
        const localName = peripheral.advertisement.localName;
        if(typeof localName !== "undefined") {
            const discoveredIp = utils.decryptAES(localName.toString('utf8'), this.groupKey.key, this.groupKey.iv);
            console.log("[gateway-scanner] Gateway discovered: " + peripheral.address);
            console.log(`[gateway-scanner] IP Address = ${discoveredIp}`);

            daoHelper.neighborsDao.upsertNeighborData(peripheral.address, discoveredIp);

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

                await this.bleScanner.connectToPeripheralAsync(peripheral);
                console.log(`[gateway-scanner] Connected to peripheral at ${discoveredIp}`);

                const serviceUUIDs = [talkToManagerServiceUuid];
                const characteristicUUIDs = [messageCharacteristicUuid];

                const servicesAndCharacteristics =
                    await this.bleScanner.discoverServicesAndCharacteristics(peripheral, serviceUUIDs, characteristicUUIDs);

                const characteristics = servicesAndCharacteristics["characteristics"];
                const messageCharacteristic = characteristics[0];

                this.bleScanner.writeCharacteristic(messageCharacteristic, JSON.stringify(message));
                console.log(`[gateway-scanner] Message sent to peripheral`);

                if(messageList.length === 0) {
                    delete pendingMessages[discoveredIp];
                    console.log("[gateway-scanner] Deleted messages for peripheral");
                }
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
}

module.exports = GatewayScanner;