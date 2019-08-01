var mqtt  = require('mqtt');
var MQTT_TOPIC_NAME = 'gateway-data';
var noble = require('noble');
var estimoteParser = require("./estimote-telemetry-parser");

var mqtt_client = mqtt.connect('mqtt://localhost');

mqtt_client.on('connect', function () {
    
    // Noble init and stuff
    noble.on('stateChange', handleNobleStateChange);
    noble.on('discover', handleDiscoveredPeripheral);
});

function handleNobleStateChange(state) {
  if (state === 'poweredOn') {
    startScan();
  } else {
    noble.stopScanning();
  }
}

function startScan() {
  if(noble.state === 'poweredOn') {
    setTimeout(stopScan, 60000); //scan for 1min
    console.log("Started BLE scan");
    noble.startScanning();
  }
}

function stopScan() {
  console.log("Stopped BLE scan");
  setTimeout(startScan, 180000); //scan every 3mins
  noble.stopScanning();
}

function handleDiscoveredPeripheral(peripheral) {
    var localName = peripheral.advertisement.localName;
    var serviceData = peripheral.advertisement.serviceData;

    const isEstimote = serviceData && (serviceData.filter(sd => sd.uuid === "fe9a").length >=1);
    const isLightingSensor = localName && localName.includes("$L$");

    if(isLightingSensor) {
        var data = {
            "device": "Lighting Sensor", 
            "id": peripheral.id, 
            "_meta": {
                "device_id": peripheral.id, 
                "receiver": "lighting-gateway",
                "gateway_id": noble.address
            }
        };
        mqtt_client.publish(MQTT_TOPIC_NAME, JSON.stringify(data));
        // console.log("lighting sensor found");
        // console.log(data);

    } else if(isEstimote) {
        const telemetryData = serviceData.data;
        var telemetryPacket = estimoteParser.parseEstimoteTelemetryPacket(telemetryData);
        const deviceId = telemetryPacket.shortIdentifier;

        var data = {
            "device": "Estimote", 
            "id": deviceId, 
            "_meta": {
                "device_id": deviceId, 
                "receiver": "estimote-gateway",
                "gateway_id": noble.address
            }
        };

        Object.assign(data, telemetryPacket); //concatenate data and telemetry packet objects
        mqtt_client.publish(MQTT_TOPIC_NAME, JSON.stringify(data));
        // console.log("estimote sensor found");
        // console.log(data);
    }
}
