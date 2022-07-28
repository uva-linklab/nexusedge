// This BLE service passes a message to from a manager of one gateway to the manager of another via the ble-controller
const util = require('util');
const bleno = require('@abandonware/bleno');

// This service contains a single characteristic which takes a JSON message that needs to be passed between gateways
const MessageCharacteristic = require('./message-characteristic').Characteristic;
// Testing group ID.
// Change this to another value to uniquify the group.
const serviceUUID = 'd7454f65f589478c88c566ec4a430b6d';

function TalkToManagerService(messagingService, onWriteRequestFinished) {
    bleno.PrimaryService.call(this, {
        uuid: serviceUUID,
        characteristics: [
            new MessageCharacteristic(messagingService, onWriteRequestFinished)
        ]
    });
}

util.inherits(TalkToManagerService, bleno.PrimaryService);

module.exports.Service = TalkToManagerService;
module.exports.uuid = serviceUUID;
