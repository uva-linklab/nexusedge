module.exports.execute = execute;

const fs = require('fs-extra');
const { spawn } = require('child_process');
const path = require("path");

//TODO make file operations async
function execute(scriptPath, metadataPath) {
	const executableDirPath = `${__dirname}/executables`;
	//create "executables" directory if not present
	if (!fs.existsSync(executableDirPath)){
	    fs.mkdirSync(executableDirPath);
	}

	//create a new directory in executables and copy the script and meta
	const dirName = Date.now();
	const dirPath = `${executableDirPath}/${dirName}`;
	if (!fs.existsSync(dirPath)){
	    fs.mkdirSync(dirPath);
	}

	const scriptTargetPath = `${dirPath}/${path.basename(scriptPath)}`;
	const metadataTargetPath = `${dirPath}/${path.basename(metadataPath)}`;
	const oracleSourcePath = `${__dirname}/oracle`;
	const oracleTargetPath = `${dirPath}/oracle`;

	fs.copyFileSync(scriptPath, scriptTargetPath);
	console.log(`${scriptPath} copied to ${scriptTargetPath}`);
	fs.copyFileSync(metadataPath, metadataTargetPath);
	console.log(`${metadataPath} copied to ${metadataTargetPath}`);
	fs.copySync(oracleSourcePath, oracleTargetPath);
	console.log(`oracle library at ${oracleSourcePath} copied to ${oracleTargetPath}`);

	const codeProcess = spawn('node', [scriptTargetPath]);

	codeProcess.stdout.on('data', (data) => {
		console.log(data.toString().trim());
	});

	codeProcess.stderr.on('data', (data) => {
		console.error(data.toString());
	});

	codeProcess.on('exit', (data) => {
		console.log("script exited");
	});	
}
