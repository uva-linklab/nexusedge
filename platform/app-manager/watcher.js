const utils = require("../utils/utils");
const deploymentUtils = require("./deployment-utils");
const path = require("path");
/**
 * "Watches" over the app. If the gateway on which the app is executing fails, reschedule the app.
 * @param appId id of the app to watch
 * @param executorGatewayId id of the gateway which is executing the app
 * @param appPath Path to the app
 * @param metadataPath path to metadata
 */
class App {
    constructor(id, executorGatewayId, appPath, metadataPath) {
        this.id = id;
        this.executorGatewayId = executorGatewayId;
        this.appPath = appPath;
        this.metadataPath = metadataPath;
    }
}
let watchTimer = null;
let watchingApps = [];

async function watch(appId, executorGatewayId, tempAppPath, tempMetadataPath) {
    try {
        // store the app in a more permanent location
        const storageDirPath = deploymentUtils.storeApp(tempAppPath, tempMetadataPath);
        const appPath = path.join(storageDirPath, path.basename(tempAppPath));
        const metadataPath = path.join(storageDirPath, path.basename(tempMetadataPath));

        // create a new App object and store append it to the list of apps we're watching
        const app = new App(appId, executorGatewayId, appPath, metadataPath);
        console.log(`stored the app of ${appId} at ${app.appPath}`);
        console.log(`stored the metadata of ${appId} at ${app.metadataPath}`);
        watchingApps.push(app);
        console.log(`watching over app: ${appId} running on executor gateway ${executorGatewayId}`);

        // if watchTimer is not already running, start it
        if(watchTimer == null) {
            // periodically check if the gateway has failed or not
            watchTimer = setInterval(() => {
                console.log(`watcher periodic checking.`);
                utils.getLinkGraph().then(linkGraph => {
                    // check for each app we're watching
                    watchingApps.forEach( watchingApp => {
                        // if gateway fails, then reschedule the app
                        if(! (watchingApp.executorGatewayId in linkGraph["data"])) {
                            const appFiles = {
                                app: watchingApp.appPath,
                                metadata: watchingApp.metadataPath
                            };

                            console.log(`executor gateway ${executorGatewayId} failed. requested to reschedule app ${watchingApp.id}`);
                            console.log(`app file for ${watchingApp.id}: ${watchingApp.appPath}`);
                            console.log(`metadata file for ${watchingApp.id}: ${watchingApp.metadataPath}`);
                            utils.scheduleApp(appFiles).then(() => {
                                console.log(`app reschedule done`);

                                // app has been rescheduled. don't need to watch this app anymore. stop watching after reschedule
                                _stopWatchingApp(watchingApp.id);
                            });
                        } else if(linkGraph["data"][watchingApp.executorGatewayId]["apps"].findIndex(app => app.id === watchingApp.id ) === -1) {
                            // apps => [{id:xx, name:yyy}, {},..]
                            // if the app we're watching is no longer present on the executor, then stop watching
                            console.log(`app: ${watchingApp.id} has finished/failed.`);

                            // app has finished/failed. stop watching this app.
                            _stopWatchingApp(watchingApp.id);
                        }
                    });
                })
            }, 60 * 1000);
        }
    } catch (error) {
        throw new Error(`Error trying to execute app ${appId} on ${executorGatewayId}. Error = ${error.toString()}`);
    }
}

function _stopWatchingApp(appId) {
    const appIndex = watchingApps.findIndex(watchingApp => watchingApp.id === appId);
    const app = watchingApps[appIndex];

    if(app) {
        // delete the app's script and metadata
        deploymentUtils.deleteApp(path.dirname(app.appPath)).then(() => {
            console.log(`deleted files for ${app.id}`);

            watchingApps.splice(appIndex,1);
            console.log(`stopped watching the app ${app.id}`);
            console.log("watchingApps:");
            console.log(watchingApps);

            // if there are no more apps to watch, then clear the timer
            if(watchingApps.length === 0) {
                clearInterval(watchTimer);
                watchTimer = null;
                console.log(`no more apps to watch. clear the watch timer.`);
            }
        });
    } else {
        console.log(`couldn't find details for app ${appId} to stop watching`);
    }
}

module.exports = {
    watch: watch
};