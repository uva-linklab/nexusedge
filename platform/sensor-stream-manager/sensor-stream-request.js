class SensorStreamRequest {
    constructor(sensorIds, optimalGatewayDeviceMapping) {
        this.sensorIds = sensorIds;
        this.optimalGatewayDeviceMapping = optimalGatewayDeviceMapping;
    }
}

module.exports = {
    SensorStreamRequest: SensorStreamRequest
};