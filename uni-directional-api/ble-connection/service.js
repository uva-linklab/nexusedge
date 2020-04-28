const util = require('util');
const bleno = require('@abandonware/bleno');

var PizzaCrustCharacteristic = require('./characteristic');

function PizzaService() {
    bleno.PrimaryService.call(this, {
        uuid: '13333333333333333333333333333337',
        characteristics: [
            new PizzaCrustCharacteristic()
        ]
    });
}

util.inherits(PizzaService, bleno.PrimaryService);

module.exports = PizzaService;