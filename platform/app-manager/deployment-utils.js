const fs = require('fs-extra');
const path = require("path");
const {fork, spawn} = require('child_process');

const executableDirPath = path.join(__dirname, 'executables');

/**
 * This function takes an app and its metadata file and stores it in a permanent directory.
 * @param tempAppPath
 * @param tempMetadataPath
 * @return {string} the path of the directory where the app and metadata was stored
 */
function storeApp(tempAppPath, tempMetadataPath) {
	// create "executables" directory if not present
	fs.ensureDirSync(executableDirPath);

	// create a new target directory for this app
	const targetDirectoryName = Date.now().toString();
	const targetDirectoryPath = path.join(executableDirPath, targetDirectoryName);
	fs.ensureDirSync(targetDirectoryPath);

	// get the target paths for the app and metadata
	const appTargetPath = path.join(targetDirectoryPath, path.basename(tempAppPath));
	const metadataTargetPath = path.join(targetDirectoryPath, path.basename(tempMetadataPath));

	// copy the app and metadata
	fs.copySync(tempAppPath, appTargetPath);
	console.log(`app copied from ${tempAppPath} to ${appTargetPath}`);
	fs.copySync(tempMetadataPath, metadataTargetPath);
	console.log(`metadata copied from ${tempMetadataPath} to ${metadataTargetPath}`);

	return targetDirectoryPath;
}

function copyOracleLibrary(targetPath, runtime) {
	if(!fs.existsSync(targetPath)) {
		return false;
	}

	let oracleDirname;
	switch (runtime) {
		case 'nodejs': oracleDirname = 'oracle';
			break;
		case 'python': oracleDirname = 'oracle-python';
			break;
	}

	if(!oracleDirname) {
		console.error(`unknown runtime option ${runtime} provided for app execution.`);
		return false;
	} else {
		const oracleTargetPath = path.join(targetPath, 'oracle');
		const oracleSourcePath = path.join(__dirname, oracleDirname);
		fs.copySync(oracleSourcePath, oracleTargetPath);
		console.log(`Oracle library at ${oracleSourcePath} copied to ${oracleTargetPath}`);
	}
	return true;
}

/**
 * Executes a given application
 * @param id the app's id
 * @param executablePath
 * @param logPath
 * @param runtime which programming language runtime the app uses (nodejs, python,..)
 * @return {ChildProcess}
 */
function executeApplication(id, executablePath, logPath, runtime) {
	let appProcess;
	if(runtime === 'nodejs') {
		appProcess = fork(executablePath, [], {
			env: {APP_ID: id}, // pass the application's id to the app as the MQTT Topic
			stdio: [
				0,
				fs.openSync(logPath, 'w'),
				fs.openSync(logPath, 'a'),
				"ipc" // setup ipc between the parent process and the child process
			]
		});
	} else if(runtime === 'python') {
		appProcess = spawn('python3', ['-u', executablePath], {
			env: {APP_ID: id},
			stdio: [
				0,
				fs.openSync(logPath, 'w'),
				fs.openSync(logPath, 'a')
			]
		});
	}
	console.log(`[INFO] Launched ${app.name} successfully!`);
	console.log(`   time: ${new Date().toISOString()}`);
	console.log(`   path: ${executablePath}`);
	console.log(`    id: ${id}`);
	console.log(`    pid: ${appProcess.pid}`);
	return appProcess;
}

function cleanupExecutablesDir() {
	fs.ensureDirSync(executableDirPath);
	fs.emptyDirSync(executableDirPath);
}

module.exports = {
	storeApp: storeApp,
	copyOracleLibrary: copyOracleLibrary,
	executeApplication: executeApplication,
	cleanupExecutablesDir: cleanupExecutablesDir
};