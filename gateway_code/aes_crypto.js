module.exports.encrypt = encrypt;
module.exports.decrypt = decrypt;

var crypto = require('crypto'),
  algorithm = 'aes-256-ctr',
  password = '95CFEF1B1F1F5FAAC6954BC1BD713081',
  key = password.toString('hex').slice(0, 32), //32 UTF-8 chars = 32 bytes = 256bits
  iv = '6F2E2CEE52C1AB42',
  ivstring = iv.toString('hex').slice(0, 16); //16 UTF-8 chars = 128 bytes

function encrypt(text, key, ivstring) {
  var cipher = crypto.createCipheriv(algorithm, key, ivstring)
  var encrypted = cipher.update(text, 'utf8', 'base64')
  encrypted += cipher.final('base64');
  return encrypted;
}

function decrypt(encrypted) {
  var decipher = crypto.createDecipheriv(algorithm, key, ivstring)
  var dec = decipher.update(encrypted, 'base64', 'utf8')
  dec += decipher.final('utf8');
  return dec;
}