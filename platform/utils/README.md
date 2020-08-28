# Utils
Common utilities for projects

## Setup
Add a config file named config.json which contains:  
(1) The network interface that the gateway uses for its backhaul network.  
*Note: Ensure that this interface uses IPv4*  
(2) The Group Key used to uniquely identify a gateway group.

For e.g.:
```json
{
  "network": {
    "interface": "wlan0"
  },
  "groupKey": {
    "key": "95CFEF1B1F1F5FAAC6954BC1BD713081",
    "iv": "6F2E2CEE52C1AB42"
  }
}
```
