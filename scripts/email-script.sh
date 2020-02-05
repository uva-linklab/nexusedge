#!/bin/bash
#expects the Artik serial number in the env var ARTIK_SERIAL
source $HOME/.bash_profile
echo -e "\
From: "Artik Status" <artikstatus@gmail.com>\n\
To: "Nabeel Nasir" <nn5rh@virginia.edu>\n\
Subject: Artik $ARTIK_SERIAL IP\n\
\n$(hostname -I|cut -d" " -f1)" |\
curl -s -n --ssl-reqd --url "smtps://smtp.gmail.com:465" -T - \
	-u artikstatus@gmail.com:artik_linklab \
	--mail-from "artikstatus@gmail.com" \
	--mail-rcpt "nn5rh@virginia.edu"
