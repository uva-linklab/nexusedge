const MongoClient = require('mongodb').MongoClient;
const mongoUrl = 'mongodb://localhost:27017';

const dbName = 'discovery';
const selfCollection = 'self';
const neighborsCollection = 'neighbors';
const sensorsCollection = 'sensors';

async function connectToDB() {
    const connection = await MongoClient.connect(mongoUrl, {useNewUrlParser: true, useUnifiedTopology: true});

    const db = await connection.db(dbName);
    return {'db': db, 'connection': connection};
}

function closeConnection(connection) {
    connection.close();
}

/**
 * Get the latest entry in the self collection
 * @returns {Promise<*>}
 */
exports.getSelfData = async function() {
    const connectionObj = await connectToDB();
    const selfData = await connectionObj.db.collection(selfCollection)
        .findOne({},{"timestamp":0});
    closeConnection(connectionObj.connection);
    return selfData;
};

//
/**
 * Finds all the neighboring gateways that were active in the last x millis
 * @param millisSince the milliseconds value of the time since the query needs to be run
 * @returns {Promise<*>}
 */
exports.getNeighborData = async function(millisSince) {
    const connectionObj = await connectToDB();
    const neighbors = await connectionObj.db.collection(neighborsCollection)
        .find({"ts": {$gt: Date.now() - millisSince}})
        .project({"ts":0})
        .toArray();
    closeConnection(connectionObj.connection);
    return neighbors;
};

/**
 * Finds all the sensors whose data was collected in the last x millis
 * @param millisSince the milliseconds value of the time since the query needs to be run
 * @returns {Promise<*>}
 */
exports.getSensorData = async function(millisSince) {
    const connectionObj = await connectToDB();
    const sensors = await connectionObj.db.collection(sensorsCollection)
        .find({"ts": {$gt: Date.now() - millisSince}})
        .project({"ts":0})
        .toArray();
    closeConnection(connectionObj.connection);
    return sensors;
};