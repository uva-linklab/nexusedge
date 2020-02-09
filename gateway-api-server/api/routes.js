/*
This file specifies the controller methods that handle API endpoints
Controllers are to be placed in api/controllers/
*/

const neighborDataController = require("./controllers/neighborDataController");
const sensorDataController = require("./controllers/sensorDataController");
const linkGraphController = require("./controllers/linkGraphController");
const serverStatusController = require("./controllers/serverStatusController");

module.exports = function(app) {
    app.route('/neighbors')
        .get(neighborDataController.getNeighbors);

    app.route('/sensors')
        .get(sensorDataController.getSensors);

    app.route('/link-graph-data')
        .get(linkGraphController.getLinkGraphData);

    app.route('/link-graph-visual')
        .get(linkGraphController.renderLinkGraph);

    app.route('/status')
        .get(serverStatusController.getServerStatus);
};