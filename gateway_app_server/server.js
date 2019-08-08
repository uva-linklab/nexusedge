var express = require('express'),
  app = express(),
  port = process.env.PORT || 5000,
  mongoose = require('mongoose'),
  appServerModel = require(__dirname + '/api/models/appServerModel'), //created model loading here
  bodyParser = require('body-parser'),
  cors = require('cors'),
  nunjucks = require('nunjucks');

//package to accept multipart form-data which allows clients to upload code and mapping files for execution
var multer  = require('multer');
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, __dirname + '/deployed-code/');
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});
var upload = multer({ storage: storage });

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
app.use(express.static(__dirname + '/public'));

var routes = require(__dirname + '/api/routes/appServerRoutes'); //importing route
routes(app); //register the route

app.listen(port);

//accepts two files. one with the form name as "code" and another called "mapping"
app.post('/deploy', upload.fields([{name: 'code'}, {name: 'mapping'}]), (req, res) => {  
  console.log(req.body)
  console.log(req.files);
  res.send();
});

console.log('app_server RESTful API server started on: ' + port);

app.use(function(req, res) {
  res.status(404).send({url: req.originalUrl + ' not found'})
});