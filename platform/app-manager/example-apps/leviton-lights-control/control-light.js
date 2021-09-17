const Oracle = require('../../oracle');
const oracle = new Oracle();

// send a control message to turn on BLE lights
console.log("sent a request to turn on the light");
oracle.send("f0c77f0f5768", {
        "requestType": "stateControl",
        "payload": {
            "state": "on"
        }
    }
);
