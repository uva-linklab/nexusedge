const publisherUtils = require('./publishers/publisher-utils');
const MessagingService = require("../messaging-service");
const MqttController = require('../utils/mqtt-controller');
const mqttController = MqttController.getInstance();

console.log("[INFO] Initialize data-publish-manager...");
const serviceName = process.env.SERVICE_NAME;
const messagingService = new MessagingService(serviceName);

let publishers = [];

/**
 * notifies platform manager that we have a problem
 * @param errorMsg the error message
 */
function throwPlatformError(errorMsg) {
    const errorObj = {
        "service": "data-publish-manager",
        "error": errorMsg
    };
    process.send(JSON.stringify(errorObj));
    console.error("errorMsg");
}

publisherUtils.loadPublishers().then(publisherList => {
    if(publisherList == null) {
        throwPlatformError("loadPublishers(): There was a problem loading the handlers.");
    }
    publishers = publisherList;

    // initialize publishers
    publishers.forEach(publisher => {
        // check if publisher has an execute function
        if(typeof publisher.initialize === 'function' && typeof publisher.onData === 'function') {
            publisher.initialize();
        } else {
            throwPlatformError(`${publisher} does not have an initialize() and/or onData() function`);
        }
    });
});

mqttController.subscribeToPlatformMqtt(data => {
    Object.values(publishers).forEach(publisher => {
        publisher.onData(data);
    });
});