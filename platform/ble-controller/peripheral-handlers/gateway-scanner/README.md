# Gateway Scanner
This is a peripheral handler with the following functions:
1. Looks for other neighbors' gateway advertisements filtered based on the TalkToManagerService uuid. 
2. Saves neighbor information (BLE address, IP address) to mongodb upon discovery.