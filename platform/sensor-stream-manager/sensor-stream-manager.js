//TODO: add mqtt-data-collector logic to SSM.
const PlatformMessenger = require('../messaging-service');
const platformMessenger = new PlatformMessenger(process.env.SERVICE_NAME);

platformMessenger.listenForEvent('connect-to-socket', (message) => {
    const payload = message.data;
    const wsAddress = payload["ws-address"];
});