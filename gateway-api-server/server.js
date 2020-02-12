var express = require('express');
var bodyParser = require('body-parser');
var cors = require('cors');
var nunjucks = require('nunjucks');
var fs = require('fs');

var codeContainer = require('./code-container/container');

var app = express();
var port = process.env.PORT || 5000;

//nunjucks
const PATH_TO_TEMPLATES = __dirname + '/templates';
nunjucks.configure(PATH_TO_TEMPLATES, {
    autoescape: true,
    express: app
});

//TODO check why this is needed
app.use(cors({credentials: true, origin: true}));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(__dirname + '/public'));

//Describe API endpoints in api/routes.js
var routes = require(__dirname + '/api/routes');
routes(app);

app.listen(port, function() {
  console.log(`Gateway API server started on port ${port}`)
});

//TODO code deployer stuff move these to routes and give it a proper controller

const deployedCodePath = `${__dirname}/deployed-code/`;
if (!fs.existsSync(deployedCodePath)){
  fs.mkdirSync(deployedCodePath);
}
//package to accept multipart form-data which allows clients to upload code and mapping files for execution
var multer  = require('multer');
var storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, deployedCodePath);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});
var upload = multer({ storage: storage });

//accepts two files. one with the form name as "code" and another called "metadata"
app.post('/deploy', upload.fields([{name: 'code'}, {name: 'metadata'}]), (req, res) => {
  console.log(req.body);
  console.log(req.files);

  const codePath = req["files"]["code"][0]["path"];
  const metadataPath = req["files"]["metadata"][0]["path"];

  codeContainer.execute(codePath, metadataPath);
  res.send();
});

//throw an error if it is an unknown endpoint
app.use(function(req, res) {
    res.status(404).send(`${req.originalUrl} is not a valid endpoint.`);
});