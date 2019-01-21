const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');

// Connection URL
const mongo_url = 'mongodb://localhost:27017';

// Database Name
const dbName = 'discovery';

// Create a new MongoClient
const client = new MongoClient(mongo_url);

// Use connect method to connect to the Server
client.connect(function(err) {
  assert.equal(null, err);
  console.log("Connected successfully to server");

  const db = client.db(dbName);

  insertDocuments(db,function(result) {});

  client.close();
});

const insertDocuments = function(db, callback) {
  const collection = db.collection('partial_link_graph');
  collection.updateOne(
  	{ "gatewayIP" : "192.168.0.1" }, 
  	{ $set: { "gatewayName" : "A", "ts" : Date.now()} }, 
  	{ upsert: true },
  	function(err, result) {
    console.log("Updated the document");
    callback(result);
  });  

}