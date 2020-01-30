# Utils
Common utilities for projects

## Setup
1. Add a config file named config.json which contains the network interface name that the gateway uses for its backhaul network.

For e.g.:
```json
{
  "network": {
    "interface": "wlan0"
  }
}
```

## Install
apt-get install libpcap-dev  
npm install