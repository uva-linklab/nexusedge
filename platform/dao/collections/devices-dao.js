const MongoDbService = require('../mongo-db-service');
const mongoDbService = MongoDbService.getInstance();
const devicesCollectionName = 'devices';

/**
 * * Adds the device to DB.
 * @param deviceId id of the device
 * @param deviceType specifies type of the device
 * @param handlerId id of the handler handling this device
 * @return {PromiseLike<Promise> | Promise<Promise>}
 */
exports.addDevice = function(deviceId, deviceType, handlerId) {
    return mongoDbService.getCollection(devicesCollectionName)
        .then(collection => {
            return collection.insertOne({
                "_id": deviceId,
                "deviceType": deviceType,
                "handler": handlerId
            })
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

/**
 * Fetches all device entries in the collection
 * @return {Promise<Promise | any[]>}
 */
exports.fetchAll = function() {
    return mongoDbService.getCollection(devicesCollectionName)
        .then(collection => {
            return collection.find()
                .toArray();
        })
};