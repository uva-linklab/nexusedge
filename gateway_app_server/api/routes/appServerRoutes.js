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
  var appServer = require('../controllers/appServerController');

  // appServer Routes
  app.route('/apps')
    .get(appServer.list_all_apps)
    .post(appServer.add_app);

  app.route('/apps/:appId')
    .get(appServer.read)
    .put(appServer.update)
    .delete(appServer.delete);

  app.route('/execute/:appId')
  	.get(appServer.exec);
};
