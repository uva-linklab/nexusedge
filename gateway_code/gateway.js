var Request = require("request");
var noble = require("noble");
var bleno = require("bleno");
var cron = require('cron');
var fs = require('fs');
var aes_crypto = require("./aes_crypto");
var EchoCharacteristic = require('./characteristic');

register_url = process.argv[2];
ip_addr = process.argv[3];
params_file = "params.json";

ranging_key = "";
iv = "";

var BlenoPrimaryService = bleno.PrimaryService;

if(!register_url){
  console.log("Please provide register url");
  process.exit(1);
}

if(!ip_addr){
  console.log("Please provide ip address");
  process.exit(1);
}

bleno.on('advertisingStart', function(error) {
  console.log('on -> advertisingStart: ' + (error ? 'error ' + error : 'success'));

  // if (!error) {
  //   bleno.setServices([
  //     new BlenoPrimaryService({
  //       uuid: 'ec00',
  //       characteristics: [
  //         new EchoCharacteristic()
  //       ]
  //     })
  //   ]);
  // }
});

bleno.on('stateChange', handleBlenoStateChange);

function loadKeyParams(callback) {
  if (!fs.existsSync(params_file)) {
    callback("")
  } else {
    fs.readFile(params_file, 'utf-8', function handleReadFile(err, data) {
      if (err) 
        throw err;
      key_params = JSON.parse(data);
      callback(key_params);
    });
  }
}

function registerWithServer(mac_address, user, pass) {
  var http_post_req_params = {
      "headers": { "content-type": "application/json" },
      "url": register_url,
      "body": JSON.stringify({
          "radioMACAddress": mac_address,
          "user": user,
          "pass": pass
      })
  };
  Request.post(http_post_req_params, handlePOSTResponse);
}

function handlePOSTResponse(error, response, body) {
  if(error) {
      return console.dir(error);
  }
  var key_params = JSON.parse(body);
  ranging_key = key_params.ranging_key;
  iv = key_params.iv;
  console.log('Succesfuly received params from gateway server!');
  console.log(ranging_key);
  console.log(iv);
  fs.writeFile(params_file,  JSON.stringify(key_params), 'utf-8', handleWriteFileError);
  //start advertising once we have the key
  startAdvertising();
}

function handleWriteFileError(err) {
  if (err) throw err;
}  

function handleBlenoStateChange(state) {
  if (state === 'poweredOn') {
    console.log("poweredOn");
    console.log(bleno.address);
    loadKeyParams(handleKeyParams);
  } else if (state === 'poweredOff') {
    bleno.stopAdvertising();
    console.log("off");
  }
}

function startAdvertising() {
  
  encrypted_ip = aes_crypto.encrypt(ip_addr);

  console.log("encrypted_ip = " + encrypted_ip)
  console.log("length = " + encrypted_ip.length)

  var advertisementData = new Buffer(31);
  advertisementData.writeUInt8(encrypted_ip.length, 0); // Number of bytes that follow in first AD structure
  advertisementData.writeUInt8(0x09, 1); // complete local name AD type

  advertisementData.write(encrypted_ip, 2);

  bleno.startAdvertisingWithEIRData(advertisementData);

  console.log("started advertising");
}

function handleKeyParams(key_params){
  if(!key_params) {
    mac_address = bleno.address;
    registerWithServer(mac_address, "admin", "pass");
  } else {
    ranging_key = key_params.ranging_key;
    iv = key_params.iv;
    console.log('Reusing already obtained params = ');
    console.log(key_params.ranging_key);
    console.log(key_params.iv);
    startAdvertising();
  }
}

// var cronJob = cron.job("*/5 * * * * *", function(){
//     // perform operation e.g. GET request http.get() etc.
//     console.log('cron job completed');
// }); 
// cronJob.start();