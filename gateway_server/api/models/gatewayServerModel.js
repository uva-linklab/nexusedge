// 'use strict';
// var mongoose = require('mongoose');
// var Schema = mongoose.Schema;


// var TaskSchema = new Schema({
//   name: {
//     type: String,
//     required: 'Kindly enter the name of the task'
//   },
//   Created_date: {
//     type: Date,
//     default: Date.now
//   },
//   status: {
//     type: [{
//       type: String,
//       enum: ['pending', 'ongoing', 'completed']
//     }],
//     default: ['pending']
//   }
// });

// module.exports = mongoose.model('Tasks', TaskSchema);

'use strict';
var mongoose = require('mongoose');
var Schema = mongoose.Schema;


var GatewaySchema = new Schema({
  // id: {
  //   type: String,
  //   required: 'Kindly enter the id of the gateway'
  // },
  radioMACAddress: {
    type: String,
    required: 'Kindly enter the MAC Address of the gateway',
    unique: true,
    dropDups: true
  },
  groupId: {
    type: String,
    default: ['group1']
  }
});

// // Duplicate the ID field.
// GatewaySchema.virtual('gatewayId').get(function(){
//     return this._id.toString();
// });

// // Ensure virtual fields are serialised.
// GatewaySchema.set('toJSON', {
//     virtuals: true
// });

module.exports = mongoose.model('Gateways', GatewaySchema);