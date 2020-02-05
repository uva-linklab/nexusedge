const mqtt = require('mqtt');
const mongoClient = require('mongodb').MongoClient;
const debug = require('debug')('mqtt-data-collector');

const MQTT_TOPIC_NAME = 'gateway-data';
const client = mqtt.connect('mqtt://localhost');

const mongoUrl = 'mongodb://localhost:27017';
const discoveryDbName = 'discovery';
const sensorsCollection = 'sensors';

// Initialize database connection once
var db;
mongoClient.connect(mongoUrl, { useNewUrlParser: true }, function(err, client) {
  if(err) throw err;

  db = client.db(discoveryDbName);
});

client.on('connect', () => {
    client.subscribe(MQTT_TOPIC_NAME)
});

client.on('message', (topic, message) => {
  if(topic === MQTT_TOPIC_NAME) {
    data = JSON.parse(message.toString());

    const sensorId = data._meta.device_id;
    const sensorDevice = data.device;
    const gatewayId = data._meta.gateway_id;
    const receiver = data._meta.receiver;

    saveSensorToDB(sensorId, sensorDevice, gatewayId, receiver);
  }
});

function saveSensorToDB(sensorId, device, gatewayId, receiver) {
   db.collection(sensorsCollection).updateOne(
      { "_id" : sensorId },
      { $set: { "_id": sensorId, "device": device, "gateway_id": gatewayId, "receiver": receiver, "ts" : Date.now()} },
      { upsert: true },
      function(err, result) {
        debug("datapoint stored to db");
      }
    );
}