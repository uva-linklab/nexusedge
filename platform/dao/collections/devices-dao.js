const MongoDbService = require('../mongo-db-service');
const mongoDbService = MongoDbService.getInstance();
const devicesCollectionName = 'devices';

/**
 * * Adds the device to DB.
 * @param deviceId id of the device
 * @param deviceType specifies type of the device
 * @param handlerId id of the handler handling this device
 * @param isStreamingDevice specifies whether or not this device provides streaming data to the platform
 * @return {PromiseLike<Promise> | Promise<Promise>}
 */
exports.addDevice = function(deviceId, deviceType, handlerId, isStreamingDevice) {
    return mongoDbService.getCollection(devicesCollectionName)
        .then(collection => {
            return collection.insertOne({
                "_id": deviceId,
                "deviceType": deviceType,
                "handler": handlerId,
                "isStreamingDevice": isStreamingDevice
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

/**
 * Fetches devices for the specified deviceIds
 * @param deviceIds
 * @return {Promise<any[]>}
 */
exports.fetchSpecific = function(deviceIds) {
    return mongoDbService.getCollection(devicesCollectionName)
        .then(collection => {
            return collection.find({"_id": {$in: deviceIds}})
                .toArray();
        })
};