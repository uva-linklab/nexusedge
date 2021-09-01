#!/bin/bash
filename="/etc/gateway-id"
if [ -s "$filename" ]
then
   id=`cat /etc/gateway-id`
else
   id=`cat /sys/class/net/wlan0/address | sed 's/://g'`
fi

echo -e "\
From: "NexusEdge" <artikstatus@gmail.com>\n\
To: "Nabeel Nasir" <nn5rh@virginia.edu>\n\
Subject: Gateway On\n\
\nid: $id\n \
\nip: $(hostname -I|cut -d" " -f1)" |\
curl -s -n --ssl-reqd --url "smtps://smtp.gmail.com:465" -T - \
        -u artikstatus@gmail.com:artik_linklab \
        --mail-from "artikstatus@gmail.com" \
        --mail-rcpt "nn5rh@virginia.edu"