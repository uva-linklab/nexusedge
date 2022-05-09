/**
 * This function picks the best gateway to run the app and uses the API on that gateway to execute the app.
 * @param appId id of the app to watch
 * @param executorGatewayId id of the gateway which is executing the app
 * @param appPath Path to the app
 * @param metadataPath path to metadata
 */
async function watch(appId, executorGatewayId, appPath, metadataPath) {
    console.log(`watching over app: ${appId} on executor gateway ${executorGatewayId}`);
}

module.exports = {
    watch: watch
};