const BleController = require('ble-controller');
const bleController = BleController.getInstance();

bleController.initialize().then(() => {
     bleController.advertise();
});