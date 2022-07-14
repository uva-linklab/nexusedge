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
(3) The BLE advertisement service and characteristic UUIDs.

For e.g.:
```json
{
  "network": {
    "interface": "wlan0"
  },
  "groupKey": {
    "key": "95CFEF1B1F1F5FAAC6954BC1BD713081",
    "iv": "6F2E2CEE52C1AB42"
  },
  "bleAdvUuids": {
    "serviceUuid": "18338db15c5841cca00971c5fd792920",
    "charUuid": "18338db15c5841cca00971c5fd792921"
  }
}
```

## Running the Middleware as a Docker Container
To run with default configuration as shown above:
```
docker run --net=host -d nabeeln7/on-the-edge:latest
```

### Changing the Configuration of the Container
To override configuration, an environment file can be passed to the docker container:
```
docker run --net=host -d --env-file env.list nabeeln7/on-the-edge:latest
```

The environment file is of the following format:
```
NEXUSEDGE_GATEWAY_ID=dca632a232bd
NEXUSEDGE_BACKHAUL_INTERFACE=wlan0
NEXUSEDGE_GROUP_KEY=95CFEF1B1F1F5FAAC6954BC1BD713081
NEXUSEDGE_GROUP_IV=6F2E2CEE52C1AB42
NEXUSEDGE_BLE_ADV_SERVICE_UUID=28338db15c5841cca00971c5fd792920
NEXUSEDGE_BLE_ADV_CHAR_UUID=28338db15c5841cca00971c5fd792921
```
