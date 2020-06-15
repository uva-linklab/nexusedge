const util = require('util');
const bleno = require('@abandonware/bleno');

const characteristicUuid = '18338db15c5841cca00971c5fd792921';

function MessageCharacteristic(messagingService, onWriteRequestFinished) {
    bleno.Characteristic.call(this, {
        uuid: characteristicUuid,
        properties: ['write'],
        descriptors: [
            new bleno.Descriptor({
                uuid: '2901',
                value: 'accepts the message to be passed on to the manager'
            })
        ]
    });
    this.messagingService = messagingService;
    this.onWriteRequestFinished = onWriteRequestFinished;
}

util.inherits(MessageCharacteristic, bleno.Characteristic);

MessageCharacteristic.prototype.onWriteRequest = function(bufferData, offset, withoutResponse, callback) {
    const strData = bufferData.toString('utf8');

    let jsonData = null;
    try {
        jsonData = JSON.parse(strData);
    } catch (e) {
        // if there's a JSON parse error, throw an error message
        if(e instanceof SyntaxError) {
            // notify bleAdvertiser that onWriteRequest is complete
            this.onWriteRequestFinished();

            // "callback" is needed only when notify=true in central's writeCharacteristic. But with that option set
            // the peripheral keeps disconnecting
            // callback(this.RESULT_UNLIKELY_ERROR);
        }
    }

    if(jsonData != null) {
        /*
        Format:
        {
            "_meta" : {
                "recipient": "manager-name-goes-here"
                "event": "connect-to-socket"
            },
            "payload": {
                ...
            }
        }
        */
        const recipient = jsonData["_meta"]["recipient"];
        const event = jsonData["_meta"]["event"];
        const payload = jsonData["payload"];

        this.messagingService.forwardMessage("ble-controller", recipient, event, payload);

        // notify bleAdvertiser that onWriteRequest is complete
        this.onWriteRequestFinished();

        // callback(this.RESULT_SUCCESS);
    }
};

module.exports.Characteristic = MessageCharacteristic;
module.exports.uuid = characteristicUuid;