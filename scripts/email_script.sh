#!/bin/bash
echo -e "\
From: "Raspberry Pi" <uvatule@gmail.com>\n\
To: "Tu Le" <tnl6wk@virginia.edu>\n\
Subject: Raspberry Pi IP\n\
\n$(hostname -I|cut -d" " -f1)" |\
curl -s -n --ssl-reqd --url "smtps://smtp.gmail.com:465" -T - \
	-u artikstatus@gmail.com:artik_linklab \
	--mail-from "artikstatus@gmail.com" \
	--mail-rcpt "nabeeln7@gmail.com"