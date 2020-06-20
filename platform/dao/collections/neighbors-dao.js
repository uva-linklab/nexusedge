const MongoDbService = require('../mongo-db-service');
const mongoDbService = MongoDbService.getInstance();
const neighborsCollectionName = 'neighbors';

/**
 * Finds all the neighboring gateways that were active in the last x millis
 * @param timeMillis
 * @returns {Promise<neighbors>}
 */
exports.getNeighborDataSince = function(timeMillis) {
    return mongoDbService.getCollection(neighborsCollectionName)
        .then(collection => {
            return collection.find({"ts": {$gt: Date.now() - timeMillis}})
                .project({"ts": 0})
                .toArray();
        });
};

/**
 *
 * @param peripheralName
 * @param peripheralIp
 */
exports.upsertNeighborData = function(peripheralName, peripheralIp) {
    mongoDbService.getCollection(neighborsCollectionName)
        .then(collection => {
            collection.updateOne(
                { "_id" : peripheralName },
                { $set: { "_id": peripheralName, "IP_address": peripheralIp, "ts" : Date.now()} },
                { upsert: true })
                .then(() => {})
                .catch(err => throw err);
        });
};