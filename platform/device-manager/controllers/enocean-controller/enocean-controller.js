// This file is taken from the lab11/gateway repo, with some changes to work with nodejs v12.6.2
// Source: https://github.com/lab11/gateway/blob/master/software/enocean-generic-gateway/enocean-generic-gateway.js
const enocean = require('@nabeeln7/node-enocean')();
const serialPort = require('serialport');

serialPort.list()
    .then(ports => {
        ports.forEach(function (port) {
            if (port.pnpId && port.pnpId.indexOf('EnOcean') !== -1) {
                console.log('Using serial port ' + port.comName);
                enocean.listen(port.comName);
            }
        })
    })
    .catch(err => {
        console.error('Error reading serial ports.');
    });

enocean.on("ready", function () {
    console.log('Listening for EnOcean packets.');
    enocean.startLearning();
});

enocean.on("learned", function (data) {
    console.log('Learned about ' + data.eepType + '(' + data.id + ')');
});

enocean.on("known-data", function (data) {
    const out = {
        device: data.sensor.eepType,
        _meta: {
            received_time: new Date().toISOString(),
            device_id: data.sensor.id,
            receiver: 'enocean-generic-gateway',
            gateway_id: _gateway_id
        }
    };

    if (data.rssi) {
        out.rssi = data.rssi;
    }

    for (const shortName in data.data) {
        const item = data.data[shortName];
        // Skip any information about the learn bit.
        if (shortName.indexOf('LRN') !== -1 || item.name.indexOf('Learn') !== -1) {
            continue;
        }

        // Otherwise add this to the packet.
        let key = item.name;
        if (item.unit) {
            key += '_' + item.unit;
        }

        out[key] = item.value;
    }

    console.log(out);
});

enocean.on('learn-mode-stop', function (result) {
    // If for any reason learning stops, start it again!
    // Learning seems to stop for all sorts of reasons. Not good for a generic
    // gateway!
    enocean.startLearning();
});