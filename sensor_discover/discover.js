const mqtt = require('mqtt')
const MongoClient = require('mongodb').MongoClient;
const utils = require('../utils/utils');

const client = mqtt.connect('mqtt://localhost')
const mongo_url = 'mongodb://localhost:27017';
const discovery_dbName = 'discovery';
const sensor_discovery_collection = 'sensor_discovery';

var db;

// Initialize connection once
MongoClient.connect(mongo_url, { useNewUrlParser: true }, function(err, client) {
  if(err) throw err;

  db = client.db(discovery_dbName);
});

client.on('connect', () => {
  client.subscribe('gateway-data')
});

client.on('message', (topic, message) => {
  if(topic === 'gateway-data') {
    data = JSON.parse(message.toString());

    const sensor_id = data.id;
    const sensor_device = data.device;
    const gateway_id = data._meta.gateway_id;
    const receiver = data._meta.receiver;

    
    addToSensorDiscoveryDB(sensor_id, sensor_device, gateway_id, receiver);
  }
});

function addToSensorDiscoveryDB(sensor_id, sensor_device, gateway_id, receiver) {
   db.collection(sensor_discovery_collection).updateOne(
      { "_id" : sensor_id },
      { $set: { "_id": sensor_id, "device": sensor_device, "gateway_id": gateway_id, "receiver": receiver, "ts" : Date.now()} }, 
      { upsert: true },
      function(err, result) {
        utils.logWithTs("datapoint stored to db");
      }
    );
}
