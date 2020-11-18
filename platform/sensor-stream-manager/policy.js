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
    _reset() {
        this.sensorSpecific = {};
        this.appSpecific = {};
        this.appSensor = {};
    }
    _print() {
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

    /**
     * @param {Object} sensorSpecificPolicy
     * @param {Object} appSpecificPolicy
     * @param {Object} appSensor
     */
    update(sensorSpecificPolicy, appSpecificPolicy, appSensor) {
        this._reset();
        const now = new Date();
        this.nextUpdateTime = undefined;
        this._updateSensorSpecific(now, sensorSpecificPolicy);
        this._updateAppSpecific(now, appSpecificPolicy);
        this._updateAppSensor(now, appSensor);
        console.log(`[INFO] Privacy Rule:`);
        this._print();
    }

    _reset() {
        super._reset();
        this.sensorSpecific = [];
    }
    /**
     * This function walk through sensor-specific policy and update to the
     * sensor-specific rule.
     * @param {Object} now - Date object
     * @param {Object} sensorSpecificPolicy
     */
    _updateSensorSpecific(now, sensorSpecificPolicy) {
        for(const sensorId in sensorSpecificPolicy) {
            const sensorPolicy = sensorSpecificPolicy[sensorId];
            const isInSchedule = sensorPolicy.schedule.isInSchedule(now, this.timeZone);
            const updateTime = sensorPolicy.schedule.getNextScheduleChangeTime();
            this._updateRuleProcedure(isInSchedule, sensorPolicy["block"], sensorId, this.sensorSpecific);
            this._updateNextTime(updateTime);
        }
    }
    /**
     * This function walk through app-specific policy and update the app-specific rule.
     * @param {Object} now - Date object
     * @param {Object} appSpecificPolicy
     */
    _updateAppSpecific(now, appSpecificPolicy) {
        for(const gatewayIp in appSpecificPolicy) {
            const topics = appSpecificPolicy[gatewayIp];
            for(const topic in topics) {
                const sensorPolicy = topics[topic];
                const isInSchedule = sensorPolicy.schedule.isInSchedule(now, this.timeZone);
                const updateTime = sensorPolicy.schedule.getNextScheduleChangeTime();
                this._updateRuleProcedure(isInSchedule, sensorPolicy["block"], topic, this.appSpecific, gatewayIp);
                this._updateNextTime(updateTime);
            }
        }
    }
    /**
     * This function walk through app-sensor policy and update to app-sensor rule.
     * @param {Object} now - Date object
     * @param {Object} appSensor
     */
    _updateAppSensor(now, appSensor) {
        for(const sensorId in appSensor) {
            // if the sensor is already blocked
            // it is not necessary to go through the app sensor policy
            if(this.sensorSpecific.includes(sensorId)) {
                continue;
            }
            const gatewayIps = appSensor[sensorId];
            for(const gatewayIp in gatewayIps) {
                const topics = gatewayIps[gatewayIp];
                for(const topic in topics) {
                    // The application is already blocked
                    if(this.appSpecific.hasOwnProperty(gatewayIp) && this.appSpecific[gatewayIp].includes(topic)) {
                        continue;
                    }
                    const sensorPolicy = topics[topic];
                    const isInSchedule = sensorPolicy.schedule.isInSchedule(now, this.timeZone);
                    const updateTime = sensorPolicy.schedule.getNextScheduleChangeTime();
                    this._updateRuleProcedure(
                        isInSchedule,
                        sensorPolicy["block"],
                        topic,
                        this.appSensor,
                        sensorId, gatewayIp
                    );
                    this._updateNextTime(updateTime);
                }
            }
        }
    }
    /**
     * This function first checks the nested keys in the rule and pushes the
     * topic to rule.
     * @param {string} blockTarget - app topic or sensor id
     * @param {Object} rule - sensorSpecific or appSpecific or appSensor
     * @param {string} key1 - nested policy keys (sensorId, gatewayIp)
     * @param {...string} restkeys - sensorId, gatewayIp
     */
    _updateRule(blockTarget, rule, key1, ...restKeys) {
        if(!key1) {
            // sensor-specific goes here
            // push blockTarget to the rule
            rule.push(blockTarget);
        } else if(restKeys.length > 0) {
            if(!rule.hasOwnProperty(key1)) {
                // create the key in the rule
                rule[key1] = {};
            }
            this._updateRule(blockTarget, rule[key1], ...restKeys)
        } else {
            if(!rule.hasOwnProperty(key1)) {
                rule[key1] = [];
            }
            if(!rule[key1].includes(blockTarget)) {
                // push blockTarget to the rule
                rule[key1].push(blockTarget);
            }
        }
    }

    /**
     * This function checks if the policy should be push to the rule.
     * @param {bool} isInInterval - if current time in the interval
     * @param {bool} block - block or allow
     * @param {string} blockTarget - app topic or sensor id
     * @param {Object} rule - intervalRule[type]
     * @param {string} key1 - nested policy keys (sensorId, gatewayIp)
     * @param {...string} restkeys - sensorId, gatewayIp
     */
    _updateRuleProcedure(isInInterval, block, blockTarget, rule, key1, ...restKeys) {
        if(isInInterval) {
            if(block) {
                this._updateRule(blockTarget, rule, key1, ...restKeys);
            }
        } else {
            if(!block) {
                this._updateRule(blockTarget, rule, key1, ...restKeys);
            }
        }
    }
    /**
     * This function updates `nextUpdateTime`. If `nextUpdateTime` is further than
     * `tempNextUpdateTime`, `nextUpdateTime` will be updated.
     * @param {Object} tempNextUpdateTime - CronDate object
     */
    _updateNextTime(tempNextUpdateTime) {
        if(!this.nextUpdateTime ||
            tempNextUpdateTime.getTime() < this.nextUpdateTime.getTime()) {
                if(tempNextUpdateTime.getSeconds() != 0) {
                    tempNextUpdateTime.addMinute();
                    tempNextUpdateTime.setSeconds(0);
                }
            this.nextUpdateTime = tempNextUpdateTime;
        }
    }
}

class PrivacyPolicy extends PolicyBase {
    constructor(tz) {
        super(tz, {}, {}, {});
        // conditional policy
        this.condition = {};
    }
    /**
     * update privacy policy
     * @param {Object} policy
     */
    update(policy) {
        this._reset();
        if(policy["sensor-specific"]) {
            for(const sensorId in policy["sensor-specific"]) {
                this.sensorSpecific[sensorId] = this._updateSingleTimeBasedPolicy(policy["sensor-specific"][sensorId]);
            }
        }
        if(policy["app-specific"]) {
            for(const gatewayIp in policy["app-specific"]) {
                const topics = policy["app-specific"][gatewayIp]
                for(const topic in topics) {
                    this._isKeyExisted(this.appSpecific, gatewayIp);
                    this.appSpecific[gatewayIp][topic] = this._updateSingleTimeBasedPolicy(topics[topic]);
                }
            }
        }
        if(policy["app-sensor"]) {
            for(const sensorId in policy["app-sensor"]) {
                const gatewayIps = policy["app-sensor"][sensorId];
                for(const gatewayIp in gatewayIps) {
                    const topics = gatewayIps[gatewayIp];
                    for(const topic in topics) {
                        this._isKeyExisted(this.appSensor, sensorId, gatewayIp);
                        this.appSensor[sensorId][gatewayIp][topic] = this._updateSingleTimeBasedPolicy(topics[topic]);
                    }
                }
            }
        }
        console.log(`[INFO] Privacy Policy:`);
        this._print();
    }
    /**
     * Update privacy policy
     * @param {Object} sensorPolicy
     * @return {Object} - compiled single sensor policy
     */
    _updateSingleTimeBasedPolicy(sensorPolicy) {
        return {
            "block": sensorPolicy["block"],
            "schedule": new Schedule(sensorPolicy["schedule"])
        };
    }

    /**
     * Check if nested key exists
     * @param {Object} policy
     */
    _isKeyExisted(policy, key1, ...restKeys) {
        if(restKeys.length === 0) {
            if(!policy.hasOwnProperty(key1)) {
                policy[key1] = {};
            }
        } else {
            if(!policy.hasOwnProperty(key1)) {
                policy[key1] = {};
            }
            this._isKeyExisted(policy[key1], ...restKeys);
        }
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
        this._enforcePolicy();
    }

    /**
     * Check if the sensorId or topic in the block list in the rule.
     * @param {string} sensorId
     * @param {string} ip - gateway ip of the application
     * @param {string} topic - application's topic
     * @returns {bool} - if the sensor is blocked
     */
    isBlocked(sensorId, ip, topic) {
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

    getPolicy() {
        const sensorSpecific = this.policy.getSensorSpecific();
        const appSpecific = this.policy.getAppSpecific();
        const appSensor = this.policy.getAppSensor();
        return {
            "sensor-specific": sensorSpecific,
            "app-specific": appSpecific,
            "app-sensor": appSensor
        };
    }

    _enforcePolicy() {
        const sensorSpecific = this.policy.getSensorSpecific();
        const appSpecific = this.policy.getAppSpecific();
        const appSensor = this.policy.getAppSensor();
        this.rule.update(sensorSpecific, appSpecific, appSensor);
        this._updateTimer();
    }

    /**
     * Calculate the time difference between date1 and date2 and
     * returns the time in milliseconds.
     * @param {Object} date1 - Date or CronDate
     * @param {Object} date2 - Date or CronDate
     * @returns {Number} time in millisecond
     */
    _getTimeDifference(date1, date2) {
        return date1.getTime() - date2.getTime();
    }

    /**
     * Update `timer`. `timer` is an object returned by `setTimeout` function.
     * `timer` will count the time set by `nextUpdateTime` in the rule.
     */
    _updateTimer() {
        const nextUpdateTime = this.rule.getNextUpdateTime();
        // check if next interval exists
        if(nextUpdateTime) {
            if(this.timer) {
                // clear setTimeout when update policy
                clearTimeout(this.timer);
            }
            const now = new Date();
            // calculate the interval for next execution
            const interval = this._getTimeDifference(nextUpdateTime, now);
            console.log(`[INFO] Next update time: ${nextUpdateTime}, interval: ${interval}`);
            this.timer = setTimeout(() => {
                this._enforcePolicy();
            }, interval);
        }
    }
}

module.exports = {
    PolicyEnforcer: PolicyEnforcer
}