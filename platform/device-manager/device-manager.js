const handlerUtils = require('./handler-utils');
const MqttController = require('../../utils/mqtt-controller');
const mqttController = MqttController.getInstance();
const daoHelper = require('../dao/dao-helper');
const MessagingService = require('../messaging-service');
const {Device} = require("../dao/collections/devices-dao");

const serviceName = process.env.SERVICE_NAME;
const messagingService = new MessagingService(serviceName);
// keep track of a device's last active time. deviceId -> lastActiveTime.
// For devices that have streamed data, this will contain the last time that we receive a msg
// For devices that don't stream data, lastActiveTime = -1.
// This object doubles as a cache to check if a device was already registered or not.
const deviceLastActiveTimeMap = {};

// deviceId -> handlerId
const nonStreamingDevicesMap = {};

// deviceId -> [{}, {}, ..]
// Registration is a db operation and thus takes time. During this time, we buffer the data from that device.
// Once registration is done, we publish all buffered data in received order.
const pendingDeviceBuffer = {};

let handlerMap = {};

/**
 * This is a function used by handlers to register devices which won't be sending streamed data to the platform
 * @param deviceId
 * @param deviceType
 * @param handlerId
 */
function register(deviceId, deviceType, handlerId) {
    if(!nonStreamingDevicesMap.hasOwnProperty(deviceId)) {
        const device = new Device(deviceId,
            deviceType,
            handlerId,
            handlerUtils.getControllerId(handlerId),
            false);
        daoHelper.devicesDao.addDevice(device)
            .then(() => nonStreamingDevicesMap[deviceId] = handlerId);
    }
}

/**
 * This is a function used by handlers to deliver device data on to the platform.
 * @param handlerId the handler's id
 * @param deviceData
 */
function deliver(handlerId, deviceData) {
    // TODO set the metadata here rather than in the handlers
    // deviceData["_meta"] = {
    //     "received_time": new Date().toISOString(),
    //     "receiver": "ble-peripheral-scanner", // TODO remove
    //     "handler": handler,
    //     "controller": "jabaa", // TODO get it from teh json file mapping
    //     "gateway_id": this.bleScanner.getMacAddress()
    // };
    const deviceId = deviceData['id'];
    const deviceType = deviceData['device']; // TODO change key to deviceType

    if(isAwaitingRegistration(deviceId)) {
        // if registration for the deviceId is already underway, buffer the data for the current data point
        pendingDeviceBuffer[deviceId].push(deviceData);
    } else {
        if(!isDeviceInCache(deviceId)) {
            // if device is not in cache, then it means we need to register this device into db. (cache reflects the db
            // at all times). So buffer this data point.
            pendingDeviceBuffer[deviceId] = [deviceData];

            const device = new Device(deviceId,
                deviceType,
                handlerId,
                handlerUtils.getControllerId(handlerId),
                true);
            daoHelper.devicesDao.addDevice(device).then(() => {
                // once the device registration is complete, add device to cache
                deviceLastActiveTimeMap[deviceId] = Date.now();

                // publish all buffered data, in received order
                pendingDeviceBuffer[deviceId].forEach(deviceData => {
                    mqttController.publishToPlatformMqtt(JSON.stringify(deviceData));
                });
                // remove all data of device from buffer
                delete pendingDeviceBuffer[deviceId];
            });
        } else {
            // Data from registered device. Publish to MQTT.
            mqttController.publishToPlatformMqtt(JSON.stringify(deviceData));

            // keep track of the device's last active time
            deviceLastActiveTimeMap[deviceId] = Date.now();
        }
    }
}

function isAwaitingRegistration(deviceId) {
    return pendingDeviceBuffer.hasOwnProperty(deviceId);
}

/**
 * Checks if a device exists in cache or not
 * @param deviceId
 * @return {boolean}
 */
function isDeviceInCache(deviceId) {
    // use the deviceLastActiveTime data structure as a cache
    return deviceLastActiveTimeMap.hasOwnProperty(deviceId);
}

const platformCallback = {
    'register': register,
    'deliver': deliver
};

handlerUtils.loadHandlers().then(map => {
    handlerMap = map;
    // TODO notify platform manager that we have a problem and exit
    if(!handlerMap) {
    }

    // deviceLastActiveTime is used as a cache. Populate this by loading all devices in db.
    // ensures that the cache contains all the registered devices.
    daoHelper.devicesDao.fetchAll().then(devices => {
        devices.forEach(device => {
            if(device.isStreamingDevice) {
                deviceLastActiveTimeMap[device.id] = -1; // initialize the lastActiveTime to -1.
            } else {
                nonStreamingDevicesMap[device.id] = device.handlerId;
            }
        });
        // TODO check if execute exists before performing execute: typeof handlerObj.execute
        // execute each handler object
        // pass the platformCallback object with callback functions that handlers can use
        Object.values(handlerMap).forEach(handler => handler.execute(platformCallback));
    });
});


// // create a map of deviceType -> handler. deviceType is the type of devices that the handler handles.
// const deviceHandlerMap = {};
// deviceHandlers.forEach(handler => {
//     if(handler.deviceType === undefined) {
//         throw `deviceType not set for handler ${handler.constructor.name}`
//     }
//     deviceHandlerMap[handler.deviceType] = handler;
// });
//
// TODO add implementation

// function getHandlerForDeviceId(deviceId) {
//     return oortSocketHandler;
// }
//
// function getHandlerForDeviceType(deviceType) {
//     let handler = null;
//     if(deviceHandlerMap.hasOwnProperty(deviceType))
//         handler = deviceHandlerMap[deviceType];
//     return handler;
// }
//
// // when ble-controller obtains a message to be passed on to another gateway, we pass it on to GatewayScanner
// messagingService.listenForEvent('talk-to-gateway', message => {
//     const messageToSend = message.data;
//
//     const gatewayIP = messageToSend["gateway-ip"];
//     const payload = messageToSend["gateway-msg-payload"];
//
//     gatewayScanner.connectToDevice(gatewayIP, payload);
// });
//

/**
 * Finds devices that are active since the specified time. For streaming devices, this looks at the lastActiveTime field.
 * For non-streaming devices, this queries the handler for the last active time.
 * @param timeMillis
 * @return {Promise<any[]>}
 */
function getActiveDevicesSince(timeMillis) {
    const activeDeviceIds = [];
    Object.entries(deviceLastActiveTimeMap).forEach(entry => {
        const deviceId = entry[0];
        const lastActiveTime = entry[1];

        if(lastActiveTime !== -1) { // exclude devices which haven't streamed any data after initialization
            if(lastActiveTime > (Date.now() - timeMillis)) { // pick devices active in the last 5 mins
                activeDeviceIds.push(deviceId);
            }
        }
    });

    Object.entries(nonStreamingDevicesMap).forEach(entry => {
        const deviceId = entry[0];
        const handlerId = entry[1];

        // check with handler if this device is still active or not
        // first, find handler obj corresponding to handlerId
        const handler = handlerMap[handlerId];
        // check if the handler has a provision to check the last active time, otherwise skip it
        if(typeof handler.getLastActiveTime === "function") {
            const lastActiveTime = handler.getLastActiveTime(deviceId);
            if(lastActiveTime != null && lastActiveTime > (Date.now() - timeMillis)) {
                activeDeviceIds.push(deviceId);
            }
        } else {
            console.error(`${handlerId} does not provide getLastActiveTime()`);
        }
    });
    return daoHelper.devicesDao.fetchSpecific(activeDeviceIds);
}

messagingService.listenForQuery('get-active-devices', message => {
    const query = message.data.query;
    getActiveDevicesSince(300000).then(devices => {
        messagingService.respondToQuery(query, {
            'devices': devices
        });
    });
});

// process send API request from apps
messagingService.listenForEvent('send-to-device', message => {
    // "_meta": {
    //     "recipient": "app-manager",
    //         "event": "send-to-device"
    // },
    // "payload": {
    //     "device-id": deviceId,
    //         "send-api-data": data
    // }
    const receivedData = message.data;

    const deviceId = receivedData["device-id"];
    const sendAPIData = receivedData["send-api-data"];

    // from the device-id, figure out the handler
    if(nonStreamingDevicesMap.hasOwnProperty(deviceId)) {
        const handlerId = nonStreamingDevicesMap[deviceId];
        const handler = handlerMap[handlerId];

        if(typeof handler.dispatch === 'function') {
            handler.dispatch(deviceId, sendAPIData);
        }
    }
});