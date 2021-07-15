/*
// TODO add which make of lighting sensors we are using
Parses BLE packets from Lighting Sensor
 */
const BleController = require('ble-controller');
const bleController = BleController.getInstance();

const SERVICE_CHANGED_CHAR_UUID = "2a05";
const SECURE_CMD_TO_WRITE_CHAR_UUID = "d027645004514000b0000000ee030000"; // D0276450-0451-4000-B000-0000EE030000
const SECURE_REPLY_NOTIFIED_CHAR_UUID = "d027645004514000b0000000ee040000"; // D0276450-0451-4000-B000-0000EE040000
const FIRMWARE_VERSION_CHAR_UUID = "d027645004514000b0000000ee060000"; // D0276450-0451-4000-B000-0000EE060000
const DEVICE_NAME_CHAR_UUID = "d027645004514000b0000000ee070000"; // D0276450-0451-4000-B000-0000EE070000

let subscribedToSecureNotifications = false;

// Stores any pending messages that need to be sent to a peripheral via BLE.
// Type: deviceId -> [data]
const pendingMessages = {};

const STATE_CONTROL_MSG_TYPE = "stateControl";
const BRIGHTNESS_CONTROL_MSG_TYPE = "brightnessControl";

class LevitonLightingHandler {
    constructor(handlerId) {
        this.handlerId = handlerId;
        this.deviceType = "leviton-light";
        this.isHandlingMessages = false;
        this.registeredDevices = [];

        this.firmwareVersionChar = null;
        this.deviceNameChar = null;
        this.secureCmdToWriteChar = null;
        this.secureReplyNotifiedChar = null;
        this.serviceChangedChar = null;
    }

    start(platformCallback) {
        this.platformCallback = platformCallback;
        bleController.initialize().then(() => {
            bleController.getPeripheralsWithPredicate(peripheral => {
                const localName = peripheral.advertisement.localName;
                return localName && localName.includes("$L$");
            }, this._handlePeripheral.bind(this));
        });
    }

    dispatch(deviceId, data) {
        /*
        data must be of this format:
        {
            requestType: "stateControl" OR "brightnessControl"
            payload: { "state": "on" OR "off" }, if requestType = stateControl
            OR
            payload: { "brightness": value }, if requestType = brightnessControl
                value = [1, 25, 50, 75, or 100]
        }
         */

        // check if format is correct
        if(this._isValidData(data)) {
            // add to pendingMessages
            if(pendingMessages.hasOwnProperty(deviceId)) {
                pendingMessages[deviceId].push(data);
            } else {
                pendingMessages[deviceId] = [data];
            }
        }
        // TODO return error if not valid. (currently no way to send error msg to app)
    }

    _isValidData(data) {
        if(data.hasOwnProperty("requestType") && data.hasOwnProperty("payload")) {
            const payloadObj = data["payload"];
            switch (data["requestType"]) {
                case STATE_CONTROL_MSG_TYPE:
                    if(payloadObj.hasOwnProperty("state")) {
                        const state = payloadObj["state"];
                        if(state === "on" || state === "off")
                            return true;
                    }
                    break;
                case BRIGHTNESS_CONTROL_MSG_TYPE:
                    if(payloadObj.hasOwnProperty("brightness")) {
                        const brightness = payloadObj["brightness"];
                        const possibleValues = [1, 25, 50, 75, 100];
                        if(possibleValues.includes(brightness))
                            return true;
                    }
                    break;
                default:
                    return false;
            }
        }
        return false;
    }

    async _handlePeripheral(peripheral) {
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

            await peripheral.connectAsync();
            await this._recordRelevantCharacteristics(peripheral);

            console.log("going to subscribe to secureReplyNotifiedChar");
            await this.secureReplyNotifiedChar.subscribeAsync(); // this requires pairing
            console.log("subscribed to secureReplyNotifiedChar");

            if(message["requestType"] === STATE_CONTROL_MSG_TYPE) {
                const state = message["payload"]["state"] === "on";
                await this._setLightState(peripheral, state);
            } else {
                const brightnessLevel = message["payload"]["brightness"];
                await this._setLightBrightness(peripheral, brightnessLevel);
            }

            await this.secureReplyNotifiedChar.unsubscribeAsync();
            console.log("unsubscribed from secureReplyNotifiedChar");

            await peripheral.disconnectAsync();
            console.log("disconnected");

            if(messageList.length === 0) {
                delete pendingMessages[peripheral.id];
                console.log("[leviton-handler] Deleted messages for peripheral");
            }
            this.isHandlingMessages = false;
        }
    }

    async _recordRelevantCharacteristics(peripheral) {
        const response = await peripheral.discoverAllServicesAndCharacteristicsAsync();
        response.characteristics.forEach(char => {
            switch (char.uuid) {
                case SERVICE_CHANGED_CHAR_UUID:
                    this.serviceChangedChar = char;
                    break;
                case SECURE_REPLY_NOTIFIED_CHAR_UUID:
                    this.secureReplyNotifiedChar = char;
                    break;
                case SECURE_CMD_TO_WRITE_CHAR_UUID:
                    this.secureCmdToWriteChar = char;
                    break;
                case FIRMWARE_VERSION_CHAR_UUID:
                    this.firmwareVersionChar = char;
                    break;
                case DEVICE_NAME_CHAR_UUID:
                    this.deviceNameChar = char;
                    break;
            }
        });
    }

    async _setLightState(peripheral, state) {
        const commandsToSend = [];
        commandsToSend.push([0xFE, 0x03, 0x01, 0xE7, 0x4A]);
        commandsToSend.push([0xFE, 0x01, 0x02, 0x64, 0x10, 0x3C]); // needs to be sent every 5sec
        commandsToSend.push([0xFE, 0x03, 0x01, 0xE9, 0x55]);
        commandsToSend.push([0xFE, 0x03, 0x01, 0xEA, 0xB7]);
        commandsToSend.push([0xFE, 0x03, 0x01, 0x11, 0xE3]);
        commandsToSend.push([0xFE, 0x01, 0x02, 0x64, 0x00, 0xA1]);
        // commandsToSend.push([0xFE, 0x01, 0x02, 0x04, 0x02, 0x47]); // this seems to turn on things
        // unnecessarily (commenting for the time being)
        if(state) {
            commandsToSend.push([0xFE, 0x01, 0x02, 0x72, 0x02, 0x5B]); // turn the relay on. instead of 025B, 0A99 should also work.
        } else {
            commandsToSend.push([0xFE, 0x01, 0x02, 0x72, 0x06, 0x3A]);  // turn the relay off. instead of 063A, 0EF8 should also work.
        }
        await this._writeCommandsToLight(peripheral, commandsToSend);
    }

    async _setLightBrightness(peripheral, level) {
        const commandsToSend = [];
        commandsToSend.push([0xFE, 0x03, 0x01, 0xE7, 0x4A]);
        commandsToSend.push([0xFE, 0x01, 0x02, 0x64, 0x10, 0x3C]); // needs to be sent every 5sec
        commandsToSend.push([0xFE, 0x03, 0x01, 0xE9, 0x55]);
        commandsToSend.push([0xFE, 0x03, 0x01, 0xEA, 0xB7]);
        commandsToSend.push([0xFE, 0x03, 0x01, 0x11, 0xE3]);
        commandsToSend.push([0xFE, 0x01, 0x02, 0x64, 0x00, 0xA1]);
        commandsToSend.push([0xFE, 0x01, 0x02, 0x72, 0x02, 0x5B]); // turn on the relay. this makes the dimming fn work properly.

        switch(level) {
            case 1:
                commandsToSend.push([0xFE, 0x01, 0x02, 0x73, 0x03, 0xC1]); // 1%
                break;
            case 25:
                commandsToSend.push([0xFE, 0x01, 0x02, 0x73, 0x40, 0x65]); // 25%
                break;
            case 50:
                commandsToSend.push([0xFE, 0x01, 0x02, 0x73, 0x80, 0xAF]); // 50%
                break;
            case 75:
                commandsToSend.push([0xFE, 0x01, 0x02, 0x73, 0xBE, 0x0E]); // 75%
                break;
            case 100:
                commandsToSend.push([0xFE, 0x01, 0x02, 0x73, 0xFF, 0x16]); // 100%
                break;
            default:
                console.error("Dimming state not supported");
                return;
        }
        await this._writeCommandsToLight(peripheral, commandsToSend);
    }

    _writeCommandsToLight(peripheral, commands) {
        // we need to execute write commands sequentially
        // first create an array of functions which will
        // execute the writeAndAwaitNotification fn and returns a promise for each specified data
        const functions = commands.map(command =>
            () => bleController.writeAndAwaitNotification(command,
                this.secureCmdToWriteChar,
                this.secureReplyNotifiedChar)
        );

        // then we execute this sequentially and wait until all of them finish
        return serializePromises(functions);
    }
}

// this is used to serialize a set of promises
// a bit difficult to understand, but I like the elegance of this
// reference: https://stackoverflow.com/a/41115086
const concat = list => Array.prototype.concat.bind(list);
const promiseConcat = f => y => f().then(concat(y));
const promiseReduce = (acc, x) => acc.then(promiseConcat(x));
/*
 * serializePromises executes Promises sequentially.
 * @param {funcs} An array of funcs that return promises.
 * @example
 * const urls = ['/url1', '/url2', '/url3']
 * serial(urls.map(url => () => $.ajax(url)))
 *     .then(console.log.bind(console))
 */
const serializePromises = funcs =>
    funcs.reduce(promiseReduce, Promise.resolve([]));

module.exports = LevitonLightingHandler;