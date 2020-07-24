const handlerUtils = require('./handler-utils');
const MqttController = require('../../utils/mqtt-controller');
const mqttController = MqttController.getInstance();
const daoHelper = require('../dao/dao-helper');
const MessagingService = require('../messaging-service');

const serviceName = process.env.SERVICE_NAME;
const messagingService = new MessagingService(serviceName);
// keep track of a device's last active time. deviceId -> lastActiveTime.
// For devices that have streamed data, this will contain the last time that we receive a msg
// For devices that don't stream data, lastActiveTime = -1.
// This object doubles as a cache to check if a device was already registered or not.
const deviceLastActiveTime = {};

// deviceId -> [{}, {}, ..]
// Registration is a db operation and thus takes time. During this time, we buffer the data from that device.
// Once registration is done, we publish all buffered data in received order.
const pendingDeviceBuffer = {};

/**
 * This is a function used by handlers to register devices which won't be sending streamed data to the platform
 * @param deviceId
 * @param deviceType
 * @param handlerId
 */
function register(deviceId, deviceType, handlerId) {
    if(!isDeviceInCache(deviceId)) {
        daoHelper.devicesDao.addDevice(deviceId, deviceType, handlerId);
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
            daoHelper.devicesDao.addDevice(deviceId, deviceType, handlerId).then(() => {
                // once the device registration is complete, add device to cache
                deviceLastActiveTime[deviceId] = Date.now();

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
            deviceLastActiveTime[deviceId] = Date.now();
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
    return deviceLastActiveTime.hasOwnProperty(deviceId);
}

const platformCallback = {
    'register': register,
    'deliver': deliver
};

handlerUtils.loadHandlers().then(handlerMap => {
    // TODO notify platform manager that we have a problem and exit
    if(!handlerMap) {
    }

    // deviceLastActiveTime is used as a cache. Populate this by loading all devices in db.
    // ensures that the cache contains all the registered devices.
    daoHelper.devicesDao.fetchAll().then(devices => {
        devices.forEach(device => {
            deviceLastActiveTime[device["_id"]] = -1; // initialize the lastActiveTime to -1.
        });
        // TODO check if execute exists before performing execute: typeof handlerObj.execute
        // execute each handler object
        // pass the platformCallback object with callback functions that handlers can use
        Object.values(handlerMap).forEach(handlerObj => handlerObj.execute(platformCallback));
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
// // Takes payload from the send API in the app which is relayed via api-server's talkToManager API
// messagingService.listenForEvent('send-to-device', message => {
//     const receivedData = message.data;
//
//     const deviceId = receivedData["device-id"];
//     const sendAPIData = receivedData["send-api-data"];
//
//     // TODO
//     // from the device-id, figure out which handler
//     const handler = getHandlerForDeviceId(deviceId);
//
//     handler.connectToDevice(deviceId, sendAPIData);
// });