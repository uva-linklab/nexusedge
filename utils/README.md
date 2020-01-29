Common utilities for projects

Setup:
1. Add a config file named config.json which contains the network interface name that the gateway uses.

For e.g.:
{
  "network": {
    "interface": "en0"
  }
}

Installation:
apt-get install libpcap-dev
npm install