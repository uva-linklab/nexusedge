const Oracle = require('../../index');
const oracle = new Oracle();

// to subscribe for sensor data from a specific device
oracle.receive("d0b5c2900bfd", message => {
    console.log(message);
});

// to send data to a specific device
oracle.send("ab123cd323d", {
    "state": "on"
});