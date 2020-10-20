const cronParser = require('@huanglipang/cron-parser');

class Schedule {
    constructor(cronPattern) {
        this.timeBasedPolicy = cronPattern;
        this.intervals = undefined;
    }

    /**
     * @param {Date} now
     * @return {boolean}
     */
    isInSchedule(now, tz) {
        const options = {
            "currentDate": now,
            "tz": tz
        };
        this.intervals = cronParser.parseExpression(this.timeBasedPolicy, options);
        return this.intervals.isInInterval(now);
    }

    /**
     * @return {CronDate}
     */
    getNextScheduleChangeTime() {
        if(this.intervals) {
            return this.intervals.next();
        }
        return null;
    }
}

class PolicyBase {
    constructor() {
        this.sensorSpecific;
        this.appSpecific;
        this.appSensor;
    }
    getSensorSpecific() {
        return this.sensorSpecific;
    }
    getAppSpecific() {
        return this.appSpecific;
    }
    getAppSensor() {
        return this.appSensor;
    }
    print() {
        console.log(`Sensor Specific: ${JSON.stringify(this.sensorSpecific)}`);
        console.log(`App Specific:    ${JSON.stringify(this.appSpecific)}`);
        console.log(`App Sensor:      ${JSON.stringify(this.appSensor)}`);
    }
}

class PrivacyRule extends PolicyBase {
    constructor(tz) {
        super();
        this.sensorSpecific = [];
        this.appSpecific = {};
        this.appSensor = {};
        this.timeZone = tz || "America/New_York";
        this.nextUpdateTime = undefined;
    }
    initialize() {
        this.sensorSpecific = [];
        this.appSpecific = {};
        this.appSensor = {};
    }
    getNextUpdateTime() {
        return this.nextUpdateTime;
    }
    update(sensorSpecificPolicy, appSpecificPolicy, appSensor) {
        this.initialize();
        const now = new Date();
        this.updateSensorSpecific(now, sensorSpecificPolicy);
        this.updateAppSpecific(now, appSpecificPolicy);
        this.updateAppSensor(now, appSensor);
        console.log(`[INFO] Privacy Rule:`);
        this.print();
    }
    updateSensorSpecific(now, sensorSpecificPolicy) {
        for(const sensorId in sensorSpecificPolicy) {
            const sensorPolicy = sensorSpecificPolicy[sensorId];
            const isInSchedule = sensorPolicy.schedule.isInSchedule(now, this.timeZone);
            const updateTime = sensorPolicy.schedule.getNextScheduleChangeTime();
            this.updateRuleProcedure(isInSchedule, sensorPolicy["block"], sensorId, this.sensorSpecific);
            this.updateRuleTime(updateTime);
        }
    }
    /**
     * This function walk through app-specific policy and update to `intervalRule`.
     * @param {Object} now - Date object
     */
    updateAppSpecific(now, appSpecificPolicy) {
        for(const gatewayIp in appSpecificPolicy) {
            const topics = appSpecificPolicy[gatewayIp];
            for(const topic in topics) {
                const sensorPolicy = topics[topic];
                const isInSchedule = sensorPolicy.schedule.isInSchedule(now, this.timeZone);
                const updateTime = sensorPolicy.schedule.getNextScheduleChangeTime();
                this.updateRuleProcedure(isInSchedule, sensorPolicy["block"], topic, this.appSpecific, gatewayIp);
                this.updateRuleTime(updateTime);
            }
        }
    }
    /**
     * This function walk through app-sensor policy and update to `intervalRule`.
     * @param {Object} now - Date object
     */
    updateAppSensor(now, appSensor) {
        for(const sensorId in appSensor) {
            if(this.sensorSpecific.includes(sensorId)) {
                continue;
            }
            const gatewayIps = sensorIds[sensorId];
            for(const gatewayIp in gatewayIps) {
                const topics = gatewayIps[gatewayIp];
                for(const topic in topics) {
                    if(this.appSpecific[gatewayIp] &&
                        this.appSpecific[gatewayIp].includes(topic)) {
                        continue;
                    }
                    const sensorPolicy = topics[topic];
                    const isInSchedule = sensorPolicy.schedule.isInSchedule(now, this.timeZone);
                    const updateTime = sensorPolicy.schedule.getNextScheduleChangeTime();
                    this.updateRuleProcedure(
                        isInSchedule,
                        sensorPolicy["block"],
                        topic,
                        this.appSensor,
                        sensorId, gatewayIp
                    );
                    this.updateRuleTime(updateTime);
                }
            }
        }
    }
    /**
     * This function update `intervalRule`. It first pushes the topic to `intervalRuleType`.
     * It first checks if the sensorId or gatewayIp in the intervalRuleType. Next, push topic or sensorId
     * to the block lists.
     * @param {string} blockTarget - app topic or sensor id
     * @param {Object} intervalRuleType - intervalRule[type]
     * @param {string} key1 - nested policy keys (sensorId, gatewayIp)
     * @param {...string} restkeys - sensorId, gatewayIp
     */
    updateIntervalRule(blockTarget, intervalRuleType, key1, ...restKeys) {
        if(!key1) {
            // sensor-specific goes here
            // push blockTarget to inerval policy
            intervalRuleType.push(blockTarget);
        } else if(restKeys.length === 0) {
            if(!intervalRuleType.hasOwnProperty(key1)) {
                intervalRuleType[key1] = [];
            }
            if(!intervalRuleType[key1].includes(blockTarget)) {
                // push blockTarget to inerval policy
                intervalRuleType[key1].push(blockTarget);
            }
        } else {
            if(!intervalRuleType.hasOwnProperty(key1)) {
                intervalRuleType[key1] = {};
            }
            this.updateIntervalRule(blockTarget, intervalRuleType[key1], ...restKeys)
        }
    }

    /**
     * This function checks if the policy should be update to `intervalRule` or not.
     * @param {bool} isInInterval - if current time in the interval
     * @param {bool} block - block or allow
     * @param {string} blockTarget - app topic or sensor id
     * @param {Object} intervalRuleType - intervalRule[type]
     * @param {string} key1 - nested policy keys (sensorId, gatewayIp)
     * @param {...string} restkeys - sensorId, gatewayIp
     */
    updateRuleProcedure(isInInterval, block, blockTarget, intervalRuleType, key1, ...restKeys) {
        if(isInInterval) {
            if(block) {
                this.updateIntervalRule(blockTarget, intervalRuleType, key1, ...restKeys);
            }
        } else {
            if(!block) {
                this.updateIntervalRule(blockTarget, intervalRuleType, key1, ...restKeys);
            }
        }
    }
    /**
     * This function updates `nextRuleTime`. If `nextRuleTime` is further than `tempNextRuleTime`, `nextRuleTime`
     * will be updated.
     * @param {Object} tempNextUpdateTime - CronDate object
     */
    updateRuleTime(tempNextUpdateTime) {
        // if orgNextUpdateTime is undefined or
        // compare the nearest time with orgNextUpdateTime
        if(!this.nextUpdateTime || tempNextUpdateTime.getTime() < this.nextUpdateTime.getTime()) {
            this.nextUpdateTime = tempNextUpdateTime;
        }
    }
}

class PrivacyPolicy extends PolicyBase {
    constructor(tz) {
        super();
        this.sensorSpecific = {};
        this.appSpecific = {};
        this.appSensor = {};
        this.timeZone = tz || "America/New_York";
    }
    update(policy) {
        if(policy["sensor-specific"]) {
            for(const sensorId in policy["sensor-specific"]) {
                this.sensorSpecific[sensorId] = {
                    "block": policy["sensor-specific"]["block"],
                    "schedule": new Schedule(policy["sensor-specific"]["cron"])
                };
            }
        }
        if(policy["app-specific"]) {
            for(const gatewayIp in policy["app-specific"]) {
                const topics = gatewayIps[gatewayIp]
                for(const topic in topics) {
                    this.appSpecific[gatewayIp][topic] = {
                        "block": policy["sensor-specific"]["block"],
                        "schedule": new Schedule(policy["app-specific"]["cron"])
                    };
                }
            }
        }
        if(policy["app-sensor"]) {
            for(const sensorId in policy["app-sensor"]) {
                const gatewayIps = sensorIds[sensorId];
                for(const gatewayIp in gatewayIps) {
                    const topics = gatewayIps[gatewayIp]
                    for(const topic in topics) {
                        this.appSensor[sensorId][gatewayIp][topic] = {
                            "block": policy["sensor-specific"]["block"],
                            "schedule": new Schedule(policy["app-sensor"]["cron"])
                        };
                    }
                }
            }
        }
        console.log(`[INFO] Privacy Policy:`);
        this.print();
    }
}

class PolicyEnforcer {
    constructor(tz) {
        this.timeZone = tz || "America/New_York";
        this.rule = new PrivacyPolicy(this.timeZone);
        this.policy = new PrivacyRule(this.timeZone);
        this.timer = undefined;
    }
    enforcePolicy() {
        const sensorSpecific = this.policy.getSensorSpecific;
        const appSpecific = this.policy.getAppSpecific;
        const appSensor = this.policy.getAppSensor;
        this.rule.update(sensorSpecific, appSpecific, appSensor);
        this.updateTimer();
    }
    /**
     * This function calculates the time difference between date1 and date2 and returns the time in milliseconds.
     * @param {Object} date1 - Date or CronDate
     * @param {Object} date2 - Date or CronDate
     * @returns {number} time in millisecond
     */
    getTimeDifference(date1, date2) {
        return date1.getTime() - date2.getTime();
    }
    /**
     * This function is used for checking if the sensorId or topic in the block list in `intervalRule`.
     * @param {string} sensorId
     * @param {string} ip - MQTT broker's ip
     * @param {string} topic - application's topic
     * @returns {bool} - if the sensor is blocked
     */
    isBlocked(sensorId, ip, topic) {
        const sensorSpecific = this.rule.getSensorSpecific;
        if(sensorSpecific.includes(sensorId)) {
            return true;
        }
        const appSpecific = this.rule.getAppSpecific;
        if(appSpecific[ip] &&
           appSpecific[ip].includes(topic)) {
            return true;
        }
        const appSensor = this.rule.getAppSensor;
        if(appSensor[sensorId] &&
           appSensor[sensorId][ip] &&
           appSensor[sensorId][ip].includes(topic)) {
            return true;
        }
        return false;
    }
    /**
     * This function updates `timer`. `timer` is an object returned by `setTimeout` function.
     * `timer` will count the time set by `nextRuleTime`.
     */
    updateTimer() {
        const nextUpdateTimer = this.rule.getNextUpdateTime();
        // check if next interval exists
        if(nextUpdateTimer) {
            if(this.timer) {
                // clear setTimeout when update policy
                clearTimeout(this.timer);
            }
            const now = new Date();
            // calculate the interval for next execution
            const interval = this.getTimeDifference(nextUpdateTimer, now);
            console.log(`[INFO] Next update time: ${nextUpdateTimer}, interval: ${interval}`);
            this.timer = setTimeout(() => {
                this.enforcePolicy();
            }, interval);
        }
    }
}
class PolicyRule {
    sensorId: String
    appId: String
    schedule: Schedule
    isActive(): boolean
    getNextRuleChangeTime(): Date
}
class PrivacyPolicy {
    rules: PolicyRule[]

    constructor(policyJson) {
    }
    getNextEnforcementTime(): Date
        minimum of getNextRuleChangeTime() for all rules
    getActiveRules(): PolicyRule[]
        filtered list of rules based on isActive() for all rules
}
class PolicyEnforcer {
    privacyPolicy: PrivacyPolicy
    constructor(privacyPolicy)
    enforcePolicy(): void
        activeRules = privacyPolicy.getActiveRules()
        nextEnforcementTime = privacyPolicy.getNextEnforcementTime()
        setTimeout(enforcePolicy, nextEnforcementTime)
    isBlocked(sensorId, appId): boolean
        iterates through active rules to check if (sensorId, appId) is blocked
}