var mqtt  = require('mqtt');
var MQTT_TOPIC_NAME = 'gateway-data';
var noble = require('noble');

var mqtt_client = mqtt.connect('mqtt://localhost');

mqtt_client.on('connect', function () {
    
    // Noble init and stuff
    noble.on('stateChange', handleNobleStateChange);
    noble.on('discover', handleDiscoveredPeripheral);
});

function handleNobleStateChange(state) {
  if (state === 'poweredOn') {
    // noble.startScanning([], true);
    noble.startScanning();
    console.log("[BLE Radio] Started peripheral discovery");
  } else {
    noble.stopScanning();
  }
}

function handleDiscoveredPeripheral(peripheral) {
    //catch the estimotes here

    // mqtt_client.publish(MQTT_TOPIC_NAME, JSON.stringify(adv_obj));

    var localName = peripheral.advertisement.localName;
    var serviceData = peripheral.advertisement.serviceData;

    if(localName) {
        console.log(peripheral);    
    }
    // if(serviceData) {
    //     serviceData.filter(sd => sd.uuid);
    //     console.log(serviceData);
    // }
    console.log("***")
}