// 'use strict';
// module.exports = function(app) {
//   var todoList = require('../controllers/todoListController');

//   // todoList Routes
//   app.route('/tasks')
//     .get(todoList.list_all_tasks)
//     .post(todoList.create_a_task);


//   app.route('/tasks/:taskId')
//     .get(todoList.read_a_task)
//     .put(todoList.update_a_task)
//     .delete(todoList.delete_a_task);
// };
'use strict';
module.exports = function(app) {
  var gatewayServer = require('../controllers/gatewayServerController');

  // gatewayServer Routes
  app.route('/gateways')
    .get(gatewayServer.list_all_gateways)
    .post(gatewayServer.add_gateway);


  app.route('/gateways/:gatewayId')
    .get(gatewayServer.read)
    .put(gatewayServer.update)
    .delete(gatewayServer.delete);
};
