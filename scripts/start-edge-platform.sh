#on-the-edge scripts
node $HOME/on-the-edge/platform/platform-manager.js > $HOME/on-the-edge/logs/platform-manager.log 2>&1 &

#lab11 gateway scripts for BLE and EnOcean sensors
# Multiple noble processes cannot co-exist when there is some peripheral connection. Temporarily not using other noble
# process.
#node $HOME/gateway/software/ble-gateway-mqtt/ble-gateway-mqtt.js &

# Enocean sensing does not work with Nodejs version v12.16.2. Temporarily disabling this.
#node $HOME/gateway/software/enocean-generic-gateway/enocean-generic-gateway.js &
