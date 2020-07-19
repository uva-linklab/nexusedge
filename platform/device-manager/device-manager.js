const handlerUtils = require('./handler-utils');
const MqttController = require('../../utils/mqtt-controller');
const mqttController = MqttController.getInstance();

// TODO add proper functions
function deliver(handler, deviceData) {
    // TODO set the metadata here rather than in the handlers
    // deviceData["_meta"] = {
    //     "received_time": new Date().toISOString(),
    //     "receiver": "ble-peripheral-scanner", // TODO remove
    //     "handler": handler,
    //     "controller": "jabaa", // TODO get it from teh json file mapping
    //     "gateway_id": this.bleScanner.getMacAddress()
    // };
    console.log(`handler ${handler} delivered data`);
    console.log(deviceData);

    const deviceId = deviceData['id'];
    if(isRegistered(deviceId)) {
        mqttController.publishToPlatformMqtt(JSON.stringify(deviceData)); // publish to platform's default MQTT topic
    } else {
        // db.addDevice(deviceId, deviceType, handler); // TODO
    }
}

// TODO
function isRegistered(deviceId) {
    // return (deviceExistsCache(deviceId) || deviceExistsDB(deviceId));
    return true;
}

const platformCallback = {
    'deliver': deliver
};

handlerUtils.loadHandlers().then(handlerMap => {
    // TODO notify platform manager that we have a problem and exit
    if(!handlerMap) {
    }

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