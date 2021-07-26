const fetch = require('node-fetch');

module.exports.sendGetRequest = function(url) {
    return fetch(url, {
        method: 'GET'
    });
};

module.exports.sendPostRequest = function(url, data) {
    fetch(url, {
        method: 'POST',
        body: JSON.stringify(data),
        headers: {'Content-Type': 'application/json'},
        timeout: 5000
    }).then(res => {
        if(res.status === 200) {
            console.log(`[oracle] Request to ${url} completed successfully!`);
        } else {
            console.log(`[oracle] Request to ${url} failed. HTTP status code = ${res.status}`);
        }
    }).catch(err => {
        console.error(`[oracle] Failed request for url ${url}.`);
        console.error(err);
    });
};