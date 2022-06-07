const child_process = require('child_process');
const fs = require('fs-extra');
const path = require("path");
const {fork, spawn} = require('child_process');

const utils = require('../utils/utils')

const executableDirPath = path.join(__dirname, 'executables');

// Create a persistent temporary directory for executing applications in.
const AppDeployPath = '/var/tmp/nexus-edge/apps';
fs.ensureDirSync(AppDeployPath);

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

/** Unpackage an application to prepare to run it.
 *
 * @param appPackagePath path to the archive containing the application
 * @param deployMetadataPath path to the deployment metadata JSON file
 *
 * @returns Application deployment result and information.
 */
function deployApplication(appPackagePath, deployMetadataPath, appName, appId) {
    var result = {
        status: true,
        message: '',
        executablePath: '',
        deployMetadataPath: '',
        runtime: ''
    };

    // Unpackage the application in its own directory in the deployment directory.
    const runPath = `${AppDeployPath}/${appId}`;
    fs.ensureDirSync(runPath);

    console.log(`Extracting ${appName} to '${runPath}'...`);
    child_process.execFileSync(
        utils.tarPath,
        ['-x', '-f', appPackagePath],
        { cwd: runPath });
    // Move deployment metadata to run path as well.
    const residentDeployMetadataPath = `${AppDeployPath}/${appId}/_deploy.json`;
    fs.renameSync(deployMetadataPath, residentDeployMetadataPath);
    result.deployMetadataPath = residentDeployMetadataPath;

    // Fetch the runtime type from the application metadata.
    const appMetadataPath = path.join(runPath, '_metadata.json');
    const appMetadata = JSON.parse(fs.readFileSync(appMetadataPath));
    const runtime = appMetadata['app-type'];
    if (runtime === undefined) {
        messagingService.respondToQuery(query, {
            status: false,
            message: 'Application metadata does not specify a runtime.'
        });
        return;
    }

    // Prepare the application code for execution depending on its type.
    var executablePath = null;
    if (runtime === 'nodejs') {
        executablePath = path.join(runPath, 'app.js');

        // copy the oracle library to use for the app.
        copyOracleLibrary(runPath, runtime);
    } else if (runtime === 'python') {
        // Unzip the wheel.
        var moduleName = '';
        var dir = fs.opendirSync(runPath);
        var entry = dir.readSync();
        while (entry != null) {
            if (path.extname(entry.name) === '.whl') {
                // Get the name of the top-level module.
                const outputBytes = child_process.execFileSync(
                    '/usr/bin/unzip',
                    ['-q', '-c', '-a', entry.name, '*/top_level.txt'],
                    { cwd: runPath });
                moduleName = String.fromCharCode.apply(String, outputBytes);

                // Install application to the run path.
                console.log(`Installing package to ${runPath}`)
                child_process.execFileSync(
                    '/usr/bin/pip',
                    ['install', '--target', runPath, path.join(runPath, entry.name)]);
                break;
            }

            entry = dir.readSync();
        }
        dir.closeSync();

        // Didn't find the wheel file.
        if (entry == null) {
            result.status = false;
            result.message = 'Could not locate .whl file for Python application.';
            return result;
        }

        executablePath = path.join(runPath, 'bin', moduleName);

        // copy the oracle library to use for the app.
        copyOracleLibrary(runPath, runtime);
    } else {
        result.status = false;
        result.message = 'Application metadata does not specify a runtime.';

        return result;
    }

    result.executablePath = executablePath;
    result.runtime = runtime;

    return result;
}

/** Locate the __main__.py file.
 *
 * @returns the path to the __main__.py file or null if it does not exist.
 */
function findPythonMain(appRoot) {
    var dir = fs.opendirSync(appRoot);
    var entry = dir.readSync();

    while (entry != null) {
        if (entry.isDirectory()) {
            const maybeAppDir = fs.opendirSync(path.join(appRoot, entry.name));
            var maybeAppDirEntry = maybeAppDir.readSync();
            while (maybeAppDirEntry != null) {
                if (maybeAppDirEntry.name == '__main__.py') {
                    dir.closeSync();
                    maybeAppDir.closeSync();
                    console.log(`main is in ${maybeAppDir.path}`);
                    return maybeAppDir.path;
                } else {
                    maybeAppDirEntry = maybeAppDir.readSync();
                }
            }

        }

        entry = dir.readSync();
    }

    dir.closeSync();
    maybeAppDir.closeSync();

    return null;
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
			env: {APP_DATA_TOPIC: id}, // pass the application's id to the app as the MQTT Topic
			stdio: [
				0,
				fs.openSync(logPath, 'w'),
				fs.openSync(logPath, 'a'),
				"ipc" // setup ipc between the parent process and the child process
			]
		});
	} else if(runtime === 'python') {
		appProcess = spawn('python3', ['-u', executablePath], {
			env: {APP_DATA_TOPIC: id},
			stdio: [
				0,
				fs.openSync(logPath, 'w'),
				fs.openSync(logPath, 'a')
			]
		});
	} else {
        throw new Error(`Unsupported runtime: '${runtime}'.`);
    }

	console.log(`[INFO] Launched app successfully!`);
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
	deployApplication: deployApplication,
    executeApplication: executeApplication,
	cleanupExecutablesDir: cleanupExecutablesDir
};
