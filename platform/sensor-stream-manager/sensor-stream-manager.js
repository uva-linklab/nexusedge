const fs = require("fs-extra");
const mqtt = require("mqtt");
const utils = require("../utils/utils");
const fetch = require("node-fetch");
const { PolicyEnforcer } = require("./policy");
const debug = require('debug')('ssm');

const timeZone = "America/New_York";
const policyHelper = new PolicyEnforcer(timeZone);

// TODO: add mqtt-data-collector logic to SSM.
const MessagingService = require("../messaging-service");

/**
 * This function registers topic for local sensors.
 * @param {string} ip - gateway's ip
 * @param {string[]} sensorIds - an array of sensor id
 * @param {string} topic - application's topic
 */
function registerToLocalGateway(ip, sensorIds, topic) {
    for (const id of sensorIds) {
        if (!sensorStreamRouteTable[id]) {
            sensorStreamRouteTable[id] = {};
        }
        if (!sensorStreamRouteTable[id][ip]) {
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
    const heartbeatTopic = `${topic}-heartbeat`;
    const heartbeatTimeMs = 60 * 1000;
    let diagnosticTimer;
    // Request body
    const body = {
        ip: localGatewayIp,
        sensors: sensorIds,
        topic: topic,
        heartbeatTopic: heartbeatTopic,
        heartbeatTimeMs: heartbeatTimeMs
    };
    // Send application's sensor requirement to remote gateway
    fetch(gatewayUrl, {
        method: "POST",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
        timeout: 5000,
    })
        .then((res) => {
            if (res.status === 200) {
                console.log(`[INFO] Sent "${topic}" to ${ip} successfully!`);

                // set the diagnostic timer to check if the remote gateway failed
                diagnosticTimer = setTimeout(handleRemoteGatewayFailure.bind(null, topic, ip), heartbeatTimeMs + (5 * 1000));
                console.log(`set a ${heartbeatTimeMs + (5 * 1000)}ms timer for [${topic}, ${ip}]`);

                // setup a diagnostic timer to check if the remote gateway is active
                const client = connectToMQTTBroker(localGatewayIp);
                client.on("connect", () => {
                    console.log(
                        `[INFO] Connected to MQTT broker at ${localGatewayIp} successfully!`
                    );
                    client.subscribe(heartbeatTopic, (err) => {
                        if (err) {
                            console.error(`[ERROR] Failed to subscribe "${topic}".`);
                            console.error(err);
                        } else {
                            console.log(
                                `[INFO] Subscribed to "${topic}" topic successfully!`
                            );
                        }
                    });
                });

                client.on("message", (heartbeatTopic, message) => {
                    const payload = JSON.parse(message.toString());
                    const remoteGatewayIp = payload["gateway_ip"];

                    console.log(`received heartbeat for [${topic}, ${remoteGatewayIp}]`);
                    clearTimeout(diagnosticTimer);
                    console.log(`cleared timer for timer for [${topic}, ${remoteGatewayIp}]`);
                    diagnosticTimer = setTimeout(handleRemoteGatewayFailure.bind(null, topic, remoteGatewayIp), heartbeatTimeMs + (5 * 1000));
                    console.log(`set a ${heartbeatTimeMs + (5 * 1000)}ms timer for [${topic}, ${remoteGatewayIp}]`);
                });

            } else {
                console.error(
                    `[ERROR] Failed to send "${topic}" to ${ip} with status ${res.status}.`
                );
            }
        })
        .catch((err) => {
            console.error(`[ERROR] Failed to send "${topic}" to ${ip}.`);
            console.error(err);
        });
}

// TODO handle failure
function handleRemoteGatewayFailure(topic, ip) {
    console.log(`remote gateway ${ip} failed for app ${topic}`);
}

/**
 * This function register MQTT clients.
 * @param {string} ip - MQTT broker's ip
 */
function registerMQTTClient(ip) {
    // Check if the MQTT client exists
    if (!mqttClients[ip]) {
        const client = connectToMQTTBroker(ip);
        client.on("connect", () => {
            if (ip === localGatewayIp) {
                subscribeToGatewayData(client);
                routeSensorStreamsToApps(client);
            }
            client.on("disconnect", () => {
                console.log(`[INFO] Disconnected to MQTT broker at ${ip}.`);
            });
            console.log(
                `[INFO] Connected to MQTT broker at ${ip} successfully!`
            );
        });
        mqttClients[ip] = client;
    }
    return mqttClients[ip];
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
 * This function publishes data to application's topic.
 * @param {string} ip - MQTT broker's ip
 * @param {string} topic - application's topic
 * @param {string} data - sensor data
 */
function publishData(ip, topic, data) {
    // Check if the MQTT client exists
    if (!mqttClients[ip]) {
        console.error(`[ERROR] ${ip} has not been registered.`);
        return;
    }
    const client = mqttClients[ip];
    client.publish(topic, data, {}, (err) => {
        if (err) {
            console.error(`[ERROR] Failed to publish to ${ip}.`);
            console.error(err);
        }
    });
}

/**
 * This function lets the local MQTT client
 * subscribes to "nexusedge-data" topic
 * @param {Object} client - MQTT client
 */
function subscribeToGatewayData(client) {
    const mqttTopic = "nexusedge-data";
    client.subscribe(mqttTopic, (err) => {
        if (err) {
            console.error(`[ERROR] Failed to subscribe "${mqttTopic}".`);
            console.error(err);
        } else {
            console.log(
                `[INFO] Subscribed to "${mqttTopic}" topic successfully!`
            );
        }
    });
}

/**
 * This function lets the local MQTT client route
 * the sensor stream to applications
 * @param {Object} client - MQTT client
 */
function routeSensorStreamsToApps(client) {
    client.on("message", (topic, message) => {
        const payload = JSON.parse(message.toString());
        const sensorId = payload["device_id"];

        debug(`received mqtt message from ${sensorId}`);

        if (sensorId in sensorStreamRouteTable) {
            for (const gatewayIp in sensorStreamRouteTable[sensorId]) {
                const topics = sensorStreamRouteTable[sensorId][gatewayIp];
                for (const topic of topics) {
                    // Check if the app is blocked
                    if (!policyHelper.isBlocked(sensorId, gatewayIp, topic)) {
                        // Publish to application's topic
                        publishData(gatewayIp, topic, JSON.stringify(payload));
                        debug(`publishing data of ${sensorId} to ${topic} @ ${gatewayIp}`);
                    }
                }
            }
        }
    });
}

console.log("[INFO] Initialize sensor-stream-manager...");
const serviceName = process.env.SERVICE_NAME;
const messagingService = new MessagingService(serviceName);

const localGatewayIp = utils.getGatewayIp();
if (!localGatewayIp) {
    console.error(
        "[ERROR] No IP address found. Please ensure the config files are set properly."
    );
    process.exit(1);
}
console.log(`[INFO] Gateway's ip address is ${localGatewayIp}`);

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

// mqttClients = {
//     "gateway-ip": client
// }
const mqttClients = {};

registerMQTTClient(localGatewayIp);

messagingService.listenForEvent("connect-to-socket", (message) => {
    const payload = message.data;
    const wsAddress = payload["ws-address"];
});

/**
 * Given a list of devices and the current link graph of the network, finds out which gateways host those devices.
 * Returns a dictionary of gateway->[sensor-ids]
 * @param devicesIds List of sensor ids
 * @param linkGraph Current link graph of the network
 * @returns {Promise<{}>} Promise object of the gateway->[sensor-id] mapping
 */
async function getHostGateways(devicesIds, linkGraph) {
    const gatewayDeviceMapping = {};
    const data = linkGraph["data"];

    for (const [gatewayId, gatewayData] of Object.entries(data)) {
        const gatewayDeviceList = gatewayData["devices"];
        const gatewayIp = gatewayData["ip"];

        //for each device given to us, find out if that is present in the device list of the current gw
        for (let i = 0; i < devicesIds.length; i++) {
            const targetDeviceId = devicesIds[i];
            const matchFound = gatewayDeviceList.find(function (device) {
                return device["id"] === targetDeviceId;
            });
            //there's a match
            if (matchFound) {
                if (gatewayIp in gatewayDeviceMapping) {
                    gatewayDeviceMapping[gatewayIp].push(targetDeviceId);
                } else {
                    gatewayDeviceMapping[gatewayIp] = [targetDeviceId];
                }
            }
        }
    }
    return gatewayDeviceMapping;
}

/**
 * For a given gateway - device mapping, filters out duplicate devices to return a optimal set of devices
 * Tries to maximize number of devices on each gateway. Tries to reduce number of gateways.
 * @param gatewayDeviceMapping
 * @return {Object}
 */
function getOptimalGatewayDeviceMapping(gatewayDeviceMapping) {
    const localDevices = gatewayDeviceMapping.hasOwnProperty(localGatewayIp) ? gatewayDeviceMapping[localGatewayIp] : [];
    const optimalGatewayDeviceMapping = {
        [localGatewayIp]: localDevices
    };

    const remoteGatewayDeviceMapping = {};
    // exclude devices from remote gateways that are obtainable from local gateway
    for (const [gatewayIp, devices] of Object.entries(gatewayDeviceMapping)) {
        if(gatewayIp !== localGatewayIp) {
            // get the exclusive devices that this remote gateway offers
            const exclusiveDevices = [...difference(new Set(devices), new Set(localDevices))]; // [...set] gives an array
            if(exclusiveDevices.length !== 0) {
                // add that to a new js object
                remoteGatewayDeviceMapping[gatewayIp] = exclusiveDevices;
            }
        }
    }

    const remoteGateways = Object.keys(remoteGatewayDeviceMapping); // list of remote gateways
    // do a pairwise set difference of the device list. we always take the difference from smaller list - larger list
    // eg: before => {g1: [s1,s2,s3], g2: [s3,s7], g3: [s4], g4: [s4,s5], g5: [s4,s5,s6]}
    //     after =>  {g1: [s1,s2,s3], g2: [s7], g3: [], g4: [], g5: [s4,s5,s6]}
    for(let i=0; i<remoteGateways.length; i++) {
        for(let j=i+1; j<remoteGateways.length; j++) {
            let devicesI = remoteGatewayDeviceMapping[remoteGateways[i]];
            let devicesJ = remoteGatewayDeviceMapping[remoteGateways[j]];
            if(devicesI.length <= devicesJ.length) {
                remoteGatewayDeviceMapping[remoteGateways[i]] = [...difference(new Set(devicesI), new Set(devicesJ))];
            } else {
                remoteGatewayDeviceMapping[remoteGateways[j]] = [...difference(new Set(devicesJ), new Set(devicesI))];
            }
        }
    }

    // combine the local and remote gateway-device mappings
    Object.assign(optimalGatewayDeviceMapping, remoteGatewayDeviceMapping);

    // remove gateways without any devices
    for (const [gatewayIp, devices] of Object.entries(optimalGatewayDeviceMapping)) {
        if(devices.length === 0) {
            delete optimalGatewayDeviceMapping[gatewayIp];
        }
    }

    return optimalGatewayDeviceMapping;
}

/**
 * Provides the set difference between two sets
 * @param setA
 * @param setB
 * @return {Set<any>}
 */
function difference(setA, setB) {
    let _difference = new Set(setA);
    for (let elem of setB) {
        _difference.delete(elem);
    }
    return _difference;
}

// sensor-stream-manager receives an application's topic and sensor requirements and provides it
messagingService.listenForEvent("request-streams", (message) => {
    // appData = {
    //     "topic": appId,
    //     "metadataPath": appData.metadataPath
    // }
    const appData = message.data;
    if (
        appData.hasOwnProperty("topic") &&
        appData.hasOwnProperty("metadataPath")
    ) {
        // load application's metadata
        let metadata = fs.readJsonSync(appData["metadataPath"]);
        if(metadata.hasOwnProperty("devices")) {
            const devices = metadata["devices"];
            if(devices.hasOwnProperty("ids")) {
                const deviceIds = devices["ids"];

                // identify the gateways that can provide the device streams
                utils.getLinkGraph().then(linkGraph => {
                    getHostGateways(deviceIds, linkGraph).then(gatewayDeviceMapping => {
                        const optimalGatewayDeviceMapping = getOptimalGatewayDeviceMapping(gatewayDeviceMapping);

                        const topic = appData["topic"];
                        // store application's sensor stream requirement in sensorStreamRouteTable
                        for (const ip in optimalGatewayDeviceMapping) {
                            const sensorIds = gatewayDeviceMapping[ip];
                            // store the sensor connected to local gateway
                            if (ip === localGatewayIp) {
                                registerToLocalGateway(ip, sensorIds, topic);
                            } else {
                                registerToRemoteGateway(ip, sensorIds, topic);
                            }
                        }
                        console.log(`[INFO] Streams set up for application ${topic} successfully!`);
                    });
                });
            }
        } else {
            console.error("invalid metadata file received. no device information present.");
        }
    }
});

function sendHeartbeat(mqttClient, ip, heartbeatTopic) {
    mqttClient.publish(heartbeatTopic, JSON.stringify({gateway_ip: localGatewayIp}));
    console.log(`sent heartbeat to ${heartbeatTopic} on gateway ${ip}`);
}

messagingService.listenForEvent("register-topic", (message) => {
    // appData = {
    //     ip: localGatewayIp,
    //     sensors: sensorIds,
    //     topic: topic,
    //     heartbeatTopic: heartbeatTopic,
    //     heartbeatTimeMs: heartbeatTimeMs
    // }
    const params = message.data;

    const sensorIds = params["sensors"];
    const topic = params["topic"];
    const ip = params["ip"];
    const heartbeatTopic = params["heartbeatTopic"];
    const heartbeatTimeMs = params["heartbeatTimeMs"];
    const mqttClient = registerMQTTClient(ip);
    registerToLocalGateway(ip, sensorIds, topic);

    console.log("set the timer for sending heartbeat");

    // send a heartbeat to the heartbeat topic every heartbeatTimeMs
    setInterval(sendHeartbeat.bind(null, mqttClient, ip, heartbeatTopic), heartbeatTimeMs);
});

messagingService.listenForEvent("update-policy", (message) => {
    const data = message.data;
    if (data["policy"]) {
        policyHelper.update(data["policy"]);
    }
});

messagingService.listenForQuery('retrieve-policy', message => {
    const query = message.data.query;
    const policy = policyHelper.getPolicy();
    messagingService.respondToQuery(query, policy);
});