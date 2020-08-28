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