module.exports.getPartialLinkGraph = getPartialLinkGraph;
'use strict';

const MongoClient = require('mongodb').MongoClient;

const mongo_url = 'mongodb://localhost:27017';
const dbName = 'discovery';

//TODO: filter for devices present in the last 15mins
async function getPartialLinkGraph() {
	// console.log(`looking for time > ${Date.now() - 900000}`)
	const conn = await MongoClient.connect(mongo_url, { useNewUrlParser: true });
	const db = await conn.db(dbName);
	const plg = await db.collection('partialLinkGraph')
						.find({})
						.project({"ts":0})
						.toArray();
	return plg;
}