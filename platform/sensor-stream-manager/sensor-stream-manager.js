const fs = require("fs-extra");
const mqtt = require("mqtt");
const utils = require("../../utils/utils");
const fetch = require('node-fetch');
const cronParser = require('cron-parser');

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
 * @param {Object} policy
 */
function updatePolicy(type, sensorId, ip, topic, policy) {
    if(type === "app-sensor") {
        if(!privacyPolicy[type][sensorId]) {
            privacyPolicy[type][sensorId] = {};
        }
        if(!privacyPolicy[type][sensorId][ip]) {
            privacyPolicy[type][sensorId][ip] = {};
        }
        privacyPolicy[type][sensorId][ip][topic] = policy;
    } else if(type === "sensor-specific") {
        if(!privacyPolicy[type][sensorId]) {
            privacyPolicy[type][sensorId] = {};
        }
        privacyPolicy[type][sensorId] = policy;
    } else if(type === "app-specific") {
        if(!privacyPolicy[type][ip]) {
            privacyPolicy[type][ip] = {};
        }
        privacyPolicy[type][ip][topic] = policy;
    }
}

/**
 * This function finds the nearest next execution time.
 * @param {string} cron - cron rule
 * @param {Object} now - Date object
 * @param {Object} orgNextExecTime - CronDate object
 * @param {Object} execTime - CronDate object
 * @param {Object} intervals - CronDate object pointer
 * @returns {Object} CronDate object
 */
function updateNextExecTime(cron, now, orgNextExecTime, execTime, intervals) {
    // if the present time is ruled by cron rule
    if(getTimeDifference(now, execTime) >= 0) {
        const cronRules = cron.split(' ');
        // if the cron rule includes `seconds`
        if(cronRules.length === 6) {
            execTime = intervals.next();
        } else {
            // find the nearest time
            let nextUpdateTime = intervals.next();
            let interval = getTimeDifference(nextUpdateTime, execTime);
            while(interval <= 60000) {
                execTime = nextUpdateTime;
                nextUpdateTime = intervals.next();
                interval = getTimeDifference(nextUpdateTime, execTime);
            }
            execTime.addMinute();
        }
    }
    // if orgNextExecTime is undefined or
    // compare the nearest time with orgNextExecTime
    if(!orgNextExecTime || execTime.getTime() < orgNextExecTime.getTime()) {
        return execTime;
    }
    return orgNextExecTime
}

/**
 * This function compile the cron like policy to the execute time
 * @param {Object} policy - cron like policy
 * @param {Object} currentDate - Date object
 * @returns {Object} CronDate object pointer
 */
function compilePolicyToIntervals(policy, currentDate) {
    currentDate.setSeconds(-10);
    const options = {
        "currentDate": currentDate,
        "tz": timeZone
    }
    return cronParser.parseExpression(policy["cron"], options);
}

/**
 * This function pushes the topic to intervalRuleType.
 * It first checks if the sensorId or gatewayIp in the intervalRuleType. If they do
 * not exist, the function will creates them.
 * @param {string} blockTarget - app topic or sensor id
 * @param {Object} intervalRuleType - intervalRule[type]
 * @param {string} key1 - nested policy keys (sensorId, gatewayIp)
 * @param {...string} restkeys - sensorId, gatewayIp
 */
function updateIntervalRule(blockTarget, intervalRuleType, key1, ...restKeys) {
    if(!key1) {
        // sensor-specific goes here
        // push blockTarget to inerval policy
        intervalRuleType.push(blockTarget);
    } else if(restKeys.length === 0) {
        if(!intervalRuleType.hasOwnProperty(key1)) {
            intervalRuleType[key1] = [];
            // push blockTarget to inerval policy
            intervalRuleType[key1].push(blockTarget);
        }
    } else {
        if(!intervalRuleType.hasOwnProperty(key1)) {
            intervalRuleType[key1] = {};
        }
        updateIntervalRule(blockTarget, intervalRuleType[key1], ...restKeys)
    }
}

/**
 * This function checks if the key in the object. If the key does
 * not exist, it creates the key.
 * @param {number} interval - time interval
 * @param {bool} block
 * @param {string} blockTarget - app topic or sensor id
 * @param {Object} intervalRuleType
 * @param {string} key1 - nested policy keys (sensorId, gatewayIp)
 * @param {...string} restkeys - sensorId, gatewayIp
 */
function updateRuleProcedure(interval, block, blockTarget, intervalRuleType, key1, ...restKeys) {
    if(interval >= 0) {
        if(block) {
            updateIntervalRule(blockTarget, intervalRuleType, key1, ...restKeys);
        }
    } else {
        if(!block) {
            updateIntervalRule(blockTarget, intervalRuleType, key1, ...restKeys);
        }
    }
}

/**
 * This function calculate the time interval in milliseconds.
 * @param {Object} date1 - Date or CronDate
 * @param {Object} date2 - Date or CronDate
 * @returns {number} time in millisecond
 */
function getTimeDifference(date1, date2) {
    return date1.getTime() - date2.getTime();
}

/**
 * This function updates sensor-specific interval privacy policy
 * @param {Object} now - Date
 * @param {Object} intervalRule
 * @param {Object} nextUpdateTime - CronDate
 * @returns {Object} CronDate object pointer
 */
function checkSensorSpecificPolicy(now, intervalRule, nextUpdateTime) {
    const type = `sensor-specific`;
    const sensorIds = privacyPolicy[type];
    for(const sensorId in sensorIds) {
        const sensorPolicy = sensorIds[sensorId];
        const intervals = compilePolicyToIntervals(sensorPolicy, new Date(now));
        const execTime = intervals.next();
        const checkInterval = getTimeDifference(now, execTime);
        updateRuleProcedure(checkInterval, sensorPolicy["block"], sensorId, intervalRule[type]);
        nextUpdateTime = updateNextExecTime(sensorPolicy["cron"], now, nextUpdateTime, execTime, intervals);
    }
    return nextUpdateTime;
}

/**
 * This function updates app-specific interval privacy policy
 * @param {Object} now - Date
 * @param {Object} intervalRule
 * @param {Object} nextUpdateTime - CronDate
 * @returns {Object} CronDate object
 */
function checkAppSpecificPolicy(now, intervalRule, nextUpdateTime) {
    const type = `app-specific`;
    const gatewayIps = privacyPolicy[type];
    for(const gatewayIp in gatewayIps) {
        const topics = gatewayIps[gatewayIp];
        for(const topic in topics) {
            const sensorPolicy = topics[topic];
            const intervals = compilePolicyToIntervals(sensorPolicy, new Date(now));
            const execTime = intervals.next();
            const checkInterval = getTimeDifference(now, execTime);
            updateRuleProcedure(checkInterval, sensorPolicy["block"], topic, intervalRule[type], gatewayIp);
            nextUpdateTime = updateNextExecTime(sensorPolicy["cron"], now, nextUpdateTime, execTime, intervals);
        }
    }
    return nextUpdateTime;
}

/**
 * This function updates app-sensor interval privacy policy
 * @param {Object} now - Date
 * @param {Object} intervalRule
 * @param {Object} nextUpdateTime - CronDate
 * @returns {Object} CronDate object
 */
function checkAppSensorPolicy(now, intervalRule, nextUpdateTime) {
    const type = `app-sensor`;
    const sensorIds = privacyPolicy[type];
    for(const sensorId in sensorIds) {
        if(intervalRule["sensor-specific"].includes(sensorId)) {
            continue;
        }
        const gatewayIps = sensorIds[sensorId];
        for(const gatewayIp in gatewayIps) {
            const topics = gatewayIps[gatewayIp];
            for(const topic in topics) {
                if(intervalRule["app-specific"][gatewayIp] &&
                   intervalRule["app-specific"][gatewayIp].includes(topic)) {
                    continue;
                }
                const sensorPolicy = topics[topic];
                const intervals = compilePolicyToIntervals(sensorPolicy, new Date(now));
                const execTime = intervals.next();
                const checkInterval = getTimeDifference(now, execTime);
                updateRuleProcedure(checkInterval,
                                      sensorPolicy["block"],
                                      topic,
                                      intervalRule[type],
                                      sensorId, gatewayIp);
                nextUpdateTime = updateNextExecTime(sensorPolicy["cron"], now, nextUpdateTime, execTime, intervals);
            }
        }
    }
    return nextUpdateTime;
}

function getNextUpdateTime(now) {
    let nextUpdateTime = undefined;
    nextUpdateTime = checkSensorSpecificPolicy(now, intervalRule, nextUpdateTime);
    nextUpdateTime = checkAppSpecificPolicy(now, intervalRule, nextUpdateTime);
    nextUpdateTime = checkAppSensorPolicy(now, intervalRule, nextUpdateTime);
    return nextUpdateTime;
}


/**
 * This function updates the intervalRule.
 * @returns {Object} CronDate object
 */
function getNextUpdateRuleTime() {
    const now = new Date();
    intervalRule = {
        "sensor-specific": [],
        "app-specific": {},
        "app-sensor": {}
    };
    let nextUpdateTime = getNextUpdateTime(now);
    console.log(`[INFO] Updated interval policy: ${JSON.stringify(intervalRule)}`);
    return nextUpdateTime;
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
    if(intervalRule["sensor-specific"].includes(sensorId)) {
        return true;
    }
    if(intervalRule["app-specific"][ip] &&
       intervalRule["app-specific"][ip].includes(topic)) {
        return true;
    }
    if(intervalRule["app-sensor"][sensorId] &&
       intervalRule["app-sensor"][sensorId][ip] &&
       intervalRule["app-sensor"][sensorId][ip].includes(topic)) {
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

/**
 * This function updates the intervalRuleType
 */
function updateRule() {
    // check if next interval exists
    if(nextUpdateRuleTime) {
        if(ruleTimer) {
            // clear setTimeout when update policy
            clearTimeout(ruleTimer);
        }
        const now = new Date();
        // calculate the interval for next execution
        const interval = getTimeDifference(nextUpdateRuleTime, now);
        console.log(`[INFO] Next update time: ${nextUpdateRuleTime}, interval: ${interval}`);
        ruleTimer = setTimeout(() => {
            ruleTimerJob();
        }, interval);
    }
}

/**
 * This function finds the next interval for updating the policy,
 * and updates the intervalRuleType.
 */
function ruleTimerJob() {
    nextUpdateRuleTime = getNextUpdateRuleTime();
    updateRule();
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

// intervalRule stores the blocked sensor-app mapping within this minute.
// intervalRule = {
//     "sensor-specific": ["sensor1"],
//     "app-specific":{
//         "gateway2":["app2"]
//     },
//     "app-sensor": {
//         "sensor2": {
//             "gateway2":["app2"]
//         }
//     }
// }
let intervalRule = {};

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
        console.log(`[INFO] Updated policy: ${JSON.stringify(privacyPolicy)}`);
        ruleTimerJob();
    }
});

const timeZone = "America/New_York";

// nextUpdateRuleTime is a cronDate object which stores the time to update the rule.
let nextUpdateRuleTime = undefined;
// setTimeout object
let ruleTimer = undefined;
// start update the policy
ruleTimerJob();