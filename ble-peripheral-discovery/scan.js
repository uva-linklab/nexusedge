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
    startScan();
  } else {
    noble.stopScanning();
  }
}

function startScan() {
  if(noble.state === 'poweredOn') {
    setTimeout(stopScan, 60000); //1min
    console.log("Started BLE scan");
    noble.startScanning();
  }
}

function stopScan() {
  console.log("Stopped BLE scan");
  setTimeout(startScan, 300000); //5mins
  noble.stopScanning();
}

function handleDiscoveredPeripheral(peripheral) {
    var localName = peripheral.advertisement.localName;
    var serviceData = peripheral.advertisement.serviceData;

    const isEstimote = serviceData && (serviceData.filter(sd => sd.uuid === "fe9a").length >=1);
    const isLightingSensor = localName && localName.includes("$L$");

    if(isEstimote || isLightingSensor) {
        const device = isEstimote ? "Estimote" : "Lighting Sensor";
        const device_id = peripheral.id;
        const gateway_id = noble.address;
        const receiver = "ble-gateway";

        const data = {
            "device": device, 
            "id": device_id, 
            "_meta": {
                "device_id": device_id, 
                "receiver": receiver,
                "gateway_id": gateway_id
            }
        };
        mqtt_client.publish(MQTT_TOPIC_NAME, JSON.stringify(data));
    }
}
