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

class ConditionalSensor {
    constructor(type, condition, value) {
        this.type = type || null;
        this.condtion = condition || null;
        this.value = value || null;
        this.status = undefined;
    }
    update(value) {
        if(this.type === "numerical") {
            if(this.condition === ">") {
                if(value > this.value) {
                    this.status = true;
                } else {
                    this.status = false;
                }
            } else if(this.condition === ">=") {
                if(value >= this.value) {
                    this.status = true;
                } else {
                    this.status = false;
                }
            } else if(this.condition === "<") {
                if(value < this.value) {
                    this.status = true;
                } else {
                    this.status = false;
                }
            } else if(this.condition === "<=") {
                if(value <= this.value) {
                    this.status = true;
                } else {
                    this.status = false;
                }
            }
        } else if(this.type === "boolean") {
            if(this.condition) {
                this.status = value;
            } else {
                this.status = !value;
            }
        }
    }
    isBlocked() {
        if(this.status === undefined) return false;
        return this.status;
    }
}

class PolicyBase {
    constructor(tz, sensorSpecific, appSpecific, appSensor) {
        this.sensorSpecific = sensorSpecific;
        this.appSpecific = appSpecific;
        this.appSensor = appSensor;
        this.timeZone = tz;
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
    reset() {
        this.sensorSpecific = [];
        this.appSpecific = {};
        this.appSensor = {};
    }
    print() {
        console.log(`Sensor Specific:   ${JSON.stringify(this.sensorSpecific)}`);
        console.log(`App Specific:      ${JSON.stringify(this.appSpecific)}`);
        console.log(`App Sensor:        ${JSON.stringify(this.appSensor)}`);
    }
}

class PrivacyRule extends PolicyBase {
    constructor(tz) {
        super(tz, [], {}, {});
        this.nextUpdateTime = undefined;
    }
    getNextUpdateTime() {
        return this.nextUpdateTime;
    }
    reset() {
        super.reset();
        this.sensorSpecific = [];
    }
    update(sensorSpecificPolicy, appSpecificPolicy, appSensor) {
        this.reset();
        const now = new Date();
        this.nextUpdateTime = undefined;
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
            const gatewayIps = appSensor[sensorId];
            for(const gatewayIp in gatewayIps) {
                const topics = gatewayIps[gatewayIp];
                for(const topic in topics) {
                    if(this.appSpecific.hasOwnProperty(gatewayIp) && this.appSpecific[gatewayIp].includes(topic)) {
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
        super(tz, {}, {}, {});
        // conditional policy
        // this.condition = {
        //     "sensor1": {
        //         "temperature1": {
        //             "type": "numerical",
        //             "condition": ">=",
        //             "value": 25
        //         },
        //         "occupancy": {
        //             "type": "boolean",
        //             "condition": true,
        //             "value": null
        //         }
        //     }
        // }
        this.condition = {};
    }
    reset() {
        super.reset();
        this.condition = {};
    }
    update(policy) {
        this.reset();
        if(policy["condition"]) {
            for(const sensorId in policy["condition"]) {
                this.condition[sensorId] = {};
                for(const conditionalSensorId in policy["condition"][sensorId]) {
                    this.condition[sensorId][conditionalSensorId] = new ConditionalSensor(
                        policy["condition"][sensorId][conditionalSensorId]["type"],
                        policy["condition"][sensorId][conditionalSensorId]["condition"],
                        policy["condition"][sensorId][conditionalSensorId]["value"]
                    );
                }
            }
        }
        if(policy["sensor-specific"]) {
            for(const sensorId in policy["sensor-specific"]) {
                this.sensorSpecific[sensorId] = this.updateSinglePolicy(policy["sensor-specific"][sensorId]);
            }
        }
        if(policy["app-specific"]) {
            for(const gatewayIp in policy["app-specific"]) {
                const topics = policy["app-specific"][gatewayIp]
                for(const topic in topics) {
                    this.isKeyExisted(this.appSpecific, gatewayIp);
                    this.appSpecific[gatewayIp][topic] = this.updateSinglePolicy(topics[topic]);
                }
            }
        }
        if(policy["app-sensor"]) {
            for(const sensorId in policy["app-sensor"]) {
                const gatewayIps = policy["app-sensor"][sensorId];
                for(const gatewayIp in gatewayIps) {
                    const topics = gatewayIps[gatewayIp];
                    for(const topic in topics) {
                        this.isKeyExisted(this.appSensor, sensorId, gatewayIp);
                        this.appSensor[sensorId][gatewayIp][topic] = this.updateSinglePolicy(topics[topic]);
                    }
                }
            }
        }
        console.log(`[INFO] Privacy Policy:`);
        this.print();
    }
    getCondition() {
        return this.condition;
    }
    updateSinglePolicy(source) {
        return {
            "block": source["block"],
            "schedule": new Schedule(source["schedule"])
        };
    }
    isKeyExisted(target, key1, ...restKeys) {
        if(restKeys.length === 0) {
            if(!target.hasOwnProperty(key1)) {
                target[key1] = {};
            }
        } else {
            if(!target.hasOwnProperty(key1)) {
                target[key1] = {};
            }
            this.isKeyExisted(target[key1], ...restKeys);
        }
    }
    print() {
        super.print();
        console.log(`Condition:         ${JSON.stringify(this.condition)}`);
    }
}

class PolicyEnforcer {
    constructor(tz) {
        this.timeZone = tz || "America/New_York";
        this.rule = new PrivacyRule(this.timeZone);
        this.policy = new PrivacyPolicy(this.timeZone);
        this.timer = undefined;
    }
    update(policy) {
        this.policy.update(policy);
        this.enforcePolicy();
    }
    /**
     * This function is used for checking if the sensorId or topic in the block list in `intervalRule`.
     * @param {string} sensorId
     * @param {string} ip - MQTT broker's ip
     * @param {string} topic - application's topic
     * @returns {bool} - if the sensor is blocked
     */
    isBlocked(sensorId, ip, topic) {
        const dependency = this.policy.getDependency();
        if(sensorId in dependency) {
            const condition = this.policy.getCondition();
            for(const conditionalSensor of dependency[sensorId]) {
                if(condition[conditionalSensor].isBlocked()) {
                    return true;
                }
            }
        }
        const sensorSpecific = this.rule.getSensorSpecific();
        if(sensorSpecific.includes(sensorId)) {
            return true;
        }
        const appSpecific = this.rule.getAppSpecific();
        if(appSpecific[ip] &&
           appSpecific[ip].includes(topic)) {
            return true;
        }
        const appSensor = this.rule.getAppSensor();
        if(appSensor[sensorId] &&
           appSensor[sensorId][ip] &&
           appSensor[sensorId][ip].includes(topic)) {
            return true;
        }
        return false;
    }
    updateCondition(sensorId, value) {
        const condition = this.policy.getCondition();
        for(const targetSensorId in condition) {
            if(sensorId in condition[targetSensorId]) {
                condition[targetSensorId][sensorId].update(value);
            }
        }
    }
    enforcePolicy() {
        const sensorSpecific = this.policy.getSensorSpecific();
        const appSpecific = this.policy.getAppSpecific();
        const appSensor = this.policy.getAppSensor();
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
     * This function updates `timer`. `timer` is an object returned by `setTimeout` function.
     * `timer` will count the time set by `nextRuleTime`.
     */
    updateTimer() {
        const nextUpdateTime = this.rule.getNextUpdateTime();
        // check if next interval exists
        if(nextUpdateTime) {
            if(this.timer) {
                // clear setTimeout when update policy
                clearTimeout(this.timer);
            }
            const now = new Date();
            // calculate the interval for next execution
            const interval = this.getTimeDifference(nextUpdateTime, now);
            console.log(`[INFO] Next update time: ${nextUpdateTime}, interval: ${interval}`);
            this.timer = setTimeout(() => {
                this.enforcePolicy();
            }, interval);
        }
    }
}

module.exports = {
    PolicyEnforcer: PolicyEnforcer
}