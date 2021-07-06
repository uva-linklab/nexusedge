const fs = require('fs');
const BleController = require('ble-controller');
const bleController = BleController.getInstance();
const utils = require('../../utils/utils');
const TalkToManagerService = require('./talk-to-manager-service/talk-to-manager-service').Service;
const talkToManagerServiceUuid = require('./talk-to-manager-service/talk-to-manager-service').uuid;
const messageCharacteristicUuid = require('./talk-to-manager-service/message-characteristic').uuid;

// Stores any pending messages that need to be sent to a peripheral via BLE.
// Type: ip-address -> [message]
const pendingMessages = {};

let instance = null;

class GatewayScanner {
    static getInstance() {
        if(!instance) {
            instance = new GatewayScanner();
        }
        return instance;
    }

    start(messagingService) {
        this.messagingService = messagingService;

        // gatewayId -> { id: , ip: , lastActiveTime: }
        this._discoveredGateways = {};

        // wait for bleController to initialize
        bleController.initialize().then(() => {
            // Use the group key to encrypt the IP address. We use this encrypted IP as the localName for the advertisement.
            const encryptedLocalName = utils.getAdvertisementName();
            const talkToManagerService = new TalkToManagerService(this.messagingService, () => {
                // restart ble scan once the write to the characteristic is complete
                bleController.startScanning();
            });
            bleController.advertise(encryptedLocalName, [talkToManagerServiceUuid], [talkToManagerService]);

            // listen to advertisements for other neighboring gateways using the talkToManagerServiceUuid
            bleController.getPeripheralsWithUuid(talkToManagerServiceUuid, this._handlePeripheral.bind(this));
        });
    }

    talkToGateway(gatewayIP, payload) {
        // add to pendingMessages
        if(pendingMessages.hasOwnProperty(gatewayIP)) {
            pendingMessages[gatewayIP].push(payload);
        } else {
            pendingMessages[gatewayIP] = [payload];
        }
    }

    async _handlePeripheral(peripheral) {
        const localName = peripheral.advertisement.localName;
        if(localName) {
            const gatewayDetails = utils.getGatewayDetails(localName.toString('utf8'));

            // console.log("[gateway-scanner] Gateway discovered: " + peripheral.address);
            // console.log(`[gateway-scanner] IP Address = ${discoveredIp}`);

            this._discoveredGateways[gatewayDetails.id] = {
                id: gatewayDetails.id,
                ip: gatewayDetails.ip,
                lastActiveTime: Date.now()
            };

            // check if there are any pending messages that need to be sent to this peripheral
            const discoveredIp = gatewayDetails.ip;
            if(pendingMessages.hasOwnProperty(discoveredIp)) {
                console.log(`[gateway-scanner] There are pending messages to be sent for ${discoveredIp}`);

                // get the list of messages
                const messageList = pendingMessages[discoveredIp];
                /*
                Remove the "head" of the list and returns it
                Not the best performing. O(n). Since the queue size is small, it's reasonable.
                Reference: https://stackoverflow.com/a/1590262/445964
                 */
                const message = messageList.shift();

                await bleController.connectToPeripheralAsync(peripheral);
                console.log(`[gateway-scanner] Connected to peripheral at ${discoveredIp}`);

                const serviceUUIDs = [talkToManagerServiceUuid];
                const characteristicUUIDs = [messageCharacteristicUuid];

                const servicesAndCharacteristics =
                    await bleController.discoverServicesAndCharacteristics(peripheral, serviceUUIDs, characteristicUUIDs);

                const characteristics = servicesAndCharacteristics["characteristics"];
                const messageCharacteristic = characteristics[0];

                bleController.writeCharacteristic(messageCharacteristic, JSON.stringify(message));
                console.log(`[gateway-scanner] Message sent to peripheral`);

                if(messageList.length === 0) {
                    delete pendingMessages[discoveredIp];
                    console.log("[gateway-scanner] Deleted messages for peripheral");
                }
            }
        }
    }

    getActiveGateways() {
        // find gateways that have been active in the last 15 seconds
        const timeMillis = 15 * 1000;

        // make a deep copy of the discovered gateways object, since we need to delete the lastActiveTime field
        // reference: https://stackoverflow.com/a/122704/445964
        const allGateways = JSON.parse(JSON.stringify(this._discoveredGateways));
        const activeGateways = Object.values(allGateways)
            .filter(gateway => gateway.lastActiveTime > Date.now() - timeMillis);
        // remove the last active time field
        activeGateways.forEach(gateway => delete gateway.lastActiveTime);
        return activeGateways;
    }
}

module.exports = GatewayScanner;