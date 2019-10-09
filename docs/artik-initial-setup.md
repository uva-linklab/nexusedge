When setting up a new Artik board:

1. Set the root password to "artik_linklab".
2. Connect to the wahoo network. Make the following changes:

/etc/network/interfaces:
# interfaces(5) file used by ifup(8) and ifdown(8)
# Include files from /etc/network/interfaces.d:
source-directory /etc/network/interfaces.d
auto lo
iface lo inet loopback

allow-hotplug wlan0
iface wlan0 inet dhcp
wireless-essid wahoo

/etc/wpa_supplicant/wpa_supplicant.conf:
ctrl_interface=/var/run/wpa_supplicant
ctrl_interface_group=netdev

update_config=1
ap_scan=2
eapol_version=1
network={
        scan_ssid=1
        mode=0
        key_mgmt=NONE
        priority=-999
}

Steps from:
https://raspberrypi.stackexchange.com/questions/15393/connect-to-unsecured-wireless-network

3. Label the last 5 characters of the serial number on the board (eg: 0482U). These 5 characters would be used for identifying the board.
4. Create a blank file with this id on the HOME directory of the board. 
	touch 0482U
5. Add an environment variable called ARTIK_SERIAL with this id.
	export ARTIK_SERIAL="0482U"
6. Set up an email alert to send the IP address of the board on reboot. Use a shell script (email_script.sh under scripts directory of the repo) and add the following line to cron:
	@reboot sleep 30 && /root/on-the-edge/scripts/email_script.sh

7. Install mongo
	apt install mongodb
8. Set /etc/mongodb.conf to include 
	smallfiles = true 
9. use mongorestore to restore the app 
	mongorestore --db app_server on-the-edge/gateway_app_server/mongodump/app_server/
10. set the network interface in on-the-edge/utils/config/client.json