const Oracle = require('../../index');
const oracle = new Oracle();

// Send a query with the tag queryData. Wait for its response with the tag queryDataResponse.
oracle.queryAll("queryData", "queryDataResponse", {
    "data": "someData"
});

oracle.on('disseminate-all', function(tag, data) {
    if(tag === 'queryDataResponse') {
        console.log("obtained query response data");
        console.log(data);
    }
});