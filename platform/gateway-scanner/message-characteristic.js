const util = require('util');
const bleno = require('@abandonware/bleno');

function MessageCharacteristic(messagingService, onWriteRequestFinished) {
    bleno.Characteristic.call(this, {
        uuid: '18338db15c5841cca00971c5fd792921',
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

    //try to parse the data into JSON.
    /* The expected message format is as follows:
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
    let jsonData = null;
    try {
        jsonData = JSON.parse(strData);
    } catch (e) {
        //if there's a JSON parse error,
        if(e instanceof SyntaxError) {
            //notify gateway-scanner that the onWriteRequest is complete
            this.onWriteRequestFinished();

            //throw an error message
            callback(this.RESULT_UNLIKELY_ERROR); //best error message out of the given bunch
        }
    }

    if(jsonData != null) {
        const recipient = jsonData["_meta"]["recipient"];
        const event = jsonData["_meta"]["event"];
        const payload = jsonData["payload"];

        this.messagingService.forwardMessage("gateway-scanner", recipient, event, payload);

        //notify gateway-scanner that the onWriteRequest is complete
        this.onWriteRequestFinished();

        callback(this.RESULT_SUCCESS);
    }
};

module.exports = MessageCharacteristic;