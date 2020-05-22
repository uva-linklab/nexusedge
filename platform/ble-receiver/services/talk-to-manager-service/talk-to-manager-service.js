// This BLE service passes a message to from a manager of one gateway to the manager of another via the gateway-scanner
const util = require('util');
const bleno = require('@abandonware/bleno');

// This service contains a single characteristic which takes a JSON message that needs to be passed between gateways
const MessageCharacteristic = require('./message-characteristic');

const serviceUUID = '18338db15c5841cca00971c5fd792920';

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