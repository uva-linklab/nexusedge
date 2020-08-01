const fs = require('fs');
const BleController = require('ble-controller');
const bleController = BleController.getInstance();
const utils = require('../../../utils');
const daoHelper = require('../../dao/dao-helper');
const TalkToManagerService = require('./talk-to-manager-service/talk-to-manager-service').Service;
const talkToManagerServiceUuid = require('./talk-to-manager-service/talk-to-manager-service').uuid;
const messageCharacteristicUuid = require('./talk-to-manager-service/message-characteristic').uuid;

const keyFileName = "group-key.json";
const keyFilePath = __dirname + "/" + keyFileName;

// Stores any pending messages that need to be sent to a peripheral via BLE.
// Type: ip-address -> [message]
const pendingMessages = {};

let instance = null;

class GatewayScanner {
    constructor() {
    }

    static getInstance() {
        if(!instance) {
            instance = new GatewayScanner();
        }
        return instance;
    }

    start(messagingService) {
        this.messagingService = messagingService;

        // get the group key for scanning and advertising the gateway as part of the platform
        this.groupKey = this._getGroupKey();
        if(!this.groupKey) {
            console.log(`Group key not found in ${keyFilePath}. Please refer to setup instructions in the readme file.`);
            process.exit(1);
        }

        this.ipAddress = utils.getIPAddress();
        if(!this.ipAddress) {
            console.log("No IP address found. Please ensure the config files are set properly.");
            process.exit(1);
        }


        // wait for bleController to initialize
        bleController.initialize().then(() => {
            // store the IP address and BLE MAC address for future use
            daoHelper.selfDao.upsertAddresses(bleController.getMacAddress(), this.ipAddress);

            // Use the group key to encrypt the IP address. We use this encrypted IP as the localName for the advertisement.
            const encryptedIp = utils.encryptAES(this.ipAddress, this.groupKey.key, this.groupKey.iv);
            const talkToManagerService = new TalkToManagerService(this.messagingService, () => {
                // restart ble scan once the write to the characteristic is complete
                bleController.startScanning();
            });

            bleController.advertise(encryptedIp, [talkToManagerServiceUuid], [talkToManagerService]);

            // listen to advertisements for other neighboring gateways using the talkToManagerServiceUuid
            bleController.subscribeToAdvertisements(talkToManagerServiceUuid, this._handlePeripheral);
        });
    }

    /**
     * Reads the group key from the specified key file.
     * @returns {string|any} Return JSON object with two fields "key" and "iv". If key file is not valid, returns "".
     */
    _getGroupKey() {
        if (!fs.existsSync(keyFilePath)) {
            return "";
        } else {
            const data = fs.readFileSync(keyFilePath, 'utf-8');
            return JSON.parse(data);
        }
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
}

module.exports = GatewayScanner;