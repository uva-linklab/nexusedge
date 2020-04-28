var util = require('util');
var bleno = require('@abandonware/bleno');

const WebSocket = require('ws');

function PizzaCrustCharacteristic() {
    bleno.Characteristic.call(this, {
        uuid: '13333333333333333333333333330001',
        properties: ['write'],
        descriptors: [
            new bleno.Descriptor({
                uuid: '2901',
                value: 'blah'
            })
        ]
    });
}

util.inherits(PizzaCrustCharacteristic, bleno.Characteristic);

PizzaCrustCharacteristic.prototype.onWriteRequest = function(data, offset, withoutResponse, callback) {
    // this._value = data;
    const addr = data.toString('utf8');
    console.log('CustomCharacteristic - onWriteRequest: value = ' + addr);
    callback(this.RESULT_SUCCESS);

    const ws = new WebSocket(addr);

    ws.on('open', function open() {
        ws.send('something');
    });

    ws.on('message', function incoming(data) {
        console.log(data);
    });

};

module.exports = PizzaCrustCharacteristic;