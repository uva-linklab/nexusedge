var cron = require('cron');
var cronJob = cron.job("*/5 * * * * *", function(){
    // perform operation e.g. GET request http.get() etc.
    console.log('cron job completed');
}); 
cronJob.start();