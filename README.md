# On the Edge
Software for edge gateways to work with the gateway platform.

## Setup
* Install node.js v12.x
```
# Using Ubuntu
curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -
sudo apt-get install -y nodejs

# Using Debian, as root
curl -sL https://deb.nodesource.com/setup_12.x | bash -
apt-get install -y nodejs
```
Reference: https://github.com/nodesource/distributions/blob/master/README.md
* Install other essential packages  
    apt install cron build-essential libudev-dev openssh-server git-all mosquitto mosquitto-clients

* Add this to /etc/mosquitto/mosquitto.conf for accessing mqtt streams over websocket:
```
listener 1883 0.0.0.0 

listener 9001 0.0.0.0
protocol websockets
```
* Add a config file named config.json in platform/utils/ which contains:  
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
