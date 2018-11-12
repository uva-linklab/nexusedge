str = process.argv[2];

var crypto = require('crypto'),
  algorithm = 'aes-256-ctr',
  password = 'BJRDLGGFUT2I2ZK8N5CDX1VGJSYZLXQF',
  key = password.toString('hex').slice(0, 32), //32 UTF-8 chars = 256bytes
  iv = '6F2E2CEE52C1AB42',
  ivstring = iv.toString('hex').slice(0, 16); //16 UTF-8 chars = 128 bytes

function encrypt(text) {
  var cipher = crypto.createCipheriv(algorithm, key, ivstring)
  var encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex');
  return encrypted;
}

function decrypt(encrypted) {
  var decipher = crypto.createDecipheriv(algorithm, key, ivstring)
  var dec = decipher.update(encrypted, 'hex', 'utf8')
  dec += decipher.final('utf8');
  return dec;
}

var hw = encrypt(str);
console.log(hw);
console.log(decrypt(hw));
