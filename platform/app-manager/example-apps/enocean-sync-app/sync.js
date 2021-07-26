const fs = require('fs');
const syncConfig = require('./sync-config');
const Oracle = require('../../oracle');
const oracle = new Oracle();

// get the name of the enocean data collection script that needs to be controlled as a child process
const enoceanScriptName = syncConfig["enocean-script-name"];

// load the knownSensors.json file
const enoceanDirectoryPath = syncConfig["enocean-generic-gateway-path"];
const mappingFilePath = enoceanDirectoryPath + "/node_modules/node-enocean/modules/knownSensors.json";

var knownSensors = JSON.parse(fs.readFileSync(mappingFilePath, 'utf8'));

// start the enocean-generic-gateway script
const spawn = require('child_process').spawn;
var enoceanProcess;
startEnoceanGatewayProcess();

oracle.on('disseminate-all', function(tag, data) {
	if(tag === 'knownSensors') {
		console.log(`obtained disseminate-all request for knownSensors`);
		const newKnownSensors = data.payload;

		if(JSON.stringify(newKnownSensors) !== JSON.stringify(knownSensors)) {
			//kill the enocean gateway process
			enoceanProcess.kill();
			
			//update the knownSensors.json file
			fs.writeFileSync(mappingFilePath, JSON.stringify(newKnownSensors));

			//restart the process
			startEnoceanGatewayProcess();

			//update the in-memory version
			knownSensors = newKnownSensors;
		}		
	}
});

setInterval(() => {
	const newKnownSensors = JSON.parse(fs.readFileSync(mappingFilePath, 'utf8'));

	if(JSON.stringify(newKnownSensors) !== JSON.stringify(knownSensors)) {
		console.log("knownSensors file has changed!");

		//disseminate the new knownSensors file over the platform
		oracle.disseminateAll("knownSensors", newKnownSensors);

		//update the in-memory version
		knownSensors = newKnownSensors;
	}
}, 5000);

function startEnoceanGatewayProcess() {
	console.log('starting enocean script');
	enoceanProcess = spawn('node', [enoceanScriptName], {cwd: enoceanDirectoryPath});

	enoceanProcess.stdout.setEncoding('utf8');
	enoceanProcess.stdout.on('data', function (data) {
	    var str = data.toString();
	    console.log(str);
	});

	enoceanProcess.on('close', function (code) {
	    console.log('killed enocean script');
	});
}