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
    // store the app in a more permanent location
    const storageDirPath = deploymentUtils.storeApp(tempAppPath, tempMetadataPath);
    const appPath = path.join(storageDirPath, path.basename(tempAppPath));
    const metadataPath = path.join(storageDirPath, path.basename(tempMetadataPath));
    console.log(`stored the app ${appId} at ${storageDirPath}`);

    // create a new App object and store append it to the list of apps we're watching
    const app = new App(appId, executorGatewayId, appPath, metadataPath);
    watchingApps.push(app);
    console.log(`watching over app: ${appId} running on executor gateway ${executorGatewayId}`);

    // if watchTimer is not already running, start it
    if(watchTimer == null) {
        // periodically check if the gateway has failed or not
        watchTimer = setInterval(() => {
            console.log(`watcher periodic checking.`);
            utils.getLinkGraph().then(linkGraph => {
                // check for each app we're watching
                watchingApps.forEach((watchingApp, index) => {
                    let shouldStopWatchingApp = false;
                    // if gateway fails, then reschedule the app
                    if(! (watchingApp.executorGatewayId in linkGraph["data"])) {
                        const appFiles = {
                            app: watchingApp.appPath,
                            metadata: watchingApp.metadataPath
                        };

                        console.log(`executor gateway ${executorGatewayId} failed. requested to reschedule app ${watchingApp.id}`);
                        utils.scheduleApp(appFiles);

                        // app has been rescheduled. don't need to watch this app anymore.
                        shouldStopWatchingApp = true;

                    } else if(linkGraph["data"][watchingApp.executorGatewayId]["apps"].findIndex(app => app.id === watchingApp.id ) === -1) {
                        // apps => [{id:xx, name:yyy}, {},..]
                        // if the app we're watching is no longer present on the executor, then stop watching
                        console.log(`app: ${watchingApp.id} has finished/failed.`);

                        // app has finished/failed. stop watching this app.
                        shouldStopWatchingApp = true;
                    }

                    if(shouldStopWatchingApp) {
                        // delete the app's script and metadata
                        deploymentUtils.deleteApp(path.dirname(watchingApp.appPath)).then(() => {
                            console.log(`deleted files for ${watchingApp.id}`);

                            watchingApps.splice(index,1);
                            console.log(`stopped watching the app ${appId}`);
                            console.log("watchingApps:");
                            console.log(watchingApps);

                            // if there are no more apps to watch, then clear the timer
                            if(watchingApps.length === 0) {
                                clearInterval(watchTimer);
                                watchTimer = null;
                                console.log(`no more apps to watch. clear the watch timer.`);
                            }
                        });
                    }
                });
            })
        }, 60 * 1000);
    }
}

module.exports = {
    watch: watch
};