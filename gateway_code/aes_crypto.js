module.exports.encrypt = encrypt;
module.exports.decrypt = decrypt;

var crypto = require('crypto'),
  algorithm = 'aes-256-ctr';

function encrypt(text, password, iv) {
  var key = password.toString('hex').slice(0, 32); //32 UTF-8 chars = 32 bytes = 256bits
  var ivstring = iv.toString('hex').slice(0, 16); //16 UTF-8 chars = 128 bytes
  var cipher = crypto.createCipheriv(algorithm, key, ivstring);
  var encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return encrypted;
}

function decrypt(encrypted, password, iv) {
  var key = password.toString('hex').slice(0, 32);
  var ivstring = iv.toString('hex').slice(0, 16);
  var decipher = crypto.createDecipheriv(algorithm, key, ivstring)
  var dec = decipher.update(encrypted, 'base64', 'utf8')
  dec += decipher.final('utf8');
  return dec;
}