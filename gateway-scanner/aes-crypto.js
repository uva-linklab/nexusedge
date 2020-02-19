const crypto = require('crypto');
const algorithm = 'aes-256-ctr';

exports.encrypt = function(text, password, iv) {
  const cipher = crypto.createCipheriv(algorithm, password, iv);
  var encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  return encrypted;
};

exports.decrypt = function(encrypted, password, iv) {
  const decipher = crypto.createDecipheriv(algorithm, password, iv);
  var dec = decipher.update(encrypted, 'base64', 'utf8');
  dec += decipher.final('utf8');
  return dec;
};