//TODO: add mqtt-data-collector logic to SSM.
const MessagingService = require('../messaging-service');

const serviceName = process.env.SERVICE_NAME;
const messagingService = new MessagingService(serviceName);

messagingService.listenForEvent('connect-to-socket', (message) => {
    const payload = message.data;
    const wsAddress = payload["ws-address"];
});