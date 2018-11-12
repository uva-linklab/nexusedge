// 'use strict';


// var mongoose = require('mongoose'),
//   Task = mongoose.model('Tasks');

// exports.list_all_tasks = function(req, res) {
//   Task.find({}, function(err, task) {
//     if (err)
//       res.send(err);
//     res.json(task);
//   });
// };




// exports.create_a_task = function(req, res) {
//   var new_task = new Task(req.body);
//   new_task.save(function(err, task) {
//     if (err)
//       res.send(err);
//     res.json(task);
//   });
// };


// exports.read_a_task = function(req, res) {
//   Task.findById(req.params.taskId, function(err, task) {
//     if (err)
//       res.send(err);
//     res.json(task);
//   });
// };


// exports.update_a_task = function(req, res) {
//   Task.findOneAndUpdate({_id: req.params.taskId}, req.body, {new: true}, function(err, task) {
//     if (err)
//       res.send(err);
//     res.json(task);
//   });
// };


// exports.delete_a_task = function(req, res) {


//   Task.remove({
//     _id: req.params.taskId
//   }, function(err, task) {
//     if (err)
//       res.send(err);
//     res.json({ message: 'Task successfully deleted' });
//   });
// };
'use strict';
var mongoose = require('mongoose'),
  util = require('util'),
  GatewayModel = mongoose.model('Gateway');

exports.list_all_gateways = function(req, res) {
  GatewayModel.find({}, function(err, gateway) {
    if (err)
      res.send(err);
    res.json(gateway);
  });
};

function getRangingKey(res) {
  var fs = require('fs');
  fs.readFile('ranging_key.json', 'utf8', function (err, data) {
    if (err) {
      console.log("Couldn't read json file");
      res.sendStatus(501);
    } else {
      var ranging_json = JSON.parse(data);  
      res.json(ranging_json);
    }    
  });
}

exports.add_gateway = function(req, res) {
  var user_name = req.body.user;
  var pass = req.body.pass;
  var mac_address = req.body.radioMACAddress;

  if(user_name === "admin" && pass === "pass") {
    //check if already present
    GatewayModel.findOne({ radioMACAddress: mac_address }, 
      function (err, existing_gateway) {
        if(!err && existing_gateway) {
          console.log("Already present. No need to register again.");
          getRangingKey(res);
        }
        else {
          console.log("Mac address not present. need to register.");
          var new_gateway = new GatewayModel({radioMACAddress: mac_address});
          new_gateway.save(function(err, saved_doc) {
            if (err) {
              console.log("Couldn't save in mongo");
              res.sendStatus(501);
            } else {
              getRangingKey(res);
            }
          });
        }
      }
    );
  } else {
    // res.setHeader('WWW-Authenticate', 'Basic realm="need login"');
    console.log('Authorization incorrect, send 401.');
    res.sendStatus(401);
  }
};


exports.read = function(req, res) {
  GatewayModel.findById(req.params.gatewayId, function(err, gateway) {
    if (err)
      res.send(err);
    res.json(gateway);
  });
};


exports.update = function(req, res) {
  GatewayModel.findOneAndUpdate({_id: req.params.gatewayId}, req.body, {new: true}, function(err, gateway) {
    if (err)
      res.send(err);
    res.json(gateway);
  });
};


exports.delete = function(req, res) {
  GatewayModel.remove({
    _id: req.params.gatewayId
  }, function(err, gateway) {
    if (err)
      res.send(err);
    res.json({ message: 'Gateway successfully deleted' });
  });
};
