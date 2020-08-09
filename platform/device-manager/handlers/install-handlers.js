const handlerUtils = require('./handler-utils');

handlerUtils.installHandlers().then(status => {
    if(status) {
        console.log("Handlers installed successfully.");
    } else {
        console.log("Handlers installation failed.")
    }
});