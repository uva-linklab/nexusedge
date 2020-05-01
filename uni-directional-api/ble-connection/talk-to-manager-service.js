const util = require('util');
const bleno = require('@abandonware/bleno');

var MessageCharacteristic = require('./message-characteristic');

function TalkToManagerService() {
    bleno.PrimaryService.call(this, {
        uuid: '18338db15c5841cca00971c5fd792920',
        characteristics: [
            new MessageCharacteristic()
        ]
    });
}

util.inherits(TalkToManagerService, bleno.PrimaryService);

module.exports = TalkToManagerService;