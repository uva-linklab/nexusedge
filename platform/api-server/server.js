const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const nunjucks = require('nunjucks');

const app = express();
const port = process.env.PORT || 5000;

//nunjucks
const PATH_TO_TEMPLATES = __dirname + '/api/views';
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
const routes = require(__dirname + '/api/routes');
routes(app);

app.listen(port, function() {
  console.log(`API server started on port ${port}`)
});

//throw an error if it is an unknown endpoint
app.use(function(req, res) {
    res.status(404).send(`${req.originalUrl} is not a valid endpoint.`);
});