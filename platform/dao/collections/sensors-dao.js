const MongoDbService = require('../mongo-db-service');
const mongoDbService = MongoDbService.getInstance();
const sensorCollectionName = 'sensors';

/**
 * Finds all the sensors whose data was collected in the last x millis
 * @param timeMillis the milliseconds value of the time since the query needs to be run
 * @returns {Promise<sensorData>}
 */
exports.getSensorDataSince = function(timeMillis) {
    return mongoDbService.getCollection(sensorCollectionName)
        .then(collection => {
            return collection.find({"ts": {$gt: Date.now() - timeMillis}})
                .project({"ts":0})
                .toArray();
        });
};

/**
 * Upserts sensor data
 * @param sensorId
 * @param device
 * @param gatewayId
 * @param receiver
 */
exports.upsertSensorData = function(sensorId, device, gatewayId, receiver) {
    mongoDbService.getCollection(sensorCollectionName)
        .then(collection => {
            collection.updateOne(
                {"_id": sensorId},
                {$set: {"_id": sensorId, "device": device, "gateway_id": gatewayId, "receiver": receiver, "ts": Date.now()}},
                {upsert: true})
                .then(() => {})
                .catch(err => throw err);
        });
};