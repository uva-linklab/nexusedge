const Oracle = require('../../oracle');
const oracle = new Oracle();

oracle.disseminateAll("testData", {
    "state":"on"
});