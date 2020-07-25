const MongoDbService = require('../mongo-db-service');
const mongoDbService = MongoDbService.getInstance();
const devicesCollectionName = 'devices';

class Device {
    constructor(deviceId, deviceType, handlerId, controllerId, isStreamingDevice) {
        this.deviceId = deviceId;
        this.deviceType = deviceType;
        this.handlerId = handlerId;
        this.controllerId = controllerId;
        this.isStreamingDevice = isStreamingDevice;
    }
}

/**
 * Adds the device to DB.
 * @param device Device object to be inserted
 * @return {Promise<void>}
 */
function addDevice(device) {
    return mongoDbService.getCollection(devicesCollectionName)
        .then(collection => {
            return collection.insertOne(getDocument(device));
        });
}

/**
 * Finds device based on deviceId
 * @param {string} deviceId device's id
 * @returns {Promise<device | null>}
 */
function find(deviceId) {
    return mongoDbService.getCollection(devicesCollectionName).then(collection => {
        return collection.find({"_id": deviceId})
            .toArray()
            .then(docs => {
                const devices = docs.map(doc => getDevice(doc));
                return (devices.length !== 0) ? devices[0] : null;
            })
    });
}

/**
 * Fetches all device entries in the collection
 * @return {Promise<Device[]>}
 */
function fetchAll() {
    return mongoDbService.getCollection(devicesCollectionName)
        .then(collection => {
            return collection.find()
                .toArray()
                .then(docs => docs.map(doc => getDevice(doc)));
        })
}

/**
 * Fetches devices for the specified deviceIds
 * @param deviceIds
 * @return {Promise<any[]>}
 */
function fetchSpecific(deviceIds) {
    return mongoDbService.getCollection(devicesCollectionName)
        .then(collection => {
            return collection.find({"_id": {$in: deviceIds}})
                .toArray()
                .then(docs => docs.map(doc => getDevice(doc)));
        })
}

/**
 * Convert a device object from a mongodb document
 * @param document source mongodb document
 * @return {Device}
 */
function getDevice(document) {
    return new Device(document["_id"],
        document["deviceType"],
        document["handlerId"],
        document["controllerId"],
        document["isStreamingDevice"]
    );
}

/**
 * Convert a device object to a mongodb document
 * @param device source device object
 * @return {document}
 */
function getDocument(device) {
    return {
        "_id": device.deviceId,
        "deviceType": device.deviceType,
        "handlerId": device.handlerId,
        "controllerId": device.controllerId,
        "isStreamingDevice": device.isStreamingDevice
    }
}

module.exports = {
    Device: Device,
    addDevice: addDevice,
    find: find,
    fetchAll: fetchAll,
    fetchSpecific: fetchSpecific
};