const MongoDbService = require('../mongo-db-service');
const mongoDbService = MongoDbService.getInstance();
const devicesCollectionName = 'devices';

/**
 * Adds the device to DB.
 * @param deviceId id of the device
 * @param deviceType specifies type of the device
 * @param handlerId id of the handler handling this device
 */
exports.addDevice = function(deviceId, deviceType, handlerId) {
    mongoDbService.getCollection(devicesCollectionName)
        .then(collection => {
            collection.insertOne({
                "_id": deviceId,
                "deviceType": deviceType,
                "handler": handlerId
            })
                .then(() => {})
                .catch(err => console.error(err.message));
        });
};

/**
 * Finds device based on deviceId
 * @param {string} deviceId device's id
 * @returns {Promise<device>}
 */
exports.find = function(deviceId) {
    return mongoDbService.getCollection(devicesCollectionName)
        .then(collection => {
            return collection.find({"_id": deviceId})
                .toArray();
        });
};
