const fs = require('fs-extra');
const { spawn } = require('child_process');

//TODO make file operations async
function execute(scriptPath, metadataPath) {
	//create a new directory in executables and copy the script and meta
	const dirName = Date.now();
	const dirPath = __dirname + '/' + dirName;
	if (!fs.existsSync(dirPath)){
	    fs.mkdirSync(dirPath);
	}

	fs.copyFileSync(scriptPath, dirPath);
	console.log(`${scriptPath} copied to ${dirPath}`);
	fs.copyFileSync(metadataPath, dirPath);
	console.log(`${metadataPath} copied to ${dirPath}`);

	fs.copyFileSync("oracle", dirPath);
	console.log(`oracle library copied to ${dirPath}`);

	const codeProcess = spawn('node', [scriptPath, metadataPath]);

	codeProcess.stdout.on('data', (data) => {
		console.log("stdout:::");
		console.log(data.toString().trim());
	});

	codeProcess.stderr.on('data', (data) => {
		console.log("stderr:::");
		console.error(data.toString());
	});

	codeProcess.on('exit', (data) => {
		console.log("script exited");
	});	
}

