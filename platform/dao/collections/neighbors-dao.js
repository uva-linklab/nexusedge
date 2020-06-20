const MongoDbService = require('../mongo-db-service');
const mongoDbService = MongoDbService.getInstance();
const neighborsCollectionName = 'neighbors';

/**
 * Finds all the neighboring gateways that were active in the last x millis
 * @param timeMillis
 * @returns {Promise<neighbors>}
 */
exports.getActiveNeighborsSince = function(timeMillis) {
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
 * @returns {Promise<status>}
 */
exports.upsertNeighborData = function(peripheralName, peripheralIp) {
    return mongoDbService.getCollection(neighborsCollectionName)
        .then(collection => {
            return collection.updateOne(
                { "_id" : peripheralName },
                { $set: { "_id": peripheralName, "IP_address": peripheralIp, "ts" : Date.now()} },
                { upsert: true });
        });
};