const DirtyDbService = require('../dirty-db-service');
const dirtyDbService = DirtyDbService.getInstance();
const devicesDbName = 'devices';

class Device {
    constructor(id, type, handlerId, controllerId, isStreamingDevice) {
        this.id = id;
        this.type = type;
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
    return new Promise(resolve => {
        dirtyDbService.getDb(devicesDbName).then(db => {
            // if already in the db, then don't add again
            if(db.get(device.id)) {
                resolve();
            } else {
                db.set(device.id, getJsObject(device), resolve());
            }
        });
    });
}

/**
 * Finds device based on deviceId
 * @param {string} deviceId device's id
 * @returns {Promise<Device | null>}
 */
function find(deviceId) {
    return dirtyDbService.getDb(devicesDbName).then(db => {
        const deviceObj = db.get(deviceId);
        return deviceObj ? getDevice(deviceObj) : null;
    });
}

/**
 * Fetches all device entries in the collection
 * @return {Promise<Device[]>}
 */
function fetchAll() {
    return dirtyDbService.getDb(devicesDbName).then(db => {
        const devices = [];
        db.forEach(function(deviceId, deviceObj) {
            devices.push(getDevice(deviceObj));
        });
        return devices;
    });
}

/**
 * Fetches devices for the specified deviceIds
 * @param deviceIds
 * @return {Promise<Device[]>}
 */
function fetchSpecific(deviceIds) {
    return dirtyDbService.getDb(devicesDbName).then(db => {
        const devices = [];
        db.forEach(function(deviceId, deviceObj) {
            if(deviceIds.includes(deviceId)) {
                devices.push(getDevice(deviceObj));
            }
        });
        return devices;
    });
}

/**
 * Convert a js object to a Device object
 * @param jsObject js object
 * @return {Device}
 */
function getDevice(jsObject) {
    return new Device(jsObject["id"],
        jsObject["type"],
        jsObject["handlerId"],
        jsObject["controllerId"],
        jsObject["isStreamingDevice"]
    );
}

/**
 * Convert a device object to a javascript object
 * @param device Device object
 * @return {Object}
 */
function getJsObject(device) {
    return {
        "id": device.id,
        "type": device.type,
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