const MongoDbService = require('../mongo-db-service');
const mongoDbService = MongoDbService.getInstance();
const selfCollectionName = 'self';

/**
 * Get the latest entry in the self collection
 * @returns {Promise<entry>}
 */
exports.getLatestEntry = function() {
    return mongoDbService.getCollection(selfCollectionName)
        .then(collection => {
            return collection.findOne({}, {"timestamp": 0});
        });
};

/**
 * Upsert macAddress and ipAddress to DB
 * @param macAddress
 * @param ipAddress
 */
exports.upsertAddresses = function(macAddress, ipAddress) {
    mongoDbService.getCollection(selfCollectionName)
        .then(collection => {
            collection.updateOne(
                {"_id": macAddress},
                {$set: {"_id": macAddress, "IP_address": ipAddress, "ts": Date.now()}},
                {upsert: true})
                .then(() => {})
                .catch(err => throw err);
        });
};