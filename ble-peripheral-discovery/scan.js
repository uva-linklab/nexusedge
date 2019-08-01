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

// Packest from the Estimote family (Telemetry, Connectivity, etc.) are
// broadcast as Service Data (per "§ 1.11. The Service Data - 16 bit UUID" from
// the BLE spec), with the Service UUID 'fe9a'.
var ESTIMOTE_SERVICE_UUID = 'fe9a';

function handleDiscoveredPeripheral(peripheral) {
    //detecting lighting sensors
    var localName = peripheral.advertisement.localName;
    const isLightingSensor = localName && localName.includes("$L$");

    //detecting estimotes
    var estimoteServiceData = peripheral.advertisement.serviceData.find(function(el) {
      return el.uuid == ESTIMOTE_SERVICE_UUID;
    });
    const isEstimote = (estimoteServiceData !== undefined);
    
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
        const telemetryData = estimoteServiceData.data;
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
