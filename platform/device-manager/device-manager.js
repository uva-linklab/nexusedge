const handlerUtils = require('./handler-utils');
const MqttController = require('../../utils/mqtt-controller');
const mqttController = MqttController.getInstance();
const daoHelper = require('../dao/dao-helper');

// Using this object as a cache. Stores the deviceId as the key.
const deviceCache = {};

/**
 * This is a function used by handlers to register devices which won't be sending streamed data to the platform
 * @param deviceId
 * @param deviceType
 * @param handlerId
 */
function register(deviceId, deviceType, handlerId) {
    isRegistered(deviceId).then(registered => {
        if(!registered) {
            daoHelper.devicesDao.addDevice(deviceId, deviceType, handlerId);
        }
    });
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
    console.log(`handler ${handlerId} delivered data`);
    console.log(deviceData);

    const deviceId = deviceData['id'];
    const deviceType = deviceData['device']; // TODO change key to deviceType

    isRegistered(deviceId).then(registered => {
        if(!registered) {
            daoHelper.devicesDao.addDevice(deviceId, deviceType, handlerId);

            // also add to cache, the timestamp is unnecessary, but it might come in handy later when we merge
            // mqtt-data-collector and this
            // TODO if we need last seen time of device, move this line after the publish stmt
            deviceCache[deviceId] = Date.now();
        }
        mqttController.publishToPlatformMqtt(JSON.stringify(deviceData)); // publish to platform's default MQTT topic
    });
}

async function isRegistered(deviceId) {
    const deviceInCache = isDeviceInCache(deviceId);
    if(deviceInCache) {
        return true;
    }
    return await isDeviceInDb(deviceId);
}

/**
 * Checks if a device exists in the database or not
 * @param deviceId
 * @return {Promise<boolean>}
 */
async function isDeviceInDb(deviceId) {
    const device = await daoHelper.devicesDao.find(deviceId);
    return (device.length !== 0);
}

/**
 * Checks if a device exists in cache or not
 * @param deviceId
 * @return {boolean}
 */
function isDeviceInCache(deviceId) {
    return deviceCache.hasOwnProperty(deviceId);
}

const platformCallback = {
    'register': register,
    'deliver': deliver
};

handlerUtils.loadHandlers().then(handlerMap => {
    // TODO notify platform manager that we have a problem and exit
    if(!handlerMap) {
    }

    // TODO check if execute exists before performing execute: typeof handlerObj.execute
    // execute each handler object
    // pass the platformCallback object with callback functions that handlers can use
    Object.values(handlerMap).forEach(handlerObj => handlerObj.execute(platformCallback));
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