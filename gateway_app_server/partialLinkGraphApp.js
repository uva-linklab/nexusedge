module.exports.getPartialLinkGraph = getPartialLinkGraph;
'use strict';

const MongoClient = require('mongodb').MongoClient;

const mongo_url = 'mongodb://localhost:27017';
const dbName = 'discovery';
var client = new MongoClient(mongo_url);

function getPartialLinkGraph(callback_fn) {
	// Use connect method to connect to the Server
	client.connect(function(err) {
	  console.log("Connected successfully to server");
	  const db = client.db(dbName);
	  findDocuments(db);
	});

	const findDocuments = function(db, finish_fn) {
	  // Get the documents collection
	  console.log("about to query");
	  const collection = db.collection('partial_link_graph');
	  // Find some documents
	  collection.find({}).toArray(function(err, docs) {
	    console.log("Found the following records");
	    console.log(docs);
	    callback_fn(docs);
	  });
	}
}