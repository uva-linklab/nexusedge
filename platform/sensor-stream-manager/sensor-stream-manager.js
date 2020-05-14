//TODO: add mqtt-data-collector logic to SSM.
const PlatformMessenger = require('../platform-messenger');

const platformMessenger = new PlatformMessenger(process.env.SERVICE_NAME);

platformMessenger.subscribeForEvent('connect-to-socket', (message) => {
    const payload = message.data;
    const wsAddress = payload["ws-address"];
});