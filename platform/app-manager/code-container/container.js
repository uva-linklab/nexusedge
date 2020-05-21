const fs = require('fs-extra');
const path = require("path");

exports.setupAppRuntimeEnvironment = async function (appPath, metadataPath) {
	const executableDirPath = `${__dirname}/executables`;
	//create "executables" directory if not present
	fs.ensureDirSync(executableDirPath);

	//create a new directory in executables and copy the script and meta
	const dirName = Date.now();
	const dirPath = `${executableDirPath}/${dirName}`;
	fs.ensureDirSync(dirPath);

	const scriptTargetPath = `${dirPath}/${path.basename(appPath)}`;
	const metadataTargetPath = `${dirPath}/${path.basename(metadataPath)}`;
	const oracleSourcePath = `${__dirname}/oracle`;
	const oracleTargetPath = `${dirPath}/oracle`;

	console.log("[INFO] Copy application and metadata to executable directory.");
	fs.copySync(appPath, scriptTargetPath);
	console.log(`  ${appPath} copied to ${scriptTargetPath}`);
	fs.copySync(metadataPath, metadataTargetPath);
	console.log(`  ${metadataPath} copied to ${metadataTargetPath}`);
	fs.copySync(oracleSourcePath, oracleTargetPath);
	console.log(`  Oracle library at ${oracleSourcePath} copied to ${oracleTargetPath}`);

	// TODO: npm install here
	return scriptTargetPath;
}
