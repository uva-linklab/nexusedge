module.exports.logWithTs = logWithTs;

function logWithTs(log) {
  console.log(`[${getCurrentDateTime()}] ${log}`);
}

function getCurrentDateTime() {
  return new Date().toLocaleString("en-US", {timeZone: "America/New_York"});
}