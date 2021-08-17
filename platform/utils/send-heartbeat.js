const utils = require('./utils');
const MqttController = require('./mqtt-controller');
const mqttController = MqttController.getInstance();

function getHeartbeatMessage() {
    const message = {
        "device": "nexusedge-gateway",
        "gateway_ip": utils.getGatewayIp(),
        "_meta": {
            "received_time": new Date().toISOString(),
            "device_id": utils.getGatewayId()
        }
    };
    return JSON.stringify(message);
}

function send() {
    mqttController.publish("localhost", "gateway-data", getHeartbeatMessage());
}

setInterval(send, 15*60*1000);