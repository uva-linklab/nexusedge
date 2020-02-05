/*
This file specifies the controller methods that handle API endpoints
Controllers are to be placed in api/controllers/
*/

var neighborDataController = require("./controllers/neighborDataController");
var sensorDataController = require("./controllers/sensorDataController");
var linkGraphController = require("./controllers/linkGraphController");

module.exports = function(app) {
    app.route('/neighbors')
        .get(neighborDataController.getNeighbors);

    app.route('/sensors')
        .get(sensorDataController.getSensors);

    app.route('/link-graph-data')
        .get(linkGraphController.getLinkGraphData);

    app.route('/link-graph-visual')
        .get(linkGraphController.renderLinkGraph);
};