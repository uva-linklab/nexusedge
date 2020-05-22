# BLE Controller
1. Handles all things BLE: uses noble and bleno modules to discover and connect to peripherals, and also send 
advertisements.
2. Maintains a list of peripheral-handlers and hands over discovered peripherals to be processed.

## Setup
* Add a file named group-key.json which contains the key and IV for the AES-256 CTR encryption used to uniquely identify a gateway group. The same key and IV needs to be used by all gateways in the network. The file is placed in the git ignore list.

    * e.g.:
    ```json
    {  
        "key":"95CFEF1B1F1F5FAAC6954BC1BD713081",
        "iv":"6F2E2CEE52C1AB42"  
    }
    ```  