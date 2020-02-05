const MongoClient = require('mongodb').MongoClient;

const mongo_url = 'mongodb://localhost:27017';
const dbName = 'discovery';
const sensorsCollection = 'sensors';

exports.getSensors = async function(req, res) {
	//returns sensors active in the last 5minutes
	const client = await MongoClient.connect(mongo_url, { useNewUrlParser: true });
	const db = await client.db(dbName);
	const sensors = await db.collection(sensorsCollection)
						.find({"ts": {$gt: Date.now() - 300000}})
						.project({"ts":0})
						.toArray();
	client.close();
	return res.json(sensors);
};