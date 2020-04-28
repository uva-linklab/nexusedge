var util = require('util');
var bleno = require('@abandonware/bleno');

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
    console.log('CustomCharacteristic - onWriteRequest: value = ' +       data.toString('hex'));
    callback(this.RESULT_SUCCESS);
};

module.exports = PizzaCrustCharacteristic;