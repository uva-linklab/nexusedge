//This BLE service passes a message to from a manager of one gateway to the manager of another via the gateway-scanner

const util = require('util');
const bleno = require('@abandonware/bleno');

//This service contains a single characteristic which takes a JSON message that needs to be passed between gateways
var MessageCharacteristic = require('./message-characteristic');

function TalkToManagerService(ipc) {
    bleno.PrimaryService.call(this, {
        uuid: '18338db15c5841cca00971c5fd792920',
        characteristics: [
            new MessageCharacteristic(ipc)
        ]
    });
}

util.inherits(TalkToManagerService, bleno.PrimaryService);

module.exports = TalkToManagerService;