process.env.NOBLE_MULTI_ROLE = 1;

/*
use abandonware fork of noble bleno because the original repo is not maintained and do not work with node.js
versions 8 and above.
https://github.com/noble/node-bluetooth-hci-socket/issues/84
*/
var noble = require('@abandonware/noble');
var mqtt  = require('mqtt');
var debug = require('debug')('ble-peripheral-scanner');
var estimoteParser = require("./estimote-telemetry-parser");

const MQTT_TOPIC_NAME = 'gateway-data';
var mqttClient = mqtt.connect('mqtt://localhost');

mqttClient.on('connect', function () {
    // initialize noble after mqtt client connection is open
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
    debug("Started BLE scan");
    noble.startScanning();
  }
}

function stopScan() {
  debug("Stopped BLE scan");
  setTimeout(startScan, 180000); //scan every 3mins
  noble.stopScanning();
}

// Packets from the estimote family (Telemetry, Connectivity, etc.) are
// broadcast as Service Data (per "§ 1.11. The Service Data - 16 bit UUID" from
// the BLE spec), with the Service UUID 'fe9a'.
const ESTIMOTE_SERVICE_UUID = 'fe9a';

//TODO: get actual data from the lighting sensors and not just its metadata
function handleDiscoveredPeripheral(peripheral) {
    //detecting lighting sensors
    const localName = peripheral.advertisement.localName;
    const isLightingSensor = localName && localName.includes("$L$");

    //detecting estimotes
    var estimoteServiceData = peripheral.advertisement.serviceData.find(function(el) {
      return el.uuid === ESTIMOTE_SERVICE_UUID;
    });
    const isEstimote = (estimoteServiceData !== undefined);

    var data = {};

    if(isLightingSensor) {
        data["device"] = "Lighting Sensor";
        data["id"] = peripheral.id;
        data["_meta"] = {
            "received_time": new Date().toISOString(),
            "device_id": peripheral.id,
            "receiver": "ble-peripheral-scanner",
            "gateway_id": noble.address
        };

        mqttClient.publish(MQTT_TOPIC_NAME, JSON.stringify(data));
    } else if(isEstimote) {
        const telemetryData = estimoteServiceData.data;
        const telemetryPacket = estimoteParser.parseEstimoteTelemetryPacket(telemetryData);

        if(!telemetryPacket)
            return;

        data["device"] = "Estimote";
        data["id"] = telemetryPacket.shortIdentifier;
        data["_meta"] = {
            "received_time": new Date().toISOString(),
            "device_id": telemetryPacket.shortIdentifier,
            "receiver": "ble-peripheral-scanner",
            "gateway_id": noble.address
        };

        //concatenate data and telemetry packet objects
        Object.assign(data, telemetryPacket);
        mqttClient.publish(MQTT_TOPIC_NAME, JSON.stringify(data));
    }
}