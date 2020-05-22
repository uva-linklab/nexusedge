const utils = require("../../../utils");

class GatewayScanner {
    constructor(groupKey) {
        this.groupKey = groupKey;
    }

    handlePeripheral(peripheral) {
        const localName = peripheral.advertisement.localName;
        if(typeof localName !== "undefined") {
            const discoveredIp = utils.decryptAES(localName.toString('utf8'), this.groupKey.key, this.groupKey.iv);
            console.log("[gateway-scanner] Gateway discovered: " + peripheral.address);
            console.log(`[gateway-scanner] IP Address = ${discoveredIp}`);
            this.saveNeighborDataToDB(peripheral.address, discoveredIp);
        }
    }

    // TODO do we need to have one single DB handler somewhere else?
    saveNeighborDataToDB(peripheralName, peripheralIp) {
        // db.collection('neighbors').updateOne(
        //     { "_id" : peripheralName },
        //     { $set: { "_id": peripheralName, "IP_address": peripheralIp, "ts" : Date.now()} },
        //     { upsert: true },
        //     function(err, result) {
        //         debug("datapoint stored to db");
        //     }
        // );
        console.log("[gateway-scanner] data point stored to db");
    }
}

module.exports = GatewayScanner;