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

var AppSchema = new Schema({
	app_name: String,
	port: Number,
	protocol: String,
	documentation: String
});

// AppSchema.set('toObject', {
//   transform: function (doc, ret) {
//     ret.id = ret._id
//     delete ret._id
//     delete ret.__v
//   }
// })

AppSchema.set('toJSON', {
  transform: function (doc, ret) {
    ret.app_id = ret._id
    delete ret._id
    delete ret.__v
  }
})

module.exports = mongoose.model('Apps', AppSchema);