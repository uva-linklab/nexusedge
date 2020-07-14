// TODO WIP
// initialize device handlers that are registered to handle peripherals using the BleScanner object
const GatewayScanner = require("./device-handlers/gateway-scanner/gateway-scanner");
const EstimoteScanner = require("./device-handlers/estimote-scanner/estimote-scanner");
const LightingScanner = require("./device-handlers/lighting-scanner/lighting-scanner");
const OortSocketHandler = require("./device-handlers/oort-socket-handler/oort-socket-handler");
const gatewayScanner = new GatewayScanner(bleScanner, groupKey);
const estimoteScanner = new EstimoteScanner(bleScanner);
const lightingScanner = new LightingScanner(bleScanner);
const oortSocketHandler = new OortSocketHandler(bleScanner);

const deviceHandlers = [gatewayScanner, estimoteScanner, lightingScanner, oortSocketHandler];

// create a map of deviceType -> handler. deviceType is the type of devices that the handler handles.
const deviceHandlerMap = {};
deviceHandlers.forEach(handler => {
    if(handler.deviceType === undefined) {
        throw `deviceType not set for handler ${handler.constructor.name}`
    }
    deviceHandlerMap[handler.deviceType] = handler;
});

// TODO add implementation
function getHandlerForDeviceId(deviceId) {
    return oortSocketHandler;
}

function getHandlerForDeviceType(deviceType) {
    let handler = null;
    if(deviceHandlerMap.hasOwnProperty(deviceType))
        handler =  deviceHandlerMap[deviceType];
    return handler;
}

// when ble-controller obtains a message to be passed on to another gateway, we pass it on to GatewayScanner
messagingService.listenForEvent('talk-to-gateway', message => {
    const messageToSend = message.data;

    const gatewayIP = messageToSend["gateway-ip"];
    const payload = messageToSend["gateway-msg-payload"];

    gatewayScanner.connectToDevice(gatewayIP, payload);
});

// Takes payload from the send API in the app which is relayed via api-server's talkToManager API
messagingService.listenForEvent('send-to-device', message => {
    const receivedData = message.data;

    const deviceId = receivedData["device-id"];
    const sendAPIData = receivedData["send-api-data"];

    // TODO
    // from the device-id, figure out which handler
    const handler = getHandlerForDeviceId(deviceId);

    handler.connectToDevice(deviceId, sendAPIData);
});