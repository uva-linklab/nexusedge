const MqttController = require('../utils/mqtt-controller');
const daoHelper = require('../platform/dao/dao-helper');
const debug = require('debug')('mqtt-data-collector');

const mqttController = MqttController.getInstance();
mqttController.subscribeToPlatformMqtt(message => {
    const data = JSON.parse(message);

    const sensorId = data._meta.device_id;
    const sensorDevice = data.device;
    const gatewayId = data._meta.gateway_id;
    const receiver = data._meta.receiver;

    daoHelper.sensorsDao.upsertSensorData(sensorId, sensorDevice, gatewayId, receiver);
    debug("datapoint stored to db");
});