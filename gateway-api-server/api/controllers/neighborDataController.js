const MongoClient = require('mongodb').MongoClient;

const mongo_url = 'mongodb://localhost:27017';
const dbName = 'discovery';

//returning gateways active in the last 5minutes
exports.getNeighbors = async function(req, res) {
	const client = await MongoClient.connect(mongo_url, { useNewUrlParser: true });
	const db = await client.db(dbName);
	//TODO rename to neighbors
	const plg = await db.collection('partialLinkGraph')
						.find({"ts": {$gt: Date.now() - 300000}})
						.project({"ts":0})
						.toArray();
	client.close();
	return res.json(plg);
};