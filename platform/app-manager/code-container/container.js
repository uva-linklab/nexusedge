const fs = require('fs-extra');
const path = require("path");

const executableDirPath = path.join(__dirname, 'executables');

exports.setupAppRuntimeEnvironment = async function (appPath, metadataPath, runtime) {
	//create "executables" directory if not present
	fs.ensureDirSync(executableDirPath);

	//create a new directory in executables and copy the script and meta
	const dirName = Date.now().toString();
	const dirPath = path.join(executableDirPath, dirName);
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