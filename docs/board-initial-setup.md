#Setup
* Label the last 5 characters of the serial number on the board (eg: 0482U). These 5 characters would be used for 
identifying the board.  
For Raspberry Pi, the serial number can be found by running the command:  
```
cat /proc/cpuinfo
```
* Create a blank file with this id on the HOME directory of the board. 
```
touch <serial-number>
```
* Add an environment variable called BOARD_SERIAL with this id. Add this line to ~/.bash_profile:
```
export BOARD_SERIAL="<serial-number>"
```
* Install node.js v12.x
```
# Using Ubuntu
curl -sL https://deb.nodesource.com/setup_12.x | sudo -E bash -
sudo apt-get install -y nodejs

# Using Debian, as root
curl -sL https://deb.nodesource.com/setup_12.x | bash -
apt-get install -y nodejs
```
Reference: https://github.com/nodesource/distributions/blob/master/README.md
* Install mongodb  
For RPi: https://koenaerts.ca/compile-and-install-mongodb-on-raspberry-pi/
* Install other essential packages  
    apt install cron build-essential libudev-dev openssh-server git-all mosquitto mosquitto-clients
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
 