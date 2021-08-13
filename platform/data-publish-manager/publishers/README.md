# Publishers
Publishers are user modules which can receive callbacks whenever there's new data available on a gateway. They can
be used to obtain all local data on a gateway and process it on the same gateway. This is 
different to how regular applications receive data, where the app is running on a single gateway and all required 
data is streamed to that gateway. It can be thought of as multiple applications which have access to local data. 
 
Publisher modules need to follow a specific format:

```js
/* 
- custom modules that are needed for your publisher
- make sure to 
    i) add dependencies to a package.json
    ii) install them before starting the platform
*/  
const module = require('...'); 

class Publisher {
    constructor() {
    }
    
    // this will be called once at the start of the platform
    initialize() {
    }
    
    // this callback function will be called whenever there's new data
    onData(data) {
    }
}

// allow the class to be accessed by data-publish-manager
module.exports = Publisher;
```  

## Adding a new Publisher
1. Create a new directory under data-publish-manager/publishers.
2. Add your publisher js file which follows the format specified above and export the class as a module.
3. Set up all npm dependencies. This needs to be installed on all gateways.
4. Add a new entry to data-publish-manager/publishers/publishers.json with the key as the directory name you just created,
and point to the main file which contains your publisher class.
5. Start platform-manager and if things are setup correctly, you will receive callbacks in the onData function for new data. 