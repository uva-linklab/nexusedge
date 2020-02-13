#on-the-edge scripts
node $HOME/on-the-edge/api-server/server.js > $HOME/on-the-edge/logs/api-server.log 2>&1 &
DEBUG=gateway-scanner node $HOME/on-the-edge/gateway-scanner/gateway-scanner.js 2> $HOME/on-the-edge/logs/gw-scanner.log &
node $HOME/on-the-edge/mqtt-data-collector/mqtt-data-collector.js &
node $HOME/on-the-edge/ble-peripheral-scanner/ble-peripheral-scanner.js &

#lab11 gateway scripts for BLE and EnOcean sensors
node $HOME/gateway/software/ble-gateway-mqtt/ble-gateway-mqtt.js &
node $HOME/gateway/software/enocean-generic-gateway/enocean-generic-gateway.js &
