var parser = require('./lib/parser');

var options = {
  currentDate: new Date('2020-08-28 07:00'),
  tz: "America/New_York"
};

try {
  var interval = parser.parseExpression('* 8-10 4 1 7', options);
  console.log(interval._fields)
  let date = interval.next();
  console.log("In interval: ", interval.isInInterval(date), 'Date: ', date.toString());
  date = interval.next();
  console.log("In interval: ", interval.isInInterval(date), 'Date: ', date.toString());
  date = interval.next();
  console.log("In interval: ", interval.isInInterval(date), 'Date: ', date.toString());
  date = interval.next();
  console.log("In interval: ", interval.isInInterval(date), 'Date: ', date.toString());
} catch (err) {
  console.log('Error: ' + err.message);
}