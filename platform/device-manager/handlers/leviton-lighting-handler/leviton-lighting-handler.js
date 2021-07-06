/*
// TODO add which make of lighting sensors we are using
Parses BLE packets from Lighting Sensor
 */
const BleController = require('ble-controller');
const bleController = BleController.getInstance();

const SERVICE_CHANGED_CHAR_UUID = "2a05";
const SECURE_CMD_TO_WRITE_CHAR_UUID = "d027645004514000b0000000ee030000"; // D0276450-0451-4000-B000-0000EE030000
const SECURE_REPLY_NOTIFIED_CHAR_UUID = "d027645004514000b0000000ee040000"; // D0276450-0451-4000-B000-0000EE040000
// const FIRMWARE_VERSION_CHAR_UUID = "d027645004514000b0000000ee060000"; // D0276450-0451-4000-B000-0000EE060000

let secureCmdToWriteChar = null;
let secureReplyNotifiedChar = null;
let serviceChangedChar = null;

let subscribedToSecureNotifications = false;

// Stores any pending messages that need to be sent to a peripheral via BLE.
// Type: deviceId -> [data]
const pendingMessages = {};

class LevitonLightingHandler {
    constructor(handlerId) {
        this.handlerId = handlerId;
        this.deviceType = "leviton-light";
        this.isHandlingMessages = false;
        this.registeredDevices = [];
    }

    start(platformCallback) {
        this.platformCallback = platformCallback;
        bleController.initialize().then(() => {
            bleController.getPeripheralsWithPredicate(peripheral => {
                const localName = peripheral.advertisement.localName;
                return localName.includes("$L$");
            }, this._handlePeripheral.bind(this));
        });
    }

    dispatch(deviceId, data) {
        // currently, the only type of data we support is state = T/F
        /*
        {
            "state": "on"
        }
         */
        // add to pendingMessages
        if(pendingMessages.hasOwnProperty(deviceId)) {
            pendingMessages[deviceId].push(data);
        } else {
            pendingMessages[deviceId] = [data];
        }
    }

    async _handlePeripheral(peripheral) {
        // TODO: give a better device id for this device?
        const deviceId = peripheral.id;

        // if device is unregistered, then register it with the platform
        if(!this.registeredDevices.includes(deviceId)) {
            this.platformCallback.register(deviceId, this.deviceType, this.handlerId);
            this.registeredDevices.push(deviceId);
        }

        // if there are any pending messages for this deviceId, connect to it and send them
        /*
         There were instances where two async callbacks would both try to handle the pendingMessages leading to issues.
         isHandlingMessages is a naive way to implement a critical section to ensure that two handlers don't handle
         pendingMessages at the same time.
         */
        if(pendingMessages.hasOwnProperty(deviceId) && !this.isHandlingMessages) {
            this.isHandlingMessages = true;

            console.log(`[leviton-handler] There are pending messages to be sent for ${peripheral.id}`);

            //get the list of messages
            const messageList = pendingMessages[peripheral.id];
            const message = messageList.shift();

            // TODO change
            const state = message["state"] === "on";
            await this._setLevitonState(peripheral, state);

            if(messageList.length === 0) {
                delete pendingMessages[peripheral.id];
                console.log("[leviton-handler] Deleted messages for peripheral");
            }
            this.isHandlingMessages = false;
        }
    }

    async _initializeLevitonDevice(peripheral) {

    }

    async _setLevitonState(peripheral, state) {

    }

    async writeToSecureCmdCharacteristic(data) {

    }
}

module.exports = LevitonLightingHandler;