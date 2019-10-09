How to flash the eMMC (onboard storage) on the Nitrogen 8M Mini:

1. Connect the console cable to laptop and open serial connection.
	screen /dev/tty/usb.serial 115200
2. Stop auto booting to eMMC by pressing any key while the boot sequence shows "Hit any key to stop auto boot".
3. At the uboot prompt, type the following:
	ums mmc 0
	This makes the board act as a USB mass storage device.
4. Attach a micro-USB to USB-A cable on the board and connect it to your laptop. The board would be detected like any other flash drive.
5. Use balenaEtcher tool to flash the image from Boundary Devices.

References:
https://boundarydevices.com/programming-emmc-on-i-mx8/
https://boundarydevices.com/wiki/operating-systems/
https://www.balena.io/etcher/