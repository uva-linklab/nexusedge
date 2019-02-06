module.exports.getPartialLinkGraph = getPartialLinkGraph;
'use strict';

const MongoClient = require('mongodb').MongoClient;

const mongo_url = 'mongodb://localhost:27017';
const dbName = 'discovery';

async function getPartialLinkGraph() {
	//returning devices active in the last 5minutes
	const conn = await MongoClient.connect(mongo_url, { useNewUrlParser: true });
	const db = await conn.db(dbName);
	const plg = await db.collection('partialLinkGraph')
						.find({"ts": {$gt: Date.now() - 300000}})
						.project({"ts":0})
						.toArray();
	return plg;
}