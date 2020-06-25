const Oracle = require('../../index');
const oracle = new Oracle();

oracle.on('disseminate-all', function(tag, data) {
	if(tag === 'testData') {
		console.log("obtained disseminate-all data");
		console.log(data);
	}
});