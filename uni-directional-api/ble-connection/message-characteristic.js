var util = require('util');
var bleno = require('@abandonware/bleno');

//TODO: should move to manager
const WebSocket = require('ws');

function MessageCharacteristic() {
    bleno.Characteristic.call(this, {
        uuid: '18338db1-5c58-41cc-a009-71c5fd792921',
        properties: ['write'],
        descriptors: [
            new bleno.Descriptor({
                uuid: '2901',
                value: 'accepts the message to be passed on to the manager'
            })
        ]
    });
}

util.inherits(MessageCharacteristic, bleno.Characteristic);

MessageCharacteristic.prototype.onWriteRequest = function(bufferData, offset, withoutResponse, callback) {
    const strData = bufferData.toString('utf8');

    //try to parse the data into JSON.
    /* The expected message format is as follows:
    {
        "_meta" : {
            "recipient": "manager-name-goes-here"
        },
        "data": {
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
            //throw an error message
            callback(this.RESULT_UNLIKELY_ERROR); //best error message out of the given bunch
        }
    }

    if(jsonData != null) {
        const recipient = jsonData["_meta"]["recipient"];
        const data = jsonData["data"];

        console.log(data);

        //TODO: check if recipient is a valid manager name who does indeed accept message requests
        //(check if node-ipc has an option for this)

        //if yes, pass it on to the manager using IPC
        //TODO: this has to be moved ot the manager
        const wsAddress = data["ws-address"];
        const ws = new WebSocket(wsAddress);

        ws.on('open', function open() {
            ws.send('something');
        });

        ws.on('message', function incoming(data) {
            console.log(data);
        });

        callback(this.RESULT_SUCCESS);
    }
};

module.exports = MessageCharacteristic;