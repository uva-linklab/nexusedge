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
* Set up an email alert to send the IP address of the board on reboot. Add scripts/email-script.sh to cron:  
    @reboot sleep 15 && /root/on-the-edge/scripts/email-script.sh
* Run scripts/start-edge-platform.sh on reboot. Add the following line to cron:   
    @reboot sleep 15 && /root/on-the-edge/scripts/start-edge-platform.sh
