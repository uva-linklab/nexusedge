const fs = require("fs-extra");
const mqtt = require("mqtt");
const utils = require("../../utils/utils");
const fetch = require('node-fetch');
const cronParser = require('cron-parser');
const cronJob = require('cron').CronJob;

// TODO: add mqtt-data-collector logic to SSM.
const MessagingService = require('../messaging-service');

/**
 * This function registers topic for local sensors.
 * @param {string} ip - gateway's ip
 * @param {string[]} sensorIds - an array of sensor id
 * @param {string} topic - application's topic
 */
function registerToLocalGateway(ip, sensorIds, topic) {
    for(const id of sensorIds) {
        if(!sensorStreamRouteTable[id]) {
            sensorStreamRouteTable[id] = {};
        }
        if(!sensorStreamRouteTable[id][ip]) {
            sensorStreamRouteTable[id][ip] = [];
        }
        sensorStreamRouteTable[id][ip].push(topic);
    }
}

/**
 * This function sends sensor requirement to the remote gateway.
 * @param {string} ip -remote gateway's ip
 * @param {string[]} sensorIds - an array of sensor id
 * @param {string} topic - application's topic
 */
function registerToRemoteGateway(ip, sensorIds, topic) {
    // Remote gateway's register-topic url
    const gatewayUrl = `http://${ip}:5000/gateway/register-app-sensor-requirement`;
    // Request body
    const body = {
        ip: gatewayIp,
        sensors: sensorIds,
        topic: topic,
    };
    // Send application's sensor requirement to remote gateway
    fetch(gatewayUrl, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: {'Content-Type': 'application/json'},
        timeout: 5000
    }).then(res => {
        if(res.status === 200) {
            console.log(`[INFO] Sent "${topic}" to ${ip} successfully!`);
        } else {
            console.error(`[ERROR] Failed to send "${topic}" to ${ip} with status ${res.status}.`);
        }
    }).catch(err => {
        console.error(`[ERROR] Failed to send "${topic}" to ${ip}.`);
        console.error(err);
    });
}

/**
 * This function register MQTT clients.
 * @param {string} ip - MQTT broker's ip
 */
function registerMQTTClient(ip) {
    // Check if the MQTT client exists
    if(!mqttClients[ip]) {
        const client = connectToMQTTBroker(ip);
        client.on('connect', () => {
            if(ip === gatewayIp) {
                subscribeToGatewayData(client);
                routeSensorStreamsToApps(client);
            }
            client.on('disconnect', () => {
                console.log(`[INFO] Disconnected to MQTT broker at ${ip}.`);
            });
            console.log(`[INFO] Connected to MQTT broker at ${ip} successfully!`);
        });
        mqttClients[ip] = client;
    }
}

/**
 * This function connects to MQTT broker
 * @param {string} ip - MQTT broker's ip
 * @returns {Object} - MQTT client
 */
function connectToMQTTBroker(ip) {
    const url = `mqtt://${ip}`;
    // Connect to mqtt broker
    return mqtt.connect(url);
}

/**
 * This function updates the privacyPolicy
 * @param {string} type - app-specific, sensor-specific, app-sensor
 * @param {string} sensorId
 * @param {string} ip - MQTT broker's ip
 * @param {string} topic - application's topic
 * @param {object} policy
 */
function updatePolicy(type, sensorId, ip, topic, policy) {
    if(type === "app-sensor") {
        if(!privacyPolicy[type][sensorId]) privacyPolicy[type][sensorId] = {};
        if(!privacyPolicy[type][sensorId][ip]) privacyPolicy[type][sensorId][ip] = {};
        privacyPolicy[type][sensorId][ip][topic] = policy;
    } else if(type === "sensor-specific") {
        if(!privacyPolicy[type][sensorId]) privacyPolicy[type][sensorId] = {};
        privacyPolicy[type][sensorId] = policy;
    } else if(type === "app-specific") {
        if(!privacyPolicy[type][ip]) privacyPolicy[type][ip] = {};
        privacyPolicy[type][ip][topic] = policy;
    }
}

/**
 * This function updates the privacyPolicyInterval
 */
function findInterval() {
    const now = new Date();
    privacyPolicyInterval = {
        "sensor-specific": [],
        "app-specific": {},
        "app-sensor": {}
    };
    let type = "sensor-specific";
    let sensorIds = privacyPolicy[type];
    let nextInterval = undefined;
    for(const sensorId in sensorIds) {
        const sensorPolicy = sensorIds[sensorId];
        const currentDate = new Date(now);
        currentDate.setSeconds(-10);
        const options = {
            "currentDate": currentDate,
            "tz": timeZone
        }
        const interval = cronParser.parseExpression(sensorPolicy["cron"], options);
        const nextExecuteTime = interval.next();
        const checkRange = now.getTime() - nextExecuteTime.getTime();
        if(checkRange >= 0) {
            if(sensorPolicy["block"]) {
                privacyPolicyInterval["sensor-specific"].push(sensorId);
            }
        } else {
            if(!sensorPolicy["block"]) {
                privacyPolicyInterval["sensor-specific"].push(sensorId);
            }
        }
        let tempNextInterval = interval.next();
        if(nextInterval) {
            if(tempNextInterval.getTime() < nextInterval.getTime()) nextInterval = tempNextInterval;
        } else {
            nextInterval = tempNextInterval;
        }
    }
    type = "app-specific";
    let gatewayIps = privacyPolicy[type];
    for(const gatewayIp in gatewayIps) {
        const topics = gatewayIps[gatewayIp];
        for(const topic in topics) {
            const sensorPolicy = topics[topic];
            const currentDate = new Date(now);
            currentDate.setSeconds(-10);
            const options = {
                "currentDate": currentDate,
                "tz": timeZone
            }
            const interval = cronParser.parseExpression(sensorPolicy["cron"], options);
            const nextExecuteTime = interval.next();
            const checkRange = now.getTime() - nextExecuteTime.getTime();
            if(checkRange >= 0) {
                if(sensorPolicy["block"]) {
                    if(!privacyPolicyInterval["app-specific"][gatewayIp]) {
                        privacyPolicyInterval["app-specific"][gatewayIp] = [];
                    }
                    privacyPolicyInterval["app-specific"][gatewayIp].push(topic);
                }
            } else {
                if(!sensorPolicy["block"]) {
                    if(!privacyPolicyInterval["app-specific"][gatewayIp]) {
                        privacyPolicyInterval["app-specific"][gatewayIp] = [];
                    }
                    privacyPolicyInterval["app-specific"][gatewayIp].push(topic);
                }
            }
            let tempNextInterval = interval.next();
            if(nextInterval) {
                if(tempNextInterval.getTime() < nextInterval.getTime()) nextInterval = tempNextInterval;
            } else {
                nextInterval = tempNextInterval;
            }
        }
    }
    type = "app-sensor"
    sensorIds = privacyPolicy[type];
    for(const sensorId in sensorIds) {
        if(privacyPolicyInterval["sensor-specific"].includes(sensorId)) {
            continue;
        }
        const gatewayIps = sensorIds[sensorId];
        for(const gatewayIp in gatewayIps) {
            const topics = gatewayIps[gatewayIp];
            for(const topic in topics) {
                if(privacyPolicyInterval["app-specific"][gatewayIp] &&
                   privacyPolicyInterval["app-specific"][gatewayIp].includes(topic)) {
                    continue;
                }
                const sensorPolicy = topics[topic];
                const currentDate = new Date(now);
                currentDate.setSeconds(-10);
                const options = {
                    "currentDate": currentDate,
                    "tz": timeZone
                }
                const interval = cronParser.parseExpression(sensorPolicy["cron"], options);
                const nextExecuteTime = interval.next();
                const checkRange = now.getTime() - nextExecuteTime.getTime();
                if(checkRange >= 0) {
                    if(sensorPolicy["block"]) {
                        if(!privacyPolicyInterval[type][sensorId]) {
                            privacyPolicyInterval[type][sensorId] = {};
                        }
                        if(!privacyPolicyInterval[type][sensorId][gatewayIp]) {
                            privacyPolicyInterval[type][sensorId][gatewayIp] = [];
                        }
                        privacyPolicyInterval[type][sensorId][gatewayIp].push(topic);
                    }
                } else {
                    if(!sensorPolicy["block"]) {
                        if(!privacyPolicyInterval[type][sensorId]) {
                            privacyPolicyInterval[type][sensorId] = {};
                        }
                        if(!privacyPolicyInterval[type][sensorId][gatewayIp]) {
                            privacyPolicyInterval[type][sensorId][gatewayIp] = [];
                        }
                        privacyPolicyInterval[type][sensorId][gatewayIp].push(topic);
                    }
                }
                let tempNextInterval = interval.next();
                if(nextInterval) {
                    if(tempNextInterval.getTime() < nextInterval.getTime()) nextInterval = tempNextInterval;
                } else {
                    nextInterval = tempNextInterval;
                }
            }
        }
    }
    if(nextInterval) console.log("next update time:", nextInterval.toString())
    return nextInterval;
}

/**
 * This function checks the policyMinute
 * if sensorId - ip - topic exists in the Policy,
 * the data should be blocked (return true).
 * @param {string} sensorId
 * @param {string} ip - MQTT broker's ip
 * @param {string} topic - application's topic
 * @returns {bool} - if the sensor is blocked
 */
function checkPolicy(sensorId, ip, topic) {
    if(privacyPolicyInterval["sensor-specific"].includes(sensorId)) {
        return true;
    }
    if(privacyPolicyInterval["app-specific"][ip] &&
       privacyPolicyInterval["app-specific"][ip].includes(topic)) {
           return true;
    }
    if(privacyPolicyInterval["app-sensor"][sensorId] &&
       privacyPolicyInterval["app-sensor"][sensorId][ip] &&
       privacyPolicyInterval["app-sensor"][sensorId][ip].includes(topic)) {
        return true;
    }
    return false;
}

/**
 * This function publishes data to application's topic.
 * @param {string} ip - MQTT broker's ip
 * @param {string} topic - application's topic
 * @param {string} data - sensor data
 */
function publishData(ip, topic, data) {
    // Check if the MQTT client exists
    if(!mqttClients[ip]) {
        console.error(`[ERROR] ${ip} has not been registered.`);
        return;
    }
    const client = mqttClients[ip];
    client.publish(topic, data, {}, err => {
        if(err) {
            console.error(`[ERROR] Failed to publish to ${ip}.`);
            console.error(err);
        }
    });
}

/**
 * This function lets the local MQTT client
 * subscribes to "gateway-data" topic
 * @param {Object} client - MQTT client
 */
function subscribeToGatewayData(client) {
    const mqttTopic = "gateway-data";
    // Subscribe to "gateway-data"
    client.subscribe(mqttTopic, (err) => {
        if (err) {
            console.error(`[ERROR] Failed to subscribe "${mqttTopic}".`);
            console.error(err);
        } else {
            console.log(`[INFO] Subscribed to "${mqttTopic}" topic successfully!`);
        }
    });
}

/**
 * This function lets the local MQTT client route
 * the sensor stream to applications
 * @param {Object} client - MQTT client
 */
function routeSensorStreamsToApps(client) {
    client.on('message', (topic, message) => {
        const payload = JSON.parse(message.toString());
        const sensorId = payload["_meta"]["device_id"];
        if(sensorId in sensorStreamRouteTable) {
            for(const gatewayIp in sensorStreamRouteTable[sensorId]) {
                const topics = sensorStreamRouteTable[sensorId][gatewayIp];
                for(const topic of topics) {
                    // Check policy
                    if(!checkPolicy(sensorId, gatewayIp, topic)) {
                        // Publish to application's topic
                        publishData(gatewayIp, topic, JSON.stringify(payload));
                        console.log(`published to ${gatewayIp}  ${topic}`)
                    }
                }
            }
        }
    });
}

console.log("[INFO] Initialize sensor-stream-manager...");
const serviceName = process.env.SERVICE_NAME;
const messagingService = new MessagingService(serviceName);

// get gateway's ip
const gatewayIp = utils.getIPAddress();
if(!gatewayIp) {
  console.error("[ERROR] No IP address found. Please ensure the config files are set properly.");
  process.exit(1);
}
console.log(`[INFO] Gateway's ip address is ${gatewayIp}`);

// sensorStreamRouteTable stores the sensor id and application topic mapping
// the key is sensor id and the value is an object
// with the key is gateway ip and the value is an array of application's topics
// sensor-stream-manager uses sensorStreamRouteTable to publish sensor stream data
// check the example below
// sensorStreamRouteTable = {
//     "sensor1-id": {
//         "gateway1-ip": [ "app1-topic", "app2-topic" ],
//         "geteway2-ip": [ "app3-topic"]
//     },
//     "sensor2-id": {
//         "gateway1-ip": [ "app1-topic" ],
//         "geteway2-ip": [ "app3-topic"]
//     }
// }
const sensorStreamRouteTable = {};

// |---------------------------------------------|
// |               Privacy Policy                |
// |--------|------|---------------|-------------|
// | sensor | app  | interval      | block/allow |
// |--------|------|---------------|-------------|
// | s1     | app1 | * 06-07 * * * | true        |
// | *      | app2 | * 08-17 * * * | true        |
// | s2,s3  | *    | * 0-12 * * *  | false       |
// |--------|------|---------------|-------------|

// cron format
// *    *    *    *    *    *
// ┬    ┬    ┬    ┬    ┬    ┬
// │    │    │    │    │    |
// │    │    │    │    │    └ day of week (0 - 7) (0 or 7 is Sun)
// │    │    │    │    └───── month (1 - 12)
// │    │    │    └────────── day of month (1 - 31)
// │    │    └─────────────── hour (0 - 23)
// │    └──────────────────── minute (0 - 59)
// └───────────────────────── second (0 - 59, optional)

// privacyPolicy = {
//     "app-specific": {
//         "app1": {
//             "block": true,
//             "cron": "* 09-10,13-15 * * *",
//         }
//     },
//     "sensor-specific": {
//         "sensor1-id": {
//             "block": false,
//             "cron": "* 09-10,13-15 * * *",
//         }
//     },
//     "app-sensor": {
//         "sensor1-id": {
//             "gateway1-ip": {
//                 "app1-topic": {
//                     "block": false,
//                     "cron": "* 09-10,13-15 * * *",
//                 }
//             }
//         }
//     }
// }
const privacyPolicy = {
    "app-specific": {},
    "sensor-specific": {},
    "app-sensor": {}
};

// privacyPolicyInterval stores the blocked sensor-app mapping within this minute.
// privacyPolicyInterval = {
//     sensor1: {
//         gateway1: [topic1]
//     }
// }
let privacyPolicyInterval = {};

// mqttClients = {
//     "gateway-ip": client
// }
const mqttClients = {};

registerMQTTClient(gatewayIp);

messagingService.listenForEvent('connect-to-socket', (message) => {
    const payload = message.data;
    const wsAddress = payload["ws-address"];
});

// sensor-stream-manager receives application's process instance and metadata from app-manager
// this listener stores the application's topic and sensor requirement
messagingService.listenForEvent('app-deployment', message => {
    // appData = {
    //     "app": {
    //         "app": newApp, // instance of process,
    //         "pid": newApp.pid,
    //         "_id": appId,
    //         "appPath": newAppPath,
    //         "metadataPath": metadataPath,
    //     }
    // };
    const appData = message.data;
    if(appData["app"]) {
        // load application's metadata
        let metadata = fs.readJsonSync(appData["app"]["metadataPath"]);
        metadata = metadata["sensorMapping"];
        const topic = appData["app"]["_id"];
        // store application's sensor stream requirement in sensorStreamRouteTable
        for(const ip in metadata) {
            const sensorIds = metadata[ip];
            // store the sensor connected to local gateway
            if(ip === gatewayIp) {
                registerToLocalGateway(ip, sensorIds, topic);
            } else {
                registerToRemoteGateway(ip, sensorIds, topic);
            }
        }
        console.log(`[INFO] Registered application "${topic}" successfully!`);
    }
});

messagingService.listenForEvent("register-topic", message => {
    // appData = {
    //     "app": {
    //         "topic": topic,
    //         "ip": ip,
    //         "sensors": sensorIds
    //     }
    // }
    const appData = message.data;
    if(appData["app"]) {
        const sensorIds = appData["app"]["sensors"];
        const topic = appData["app"]["topic"];
        const ip = appData["app"]["ip"];
        registerMQTTClient(ip);
        registerToLocalGateway(ip, sensorIds, topic);
    }
});

messagingService.listenForEvent("update-policy", message => {
    // data = {
    //     "policy": {
    //         "app-specific": {
    //             "app1": {
    //                 "block": true,
    //                 "cron": "* 09-10,13-15 * * *",
    //             }
    //         },
    //         "sensor-specific": {
    //             "sensor1-id": {
    //                 "block": false,
    //                 "cron": "* 09-10,13-15 * * *",
    //             }
    //         },
    //         "app-sensor": {
    //             "sensor1-id": {
    //                 "gateway1-ip": {
    //                     "app1-topic": {
    //                         "block": false,
    //                         "cron": "* 09-10,13-15 * * *",
    //                     }
    //                 }
    //             }
    //         }
    //     }
    // };
    const data = message.data;
    if(data["policy"]) {
        const policy = data["policy"];
        for(const type in policy) {
            if(type === "app-sensor") {
                const sensorIds = policy[type];
                for(const sensorId in sensorIds) {
                    const gatewayIps = sensorIds[sensorId];
                    for(const gatewayIp in gatewayIps) {
                        const topics = gatewayIps[gatewayIp]
                        for(const topic in topics) {
                            updatePolicy(type, sensorId, gatewayIp, topic, topics[topic]);
                        }
                    }
                }
            } else if(type === "sensor-specific") {
                const sensorIds = policy[type];
                for(const sensorId in sensorIds) {
                    updatePolicy(type, sensorId, undefined, undefined, sensorIds[sensorId]);
                }
            } else if(type === "app-specific") {
                const gatewayIps = policy[type];
                for(const gatewayIp in gatewayIps) {
                    const topics = gatewayIps[gatewayIp]
                    for(const topic in topics) {
                        updatePolicy(type, undefined, gatewayIp, topic, topics[topic]);
                    }
                }
            }
        }
        console.log(`update policy: ${JSON.stringify(privacyPolicy)}`);
        nextInterval = findInterval();
        console.log(nextInterval);
        updatePolicyJob();
    }
});

const timeZone = "Asia/Taipei";
// const updatePolicyJob = new cronJob({
//     "cronTime": '0 * * * * *',
//     "onTick": () => {
//         console.log(`[INFO] Updated privacyPolicyInterval at ${Date.now()}`);
//         console.time("updatePolicyMinute");
//         updatePolicyMinute();
//         console.timeEnd("updatePolicyMinute");
//         console.log(`update pulicy in minute: ${JSON.stringify(privacyPolicyInterval)}`);
//     },
//     "timeZone": timeZone
// });

// console.log(`[INFO] Started to update privacy policy cron job.`);
// updatePolicyJob.start();
let nextInterval = findInterval();
let policyTimeout = undefined;
updatePolicyJob();
function updatePolicyJob() {
    if(nextInterval) {
        if(policyTimeout) {
            clearTimeout(policyTimeout);
        }
        let now = new Date();
        let nextIntervalTime = nextInterval.getTime() - now.getTime();
        console.log(`${now}, next interval: ${nextIntervalTime}`);
        policyTimeout = setTimeout(() => {
            nextInterval = findInterval();
            console.log(new Date(), "next interval: ", nextIntervalTime);
            updatePolicyJob()
        }, nextIntervalTime);
    }
}