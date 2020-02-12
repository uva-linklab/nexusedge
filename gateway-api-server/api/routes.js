const multer  = require('multer');
const fs = require('fs');
/*
This file specifies the controller methods that handle API endpoints
Controllers are to be placed in api/controllers/
*/
const neighborDataController = require("./controllers/neighborDataController");
const sensorDataController = require("./controllers/sensorDataController");
const linkGraphController = require("./controllers/linkGraphController");
const serverStatusController = require("./controllers/serverStatusController");
const codeDeployerController = require("./controllers/codeDeployerController");

/*
Endpoints are grouped into Gateway API and platform API
Gateway API: data/action concerning just a single gateway
Platform API: data/action concerning multiple gateways
 */

module.exports = function(app) {
    app.get('/gateway/neighbors', neighborDataController.getNeighbors);
    app.get('/gateway/sensors', sensorDataController.getSensors);
    app.get('/gateway/status', serverStatusController.getServerStatus);

    //setup multipart form-data which allows clients to upload code and mapping files for execution
    //accepts two files. one with the form name as "code" and another called "metadata"
    const uploader = getMultipartFormDataUploader();
    app.post('/gateway/deploy-code', uploader.fields([{name: 'code'}, {name: 'metadata'}]),
        codeDeployerController.deploy);

    app.get('/platform/link-graph-data', linkGraphController.getLinkGraphData);
    app.get('/platform/link-graph-visual', linkGraphController.renderLinkGraph);
};

/**
 * This function returns a multer object after setting up the directory used to store the uploaded files. The function
 * also sets the relevant fields for the multer upload package used for multipart form-data.
 * @returns {multer|undefined}
 */
function getMultipartFormDataUploader() {
    //store the uploaded files to deployed-code directory. Create this directory if not already present. 
    const deployedCodePath = `${__dirname}/../deployed-code/`;
    if (!fs.existsSync(deployedCodePath)){
        fs.mkdirSync(deployedCodePath);
    }

    const multerStorage = multer.diskStorage({
        //set the storage destination
        destination: function (req, file, cb) {
            cb(null, deployedCodePath);
        },
        //use the original filename as the multer filename
        filename: function (req, file, cb) {
            cb(null, file.originalname);
        }
    });
    return multer({ storage: multerStorage });
}
