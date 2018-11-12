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
  Gateways = mongoose.model('Gateways');

exports.list_all_gateways = function(req, res) {
  Gateways.find({}, function(err, gateway) {
    if (err)
      res.send(err);
    res.json(gateway);
  });
};

exports.add_gateway = function(req, res) {
  var new_gateway = new Gateways(req.body);
  new_gateway.save(function(err, gateway) {
    if (err) {
      console.log(req.body.radioMACAddress)
      res.send(err);
    }
    res.json(gateway);
  });
};


exports.read = function(req, res) {
  Gateways.findById(req.params.gatewayId, function(err, gateway) {
    if (err)
      res.send(err);
    res.json(gateway);
  });
};


exports.update = function(req, res) {
  Gateways.findOneAndUpdate({_id: req.params.gatewayId}, req.body, {new: true}, function(err, gateway) {
    if (err)
      res.send(err);
    res.json(gateway);
  });
};


exports.delete = function(req, res) {
  Gateways.remove({
    _id: req.params.gatewayId
  }, function(err, gateway) {
    if (err)
      res.send(err);
    res.json({ message: 'Gateway successfully deleted' });
  });
};
