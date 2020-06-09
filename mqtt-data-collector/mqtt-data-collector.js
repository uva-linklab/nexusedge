const MqttController = require('../utils/mqtt-controller');
const mongoClient = require('mongodb').MongoClient;
const debug = require('debug')('mqtt-data-collector');

const mongoUrl = 'mongodb://localhost:27017';
const discoveryDbName = 'discovery';
const sensorsCollection = 'sensors';

// Initialize database connection once
var db;
mongoClient.connect(mongoUrl, {useNewUrlParser: true}, function(err, client) {
    if(err) throw err;

    db = client.db(discoveryDbName);
});

const mqttController = MqttController.getInstance();
mqttController.subscribeToPlatformMqtt(message => {
    const data = JSON.parse(message);

    const sensorId = data._meta.device_id;
    const sensorDevice = data.device;
    const gatewayId = data._meta.gateway_id;
    const receiver = data._meta.receiver;

    saveSensorDataToDB(sensorId, sensorDevice, gatewayId, receiver);
});

function saveSensorDataToDB(sensorId, device, gatewayId, receiver) {
    db.collection(sensorsCollection).updateOne(
        {"_id": sensorId},
        {$set: {"_id": sensorId, "device": device, "gateway_id": gatewayId, "receiver": receiver, "ts": Date.now()}},
        {upsert: true},
        function(err, result) {
            debug("datapoint stored to db");
        }
    );
}