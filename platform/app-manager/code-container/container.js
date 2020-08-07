const fs = require('fs-extra');
const path = require("path");

exports.setupAppRuntimeEnvironment = async function (appPath, metadataPath) {
	const executableDirPath = path.join(__dirname, 'executables');
	//create "executables" directory if not present
	fs.ensureDirSync(executableDirPath);

	//create a new directory in executables and copy the script and meta
	const dirName = Date.now().toString();
	const dirPath = path.join(executableDirPath, dirName);
	fs.ensureDirSync(dirPath);

	const scriptTargetPath = path.join(dirPath, path.basename(appPath));
	const metadataTargetPath = path.join(dirPath, path.basename(metadataPath));
	const oracleSourcePath = path.join(__dirname, 'oracle');
	const oracleTargetPath = path.join(dirPath, 'oracle');

	console.log("[INFO] Copied application and metadata to executable directory.");
	fs.copySync(appPath, scriptTargetPath);
	console.log(`  ${appPath} copied to ${scriptTargetPath}`);
	fs.copySync(metadataPath, metadataTargetPath);
	console.log(`  ${metadataPath} copied to ${metadataTargetPath}`);
	fs.copySync(oracleSourcePath, oracleTargetPath);
	console.log(`  Oracle library at ${oracleSourcePath} copied to ${oracleTargetPath}`);

	// TODO: npm install here
	return scriptTargetPath;
};
