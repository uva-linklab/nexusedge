const Oracle = require('../../oracle');
const oracle = new Oracle();

oracle.on('query-all', function(tag, data) {
	if(tag === 'queryData') {
		console.log("obtained query");
		console.log(data);
		const replyTag = data["_meta"]["reply-tag"];
		oracle.disseminateAll(replyTag, {
			"data": "queryResponseGoesHere"
		});
	}
});