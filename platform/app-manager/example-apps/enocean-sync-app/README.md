# EnOcean Sync App
Synchronizes the EnOcean mappings between gateways.

## Background
[EnOcean sensors](https://www.enocean.com/) send out a learn packet when the learn button on the sensor is pressed. This 
packet contains the information of the sensor type which enables the gateways to parse the packets from the sensor. The 
information from the learn packet is stored in a file called knownSensors.json under the node-enocean npm package directory.
When a sensor moves from the range of one gateway to another, the new gateway does not have the mapping information and 
the sensor data is not recorded by the gateway.

## Setup
Create a file called sync-config.json which contains the path to the 
[lab11 enocean software](https://github.com/lab11/gateway/tree/master/software/enocean-generic-gateway) and the 
script name.

## Internals
* Has to be running in all gateways that run the enocean sensor data collection.
* Used to synchronize any changes to the knownSensors.json file between all gateways of the gateway network. 
* Spawns a new process to read enocean packets.
* Checks the knownSensors file every 5seconds.
* If there is a change to the file, uses the disseminate-all platform API to synchronize the change to all other gateways.
* If a change is received by a gateway, the process is stopped, knownSensors file is updated, and the process is restarted. 