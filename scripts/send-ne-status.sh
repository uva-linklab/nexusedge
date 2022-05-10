#!/bin/bash
# this script sends the status of the "nexusedge" service running on the gateway to an mqtt topic every minute

filename="/etc/gateway-id"
if [ -s "$filename" ]
then
   id=$(cat /etc/gateway-id)
else
   id=$(cat /sys/class/net/wlan0/address | sed 's/://g')
fi

while sleep 60
do
  # get the status of the nexusedge service. the command returns "active" or "inactive"
  ne_status=$(systemctl is-active nexusedge)

  gateway_ip=$(hostname -I|cut -d" " -f1)

  # get current timestamp from nodejs as an iso8601 string
  timestamp=$(/usr/bin/node -e "console.log(new Date().toISOString())")

  # generate a json with the shell variables. -c suppresses newlines.
  message_json=$( jq -c -n \
                    --arg device "nexusedge-gateway" \
                    --arg gateway_ip "$gateway_ip" \
                    --arg ne_status "$ne_status" \
                    --arg received_time "$timestamp" \
                    --arg device_id "$id"\
                    '{device: $device, gateway_ip: $gateway_ip, ne_status: $ne_status, _meta: {received_time: $received_time, device_id: $device_id}}' )

  # publish data to the linklab influxdb mqtt topic
  mosquitto_pub -t gateway-data -m "$message_json"
done
