const util = require('util');
const bleno = require('@abandonware/bleno');

var MessageCharacteristic = require('./message-characteristic');

function TalkToManagerService() {
    bleno.PrimaryService.call(this, {
        uuid: '18338db1-5c58-41cc-a009-71c5fd792920',
        characteristics: [
            new MessageCharacteristic()
        ]
    });
}

util.inherits(TalkToManagerService, bleno.PrimaryService);

module.exports = TalkToManagerService;