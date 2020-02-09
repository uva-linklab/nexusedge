#Setup
* Connect to the wahoo network. Make the following changes:

/etc/network/interfaces:
```
# interfaces(5) file used by ifup(8) and ifdown(8)
# Include files from /etc/network/interfaces.d:
source-directory /etc/network/interfaces.d
auto lo
iface lo inet loopback

allow-hotplug wlan0
iface wlan0 inet dhcp  
wireless-essid wahoo 
```

/etc/wpa_supplicant/wpa_supplicant.conf:  
```
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
```
Steps taken from:  
https://raspberrypi.stackexchange.com/questions/15393/connect-to-unsecured-wireless-network

* Label the last 5 characters of the serial number on the board (eg: 0482U). These 5 characters would be used for identifying the board.
* Create a blank file with this id on the HOME directory of the board. 
	touch 0482U
* Add an environment variable called ARTIK_SERIAL with this id.
	export ARTIK_SERIAL="0482U"
* Install essential packages  
    apt install nodejs cron build-essential libudev-dev mongodb openssh-server
* Set up an email alert to send the IP address of the board on reboot. Add scripts/email-script.sh to cron:  
    @reboot sleep 15 && /root/on-the-edge/scripts/email-script.sh
* Add the following line to /etc/mongodb.conf:   
	smallfiles = true 
* Clone the lab11 gateway repository to collect data for BLE and EnOcean sensors.  
https://github.com/lab11/gateway
* Run scripts/start-edge-platform.sh on reboot. Add the following line to cron:   
    @reboot sleep 15 && /root/on-the-edge/scripts/start-edge-platform.sh