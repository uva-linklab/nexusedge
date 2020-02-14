# API Server
This module exposes endpoints for two types of APIs. 
* Gateway API: Provides information corresponding to a single gateway. Supported information/actions: 
  * Obtain information about discovered neighbors, connected sensors, and the reachability of a gateway. 
  * Provides an endpoint to which applications can be deployed.
* Platform API: Provides information or actions that pertains to more than one gateway. Supported information/actions:  
  * Generates the link graph JSON using the neighbor and sensor data of the entire network.
  * Provides a visual representation of the link graph using vis.js.
  * Supports platform-wide operations like disseminate-all and query-all for information sharing and querying for app 
instances running on multiple gateways.  

## Install  
npm install

## Run 
node server