#!/bin/bash
# this script sends the temperature of the raspberry pi gateway to an mqtt topic every minute

filename="/etc/gateway-id"
if [ -s "$filename" ]
then
   id=$(cat /etc/gateway-id)
else
   id=$(cat /sys/class/net/wlan0/address | sed 's/://g')
fi

while sleep 60
do
  # get current timestamp from nodejs as an iso8601 string
  timestamp=$(/usr/bin/node -e "console.log(new Date().toISOString())")

  # get the temperature of the rpi
  temp=$(/opt/vc/bin/vcgencmd measure_temp | egrep -o --color=never "[0-9.]+")

  # generate a json with the shell variables. -c suppresses newlines.
  message_json=$( jq -c -n \
                    --arg device "rpi_temperature" \
                    --arg rpi_temp "$temp" \
                    --arg received_time "$timestamp" \
                    --arg device_id "$id"\
                    '{device: $device, rpi_temp: $rpi_temp, _meta: {received_time: $received_time, device_id: $device_id}}' )

  # publish data to the linklab influxdb mqtt topic
  mosquitto_pub -t gateway-data -m "$message_json"
done
