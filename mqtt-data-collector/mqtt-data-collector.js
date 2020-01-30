const mqtt = require('mqtt');
const mongoClient = require('mongodb').MongoClient;
const debug = require('debug')('mqtt-data-collector');

const MQTT_TOPIC_NAME = 'gateway-data';
const client = mqtt.connect('mqtt://localhost');

const mongoUrl = 'mongodb://localhost:27017';
const discoveryDbName = 'discovery';
const sensorDiscoveryCollection = 'sensor_discovery';

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

    const sensor_id = data._meta.device_id;
    const sensor_device = data.device;
    const gateway_id = data._meta.gateway_id;
    const receiver = data._meta.receiver;

    addToSensorDiscoveryDB(sensor_id, sensor_device, gateway_id, receiver);
  }
});

function addToSensorDiscoveryDB(sensorId, device, gatewayId, receiver) {
   db.collection(sensorDiscoveryCollection).updateOne(
      { "_id" : sensorId },
      { $set: { "_id": sensorId, "device": device, "gateway_id": gatewayId, "receiver": receiver, "ts" : Date.now()} },
      { upsert: true },
      function(err, result) {
        debug("datapoint stored to db");
      }
    );
}