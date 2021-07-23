const fs = require('fs-extra');
const path = require("path");

const executableDirPath = path.join(__dirname, 'executables');
const startupAppsDirPath = path.join(__dirname, 'startup-apps');


/*
app-manager

deploy this app (temp_app_dir, temp_metadata_dir, runtime, isStartupApp)

1. copy the app and metadata to a new permanent directory
2. copy oracle into this new directory (this should be a sin!)
3. generate a new app id from app name
4. fork the app
5. store the app's info in the memory obj
6. request SSM to setup streams for this app based on its requirements

 */

exports.setupAppRuntimeEnvironment = async function (appPath, metadataPath, runtime, isStartupApp) {
	const baseDirPath = isStartupApp ? startupAppsDirPath : executableDirPath;

	//create "executables"/"startup-apps" directory if not present
	fs.ensureDirSync(baseDirPath);

	//create a new directory in executables and copy the script and meta
	const dirName = Date.now().toString();
	const dirPath = path.join(baseDirPath, dirName);
	fs.ensureDirSync(dirPath);

	const scriptTargetPath = path.join(dirPath, path.basename(appPath));
	const metadataTargetPath = path.join(dirPath, path.basename(metadataPath));

	let oracleDirname;
	switch (runtime) {
		case 'nodejs': oracleDirname = 'oracle';
			break;
		case 'python': oracleDirname = 'oracle-python';
			break;
	}

	if(!oracleDirname) {
		console.error(`unknown runtime option ${runtime} provided for code-container.`);
	} else {
		const oracleTargetPath = path.join(dirPath, 'oracle');
		const oracleSourcePath = path.join(__dirname, oracleDirname);
		fs.copySync(oracleSourcePath, oracleTargetPath);
		console.log(`  Oracle library at ${oracleSourcePath} copied to ${oracleTargetPath}`);
	}

	console.log("[INFO] Copied application and metadata to executable directory.");
	fs.copySync(appPath, scriptTargetPath);
	console.log(`  ${appPath} copied to ${scriptTargetPath}`);
	fs.copySync(metadataPath, metadataTargetPath);
	console.log(`  ${metadataPath} copied to ${metadataTargetPath}`);

	// TODO: npm install here
	return scriptTargetPath;
};

exports.cleanupExecutablesDir = function() {
	fs.ensureDirSync(executableDirPath);
	fs.emptyDirSync(executableDirPath);
};

module.exports = {

}