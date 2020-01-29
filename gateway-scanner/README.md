These are the functions that are handled by this module:
1. Advertises itself via BLE using the bleno module.
2. Looks for neighbor advertisements via BLE using the noble module.
3. Handles group encryption and decryption using a shared AES ranging key and IV in params.json.
4. Saves self IP address in mongodb.
5. Saves neighbor information (BLE address, IP address) to mongodb upon discovery.

Setup:
1. Add a file named group-key.json which contains the key and IV for the AES-256 CTR encryption used to uniquely identify a gateway group. The same key and IV needs to be used by all gateways in the network. The file is placed in the git ignore list.

e.g.:
{
	"key":"95CFEF1B1F1F5FAAC6954BC1BD713081",
	"iv":"6F2E2CEE52C1AB42"
}

Installation:
apt-get install libudev-dev
npm install