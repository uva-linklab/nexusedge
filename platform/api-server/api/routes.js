const multer  = require('multer');
const fs = require('fs');
/*
This file specifies the controller methods that handle API endpoints
Controllers are to be placed in api/controllers/
*/
const gatewayAPIController = require("./controllers/gateway-api-controller");
const platformAPIController = require("./controllers/platform-api-controller");
const linkGraphController = require("./controllers/link-graph-controller");

/*
Endpoints are grouped into Gateway API and platform API
Gateway API: data/action concerning just a single gateway
Platform API: data/action concerning multiple gateways
 */

module.exports = function(app) {
    //setup multipart form-data which allows clients to upload code and mapping files for execution
    //accepts two files. one with the form name as "code" and another called "metadata"
    const uploader = getMultipartFormDataUploader();

    app.get('/gateway/neighbors', gatewayAPIController.getNeighbors);
    app.get('/gateway/devices', gatewayAPIController.getDevices);
    app.get('/gateway/status', gatewayAPIController.getServerStatus);
    app.get('/gateway/apps', gatewayAPIController.getApps);
    app.post('/gateway/execute-app', uploader.fields([{name: 'app'}, {name: 'metadata'}]),
        gatewayAPIController.executeApp);
    app.get('/gateway/apps/:id/terminate', gatewayAPIController.terminateApp);
    app.get('/gateway/apps/:id/log-streaming-topic', gatewayAPIController.getLogStreamingTopic);
    app.get('/gateway/apps/:id/start-log-streaming', gatewayAPIController.startLogStreaming);
    app.get('/gateway/apps/:id/stop-log-streaming', gatewayAPIController.stopLogStreaming);
    app.get('/gateway/details', gatewayAPIController.getGatewayDetails);
    app.get('/gateway/resource-usage', gatewayAPIController.getResourceUsage);
    app.post('/gateway/talk-to-manager', gatewayAPIController.talkToManager);
    // TODO: need to be changed to the general api.
    app.post('/gateway/register-app-sensor-requirement',
             gatewayAPIController.registerAppSensorRequirement);
    app.get('/platform/link-graph-data', linkGraphController.getLinkGraphData);
    app.get('/platform/link-graph-visual', linkGraphController.renderLinkGraph);
    app.post('/platform/disseminate-all', platformAPIController.disseminateAll);
    app.post('/platform/query-all', platformAPIController.queryAll);
};

/**
 * This function returns a multer object after setting up the directory used to store the uploaded files. The function
 * also sets the relevant fields for the multer upload package used for multipart form-data.
 * @returns {multer|undefined}
 */
function getMultipartFormDataUploader() {
    //store the uploaded files to deployed-apps directory. Create this directory if not already present.
    const deployedAppsPath = `${__dirname}/../deployed-apps/`;
    if (!fs.existsSync(deployedAppsPath)){
        fs.mkdirSync(deployedAppsPath);
    }

    const multerStorage = multer.diskStorage({
        //set the storage destination
        destination: function (req, file, cb) {
            cb(null, deployedAppsPath);
        },
        //use the original filename as the multer filename
        filename: function (req, file, cb) {
            cb(null, file.originalname);
        }
    });
    return multer({ storage: multerStorage });
}
