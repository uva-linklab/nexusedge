//TODO: add mqtt-data-collector logic to SSM.
const ipcHelper = require('../ipc-helper');
const path = require("path");
const WebSocket = require('ws');

ipcHelper.register(process.env.SERVICE_NAME);

ipcHelper.subscribeForEvent('connect-to-socket', (message) => {
    const payload = message.data;
    const wsAddress = payload["ws-address"];
});