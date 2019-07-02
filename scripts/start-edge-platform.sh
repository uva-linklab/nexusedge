node on-the-edge/gateway_app_server/server.js > on-the-edge/logs/gw_app_server.log &
node on-the-edge/gateway_code/gateway.js f > on-the-edge/logs/gw_code.log &
node on-the-edge/sensor_discover/discover.js &
node on-the-edge/ble-peripheral-discovery/scan.js &
#lab11 gateway script
node gateway/software/ble-gateway-mqtt/ble-gateway-mqtt.js &
#service-api
node service-framework/http-api-server/server.js > service-framework/logs/server.log &