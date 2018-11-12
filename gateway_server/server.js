var express = require('express'),
  app = express(),
  port = process.env.PORT || 9000,
  mongoose = require('mongoose'),
  Gateways = require('./api/models/gatewayServerModel'), //created model loading here
  bodyParser = require('body-parser');
  
// mongoose instance connection url connection
mongoose.Promise = global.Promise;
mongoose.connect('mongodb://localhost/gateway_server'); 


app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var routes = require('./api/routes/gatewayServerRoutes'); //importing route
routes(app); //register the route


app.listen(port);

console.log('gateway_server RESTful API server started on: ' + port);

app.use(function(req, res) {
  res.status(404).send({url: req.originalUrl + ' not found'})
});