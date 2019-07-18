var express = require('express'),
  app = express(),
  port = process.env.PORT || 5000,
  mongoose = require('mongoose'),
  appServerModel = require('./api/models/appServerModel'), //created model loading here
  bodyParser = require('body-parser'),
  cors = require('cors'),
  nunjucks = require('nunjucks');
  
// mongoose instance connection url connection
mongoose.Promise = global.Promise;
mongoose.connect('mongodb://localhost/app_server', { useNewUrlParser: true }); 

//nunjucks
const PATH_TO_TEMPLATES = __dirname + '/templates';
nunjucks.configure(PATH_TO_TEMPLATES, {
    autoescape: true,
    express: app
});

app.use(cors({credentials: true, origin: true}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

var routes = require('./api/routes/appServerRoutes'); //importing route
routes(app); //register the route

app.listen(port);

console.log('app_server RESTful API server started on: ' + port);

app.use(function(req, res) {
  res.status(404).send({url: req.originalUrl + ' not found'})
});