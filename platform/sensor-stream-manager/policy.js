const cronParser = require('cron-parser');

let timeZone = "America/New_York";

// nextRuleTime is a cronDate object which stores the time to update the rule.
let nextRuleTime = undefined;
// setTimeout object
let timer = undefined;

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
 * This function calculate the time interval in milliseconds.
 * @param {Object} date1 - Date or CronDate
 * @param {Object} date2 - Date or CronDate
 * @returns {number} time in millisecond
 */
function getTimeDifference(date1, date2) {
    return date1.getTime() - date2.getTime();
}

function getUpdateRuleMaterial(sensorPolicy, now) {
    const intervals = compilePolicyToIntervals(sensorPolicy, new Date(now));
    const updateTime = intervals.next();
    const timeDiff = getTimeDifference(now, updateTime);
    return [intervals, updateTime, timeDiff];
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
function updateRuleProcedure(timeDiff, block, blockTarget, intervalRuleType, key1, ...restKeys) {
    if(timeDiff >= 0) {
        if(block) {
            updateIntervalRule(blockTarget, intervalRuleType, key1, ...restKeys);
        }
    } else {
        if(!block) {
            updateIntervalRule(blockTarget, intervalRuleType, key1, ...restKeys);
        }
    }
}

function getNextChangeTime(updateTime, intervals) {
    // find the nearest time
    let tempNextUpdateTime = intervals.next();
    let interval = getTimeDifference(tempNextUpdateTime, updateTime);
    while(interval <= 60000) {
        updateTime = tempNextUpdateTime;
        tempNextUpdateTime = intervals.next();
        interval = getTimeDifference(tempNextUpdateTime, updateTime);
    }
    updateTime.addMinute();
    return updateTime;
}

/**
 * This function finds the nearest next execution time.
 * @param {string} cron - cron rule
 * @param {Object} now - Date object
 * @param {Object} orgNextUpdateTime - CronDate object
 * @param {Object} updateTime - CronDate object
 * @param {Object} intervals - CronDate object pointer
 * @returns {Object} CronDate object
 */
function getTempNextRuleTime(cron, now, updateTime, intervals) {
    let tempNextUpdateTime = updateTime;
    // check if `updateTime` is in the this minute
    if(getTimeDifference(now, tempNextUpdateTime) >= 0) {
        const cronRules = cron.split(' ');
        // if the cron rule includes "seconds"
        if(cronRules.length === 6) {
            tempNextUpdateTime = intervals.next();
        } else {
            tempNextUpdateTime = getNextChangeTime(tempNextUpdateTime, intervals);
        }
    }
    return tempNextUpdateTime;
}

function updateRuleTime(tempNextRuleTime) {
    // if orgNextUpdateTime is undefined or
    // compare the nearest time with orgNextUpdateTime
    if(!nextRuleTime || tempNextRuleTime.getTime() < nextRuleTime.getTime()) {
        nextRuleTime = tempNextRuleTime;
    }
}

function updateRuleTimeProcedure(cron, now, updateTime, intervals) {
    const tempNextRuleTime = getTempNextRuleTime(cron, now, updateTime, intervals);
    updateRuleTime(tempNextRuleTime);
}

/**
 * This function updates sensor-specific interval privacy policy
 * @param {Object} now - Date
 * @param {Object} intervalRule
 * @param {Object} nextRuleTime - CronDate
 * @returns {Object} CronDate object pointer
 */
function updateRuleBySensorSpecificPolicy(now) {
    const type = `sensor-specific`;
    const sensorIds = privacyPolicy[type];
    for(const sensorId in sensorIds) {
        const sensorPolicy = sensorIds[sensorId];
        const [intervals, updateTime, timeDiff] = getUpdateRuleMaterial(sensorPolicy, now);
        updateRuleProcedure(timeDiff, sensorPolicy["block"], sensorId, intervalRule[type]);
        updateRuleTimeProcedure(sensorPolicy["cron"], now, updateTime, intervals);
    }
}

/**
 * This function updates app-specific interval privacy policy
 * @param {Object} now - Date
 * @param {Object} intervalRule
 * @param {Object} nextRuleTime - CronDate
 * @returns {Object} CronDate object
 */
function updateRuleByAppSpecificPolicy(now) {
    const type = `app-specific`;
    const gatewayIps = privacyPolicy[type];
    for(const gatewayIp in gatewayIps) {
        const topics = gatewayIps[gatewayIp];
        for(const topic in topics) {
            const sensorPolicy = topics[topic];
            const [intervals, updateTime, timeDiff] = getUpdateRuleMaterial(sensorPolicy, now);
            updateRuleProcedure(timeDiff, sensorPolicy["block"], topic, intervalRule[type], gatewayIp);
            updateRuleTimeProcedure(sensorPolicy["cron"], now, updateTime, intervals);
        }
    }
    return nextRuleTime;
}

/**
 * This function updates app-sensor interval privacy policy
 * @param {Object} now - Date
 * @param {Object} intervalRule
 * @param {Object} nextRuleTime - CronDate
 * @returns {Object} CronDate object
 */
function updateRuleByAppSensorPolicy(now) {
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
                const [intervals, updateTime, timeDiff] = getUpdateRuleMaterial(sensorPolicy, now);
                updateRuleProcedure(
                    timeDiff,
                    sensorPolicy["block"],
                    topic,
                    intervalRule[type],
                    sensorId, gatewayIp
                );
                updateRuleTimeProcedure(sensorPolicy["cron"], now, updateTime, intervals);
            }
        }
    }
    return nextRuleTime;
}

/**
 * This function updates the intervalRule.
 * @returns {Object} CronDate object
 */
function updateRuleJob() {
    const now = new Date();
    intervalRule = {
        "sensor-specific": [],
        "app-specific": {},
        "app-sensor": {}
    };
    nextRuleTime = undefined;
    updateRuleBySensorSpecificPolicy(now);
    updateRuleByAppSpecificPolicy(now);
    updateRuleByAppSensorPolicy(now);
    console.log(`[INFO] Updated interval policy: ${JSON.stringify(intervalRule)}`);
}

/**
 * This function updates the intervalRuleType
 */
function updateTimer() {
    // check if next interval exists
    if(nextRuleTime) {
        if(timer) {
            // clear setTimeout when update policy
            clearTimeout(timer);
        }
        const now = new Date();
        // calculate the interval for next execution
        const interval = getTimeDifference(nextRuleTime, now);
        console.log(`[INFO] Next update time: ${nextRuleTime}, interval: ${interval}`);
        timer = setTimeout(() => {
            ruleTimerJob();
        }, interval);
    }
}

/**
 * This function finds update intervalRule and start rule timer
 */
function ruleTimerJob() {
    updateRuleJob();
    updateTimer();
}

/**
 * This function sets time zone.
 * @param {string} tz - time zone
 */
function setTimeZone(tz) {
    timeZone = tz;
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
 * This function returns `privacyPolicy`
 * @returns {Object}
 */
function getPrivacyPolicy() {
    return privacyPolicy;
}

/**
 * This function returns `intervalRule`
 * @returns {Object}
 */
function getIntervalRule() {
    return intervalRule;
}

module.exports = {
    getPolicy: getPrivacyPolicy,
    getRule: getIntervalRule,
    check: checkPolicy,
    update: updatePolicy,
    setTimeZone: setTimeZone,
    startRuleTimer: ruleTimerJob
}