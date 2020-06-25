const Oracle = require('../../index');
const oracle = new Oracle();

oracle.on('query-all', function(tag, data) {
	if(tag === 'queryData') {
		console.log(`obtained query - ${data}`);
		const replyTag = data["_meta"]["reply-tag"];
		oracle.disseminateAll(replyTag, {
			"data": "queryResponseGoesHere"
		});
	}
});