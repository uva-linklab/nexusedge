#on-the-edge scripts
node $HOME/on-the-edge/platform/platform-manager.js > $HOME/on-the-edge/logs/platform-manager.log 2>&1 &
node $HOME/on-the-edge/mqtt-data-collector/mqtt-data-collector.js &
#Multiple noble processes cannot co-exist when there is some peripheral connection. Temporarily not using other noble
#process.
#node $HOME/on-the-edge/ble-peripheral-scanner/ble-peripheral-scanner.js &

#lab11 gateway scripts for BLE and EnOcean sensors
#node $HOME/gateway/software/ble-gateway-mqtt/ble-gateway-mqtt.js &
node $HOME/gateway/software/enocean-generic-gateway/enocean-generic-gateway.js &
