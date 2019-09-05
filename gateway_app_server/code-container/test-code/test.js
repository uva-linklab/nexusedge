const oracle = require(__dirname + "/oracle");

oracle.register('f0c77f0f82a9', function(data) {
	console.log("#1 from 253");
	console.log(data);
});
oracle.register('c8fd19896ac7', function(data) {
	console.log("#2 from 253");
	console.log(data);
});
oracle.register('f0c77f0f5761', function(data) {
	console.log("#3 from 129");
	console.log(data);
});
oracle.register('f0c77f0f82b3', function(data) {
	console.log("#4 from 129");
	console.log(data);
});
oracle.register('c8fd19897cf8', function(data) {
	console.log("#5 from 129");
	console.log(data);
});