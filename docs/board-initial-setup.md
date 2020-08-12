#Setup
* Label the last 5 characters of the serial number on the board (eg: 0482U). These 5 characters would be used for identifying the board.
* Create a blank file with this id on the HOME directory of the board. 
	touch 0482U
* Add an environment variable called ARTIK_SERIAL with this id.
	export ARTIK_SERIAL="0482U"
* Install essential packages  
    apt install nodejs cron build-essential libudev-dev mongodb openssh-server git-all mosquitto
* Set up an email alert to send the IP address of the board on reboot. Add scripts/email-script.sh to cron:  
    @reboot sleep 15 && /root/on-the-edge/scripts/email-script.sh
* Add the following line to /etc/mongodb.conf:   
	smallfiles = true 
* Run scripts/start-edge-platform.sh on reboot. Add the following line to cron:   
    @reboot sleep 15 && /root/on-the-edge/scripts/start-edge-platform.sh
* Add this to /etc/mosquitto/mosquitto.conf for accessing mqtt streams over websocket:
```
listener 1883 0.0.0.0 

listener 9001 0.0.0.0
protocol websockets
```
 